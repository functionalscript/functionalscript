/**
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { FileCasOperation } from './types.ts'
 * @import { RawEffect } from '../effects/types.ts'
 * @import { IoChannel, IoResult, Mkdir, ReadFile, Rm, WriteFile } from '../effects/node/types.ts'
 * @import { Effect } from '../effects/io/types.ts'
 * @import { Ok } from '../types/result/types.ts'
 * @import { List } from '../effects/list/types.ts'
 */

import { length, maxLength, msb, vec, vec8 } from '../types/bit_vec/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../crypto/sha2/module.f.mjs'
import { fileCas, casAddFile, collectRead } from './module.f.mjs'
import { match, pure, runPure, step } from '../effects/module.f.mjs'
import { pureError, pureOk, step as ioStep } from '../effects/io/module.f.mjs'
import { ioError, mkdir, writeFile, rm, readFile, access } from '../effects/node/module.f.mjs'
import { error, ok, unwrap as unwrapResult } from '../types/result/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { join } from '../path/module.f.mjs'
import { nonEmpty, empty } from '../effects/list/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../asserts/module.f.mjs'

const testDir = './test-cas-cli'

/** @typedef {FileCasOperation | WriteFile | ReadFile | Rm | Mkdir} _TestOp */

// Names the command a `FileCasOperation` effect stops at, so a proof can assert
// on it and resume the continuation without reading the `Do` layout. The map
// has to list every operation the CAS can perform — that is what makes it total,
// and what makes a new operation a compile error here rather than a silent gap.
const casCommand = match({
    access: () => 'access',
    createExclusive: () => 'createExclusive',
    mkdir: () => 'mkdir',
    now: () => 'now',
    randomInt: () => 'randomInt',
    readBytes: () => 'readBytes',
    readdir: () => 'readdir',
    rename: () => 'rename',
    rm: () => 'rm',
    stat: () => 'stat',
    writeBytes: () => 'writeBytes',
})

// A harmless "always succeeds" response for a command, used by `drive` once a
// test's overrides for that command are exhausted — good enough to let the
// rest of `write`'s pipeline run to completion without ever touching a real
// filesystem.
/** @type {(cmd: string) => unknown} */
const casDefaultResponse = cmd => {
    switch (cmd) {
        case 'now': return ok(0)
        case 'randomInt': return ok(0)
        case 'mkdir': case 'createExclusive': case 'rename': case 'rm':
        case 'writeBytes': case 'access':
            return ok(undefined)
        case 'readdir': return ok([])
        case 'stat': return ok({ size: 0 })
        default: return ok(undefined)
    }
}

/**
 * Drives a `FileCasOperation` effect to completion with synthetic op
 * responses instead of a filesystem. `overrides[cmd]` is a queue consumed in
 * call order; once a command's queue is empty (or was never given),
 * `casDefaultResponse` supplies an always-succeeds value.
 *
 * `write`'s op-failure branches — a `writeBytes`/`rename` call failing
 * mid-stream, or the final `stat` reporting a mismatched size — are real only
 * under a race (another writer, a failing disk) between two of `write`'s own
 * steps. The virtual harness has no such race to offer, so this reaches them
 * directly instead: `overrides` names exactly the one call that fails, and
 * every other call in the pipeline succeeds around it.
 *
 * Also returns the ordered log of command names issued, so a caller can
 * confirm not just the returned error but *that cleanup ran* — e.g. that the
 * failure path's own `rm` of the partial staging file was actually called,
 * not just that some code path returned the right error tag.
 *
 * @type {(overrides: Partial<Record<string, unknown[]>>) => (e: RawEffect<FileCasOperation, unknown>) => readonly [unknown, readonly string[]]}
 */
const drive = overrides => {
    /** @type {string[]} */
    const log = []
    /** @type {(cmd: string) => unknown} */
    const next = cmd => {
        log.push(cmd)
        const queue = overrides[cmd]
        return queue !== undefined && queue.length > 0 ? queue.shift() : casDefaultResponse(cmd)
    }
    const handlers = {
        access: () => next('access'),
        createExclusive: () => next('createExclusive'),
        mkdir: () => next('mkdir'),
        now: () => next('now'),
        randomInt: () => next('randomInt'),
        readBytes: () => next('readBytes'),
        readdir: () => next('readdir'),
        rename: () => next('rename'),
        rm: () => next('rm'),
        stat: () => next('stat'),
        writeBytes: () => next('writeBytes'),
    }
    const matcher = match(handlers)
    /** @type {(e: RawEffect<FileCasOperation, unknown>) => unknown} */
    const run_ = e => {
        const m = matcher(e)
        return m[0] === 'done' ? m[1] : run_(m[2](m[1]))
    }
    return e => [run_(e), log]
}

// Create a 128 KiB big file content (at the max Vec size limit)
// This tests the boundary where files are at the chunk size limit
/**
 * The message of an `IoResult` the driver returned as `unknown`. Checks the
 * result really is an `error` pair rather than assuming it: these proofs exist
 * to establish that a write fails closed, so the shape is the claim.
 */
/**
 * Asserts that a channel error is a host failure carrying `message`.
 * @type {(e: unknown, message: string) => void}
 */
const assertIoMessage = (e, message) => {
    assert(e instanceof Array && e[0] === 'ioError', ['expected an ioError', e])
    assertEq(e[1].message, message)
}

/** @type {(result: unknown) => unknown} */
const errorMessage = result => {
    assert(result instanceof Array && result.length === 2 && result[0] === 'error',
        ['expected an error result', result])
    return result[1]
}

/** @type {() => Vec} */
const createBigFileContent = () => {
    const byteCount = 128n * 1024n // 128 KiB
    // Create a repeating pattern: 0x42 repeated across the file
    return vec(byteCount * 8n)(0x42424242n)
}

// Test adding a big file and verifying the hash
/** @type {() => RawEffect<_TestOp, void>} */
const testAddBigFile = () => {
    const bigFilePath = `${testDir}/big-file.bin`
    const cas = fileCas(sha256)(testDir)
    const x0 = step(
        mkdir(testDir, { recursive: true }),
        () => writeFile(bigFilePath, createBigFileContent())
    )
    const x1 = step(
        x0,
        writeRes => {
            assert(writeRes[0] === 'ok', ['failed to write test file', writeRes])
            return casAddFile(cas)(bigFilePath)
        }
    )
    const x2 = step(
        x1,
        addRes => {
            assert(addRes[0] === 'ok', ['failed to add file to CAS', addRes])
            const hash = addRes[1]
            // Verify hash is 256 bits (SHA-256)
            assertEq(length(hash), 256n, ['expected 256-bit hash', length(hash)])
            // Verify hash can be encoded/decoded
            assertNotNullish(cBase32ToVec(vecToCBase32(hash)), 'failed to decode hash from cBase32')
            return rm(testDir)
        })
    return step(
        x2,
        () => pure(undefined)
    )
}

// Test adding and retrieving a big file
/** @type {() => RawEffect<_TestOp, void>} */
const testAddAndGetBigFile = () => {
    const bigContent = createBigFileContent()
    const bigFilePath = `${testDir}/big-file.bin`
    const cas = fileCas(sha256)(testDir)
    const x0 = step(
        mkdir(testDir, { recursive: true }),
        () => writeFile(bigFilePath, bigContent)
    )
    const x1 = step(
        x0,
        writeRes => {
            assert(writeRes[0] === 'ok', ['failed to write test file', writeRes])
            return casAddFile(cas)(bigFilePath)
        }
    )
    // Verify the file is stored at the expected location
    const x2 = step(
        x1,
        addRes => {
            assert(addRes[0] === 'ok', ['failed to add file to CAS', addRes])
            return readFile(cas.url(addRes[1]))
        }
    )
    const x3 = step(
        x2,
        readRes => {
            assert(readRes[0] === 'ok', ['failed to read stored file', readRes])
            // Verify content is the same size as original
            assertEq(length(readRes[1]), length(bigContent), 'stored content size mismatch')
            return rm(testDir)
        })
    return step(
        x3,
        () => pure(undefined)
    )
}

export const proof = {
    // Both effects must be interpreted, not merely built: a `RawEffect` is inert
    // data, so returning one from a proof runs none of its continuations and
    // asserts nothing.
    addBigFile: () => { virtual(emptyState)(testAddBigFile()) },
    addAndGetBigFile: () => { virtual(emptyState)(testAddAndGetBigFile()) },
    //
    casWriteRead: () => {
        // Round-trip a single-chunk payload through the real streaming CAS: `write` returns
        // the content hash, and `read` streams the same bytes back as `ok` chunk items.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        /** @type {List<FileCasOperation, Vec, IoChannel>} */
        const payload = nonEmpty(content, empty())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(length(hash), 256n, ['expected 256-bit hash', length(hash)])
        assertEq(msb.cmp(hash)(computeSync(sha256)([content])), 0, 'write hash mismatch')
        /** @type {(acc: readonly Vec[]) => (stream: List<FileCasOperation, Vec, IoChannel>) => Effect<FileCasOperation, readonly Vec[], IoChannel>} */
        const drain = acc =>
            stream =>
                ioStep(
                    stream,
                    (node) => {
                        if (node === undefined) { return pureOk(acc) }
                        const { first, tail } = node
                        return drain([...acc, first])(tail)
                    },
                )
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        assert(readResult[0] === 'ok', ['expected read ok', readResult])
        assertEq(msb.cmp(msb.listToVec(readResult[1]))(content), 0, 'read content mismatch')
    },
    casReadMissingShard: () => {
        // A missing shard fails the stream; it is never the `ok(undefined)` that
        // ends one, which is the confusion a per-item `Result` used to allow.
        const c = fileCas(sha256)('.')
        const hash = computeSync(sha256)([vec8(0x2An)])
        const cell = virtual(emptyState)(c.read(hash))[1]
        assert(cell[0] === 'error', ['missing shard must fail the stream', cell])
    },
    casWriteMultiChunk: () => {
        // A multi-chunk payload streams through `writeBytes` chunk-by-chunk (the lease is
        // renewed between chunks); the hash equals the SHA-256 of the concatenated bytes,
        // and read streams the same content back.
        const chunks = /** @type {const} */ ([vec8(0x11n), vec8(0x22n), vec8(0x33n)])
        const c = fileCas(sha256)('.')
        /** @type {List<FileCasOperation, Vec, IoChannel>} */
        const payload = chunks.reduceRight(
            (tail, chunk) => nonEmpty(chunk, tail),
            /** @satisfies {List<never, Vec, IoChannel>} */ (empty()))
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'multi-chunk write hash mismatch')
        /** @type {(acc: readonly Vec[]) => (stream: List<FileCasOperation, Vec, IoChannel>) => Effect<FileCasOperation, readonly Vec[], IoChannel>} */
        const drain = acc =>
            stream =>
                ioStep(
                    stream,
                    (node) => {
                        if (node === undefined) { return pureOk(acc) }
                        const { first, tail } = node
                        return drain([...acc, first])(tail)
                    },
                )
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        assert(readResult[0] === 'ok', ['expected read ok', readResult])
        const expected = msb.concat(msb.concat(chunks[0])(chunks[1]))(chunks[2])
        assertEq(msb.cmp(msb.listToVec(readResult[1]))(expected), 0, 'multi-chunk read content mismatch')
    },
    casWriteDedup: () => {
        // Same content ⇒ same hash; the second upload's replace-`rename` publishes over the
        // first, leaving exactly one shard in the store.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        /** @type {() => List<FileCasOperation, Vec, IoChannel>} */
        const payload = () => nonEmpty(content, empty())
        const [state1, w1] = virtual(emptyState)(c.write(payload()))
        const [state2, w2] = virtual(state1)(c.write(payload()))
        assert(!(w1[0] !== 'ok' || w2[0] !== 'ok'), ['expected both writes ok', w1, w2])
        assertEq(msb.cmp(w1[1])(w2[1]), 0, 'dedup hash mismatch')
        const [, listed] = virtual(state2)(c.list())
        const hashes = unwrapResult(listed)
        assertEq(hashes.length, 1, ['expected one shard after dedup', hashes.length])
    },
    casWriteErrorItemAborts: () => {
        // A stream that fails mid-way deletes the partial staging file and fails; nothing is
        // published, so the store stays empty.
        const c = fileCas(sha256)('.')
        /** @type {List<FileCasOperation, Vec, IoChannel>} */
        const payload = nonEmpty(vec8(0x11n), pureError(ioError({ code: 'BOOM', message: 'boom' })))
        const [state1, result] = virtual(emptyState)(c.write(payload))
        assert(result[0] === 'error', ['expected write error', result])
        const [, listed] = virtual(state1)(c.list())
        const hashes = unwrapResult(listed)
        assertEq(hashes.length, 0, ['expected nothing published on abort', hashes])
    },
    casWriteReadExceedsMaxLength: () => {
        // The point of streaming: a payload larger than a single `Vec`'s `maxLength`
        // (128 KiB) must round-trip. `write` lands the chunks on disk without ever
        // holding them as one `Vec`, and `read` streams them back the same way — so the
        // round-trip is verified by hashing the read stream incrementally rather than
        // concatenating it (which would itself overflow `maxLength`).
        const big = vec(maxLength)(0xABn)   // one full-size chunk: exactly maxLength bits
        const tail = vec8(0x2An)            // one more byte ⇒ total > maxLength
        const chunks = /** @type {const} */ ([big, tail])
        const c = fileCas(sha256)('.')
        /** @type {List<FileCasOperation, Vec, IoChannel>} */
        const payload = chunks.reduceRight(
            (tl, chunk) => nonEmpty(chunk, tl),
            /** @satisfies {List<never, Vec, IoChannel>} */ (empty()))
        const [state1, w] = virtual(emptyState)(c.write(payload))
        assert(w[0] === 'ok', ['expected write ok', w])
        const hash = w[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'oversized write hash mismatch')
        // Fold the read stream straight into a fresh SHA-2 state — never one `Vec`.
        /** @type {(state: typeof sha256.init) => (stream: List<FileCasOperation, Vec, IoChannel>) => Effect<FileCasOperation, Vec, IoChannel>} */
        const rehash = state =>
            stream =>
                ioStep(
                    stream,
                    (node) => {
                        if (node === undefined) { return pureOk(sha256.end(state)) }
                        const { first, tail } = node
                        return rehash(sha256.append(first)(state))(tail)
                    }
                )
        const [, readBack] = virtual(state1)(rehash(sha256.init)(c.read(hash)))
        assert(readBack[0] === 'ok', ['expected read ok', readBack])
        assertEq(msb.cmp(readBack[1])(hash), 0, 'oversized read-back hash mismatch')
    },
    casWriteGcReclaimsExpired: () => {
        // A staging file whose deadline is in the past is reclaimed by the GC that `write`
        // runs before staging its own file.
        const stalePath = join('.', '.cas', '_stage', '0000000000000000000-stale')
        const state0 = {
            ...emptyState,
            epochNs: 1_000_000,
            root: { '.cas': { '_stage': { '0000000000000000000-stale': [vec8(0x99n)] } } },
        }
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const x = c.write(nonEmpty(content, /** @satisfies {List<never, Vec, IoChannel>} */ (empty())))
        const [state1, w] = virtual(state0)(x)
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, present] = virtual(state1)(access(stalePath))
        assert(present[0] === 'error', 'expected GC to reclaim the expired staging file')
    },
    casWriteGcRmFailureDoesNotFailTheUpload: () => {
        // The sweep is best-effort, and `gcStage`'s error channel is `never`
        // because it says so: an `rm` that fails on one expired file recovers
        // per item, so the upload it is piggy-backed on still succeeds.
        const stale = '0000000000000000000-stale'
        const c = fileCas(sha256)('.')
        // An empty payload: the driver's default `stat` reports size 0, so the
        // publish check passes and the sweep is the only thing under test.
        /** @type {List<never, Vec, IoChannel>} */
        const payload = empty()
        const [result, log] = drive({
            // Only the first `now` is the sweep's, so every deadline after it
            // stays 0 and the staging file below reads as expired.
            now: [ok(1)],
            readdir: [ok([{ name: stale, parentPath: '_stage', isFile: true }])],
            rm: [error(ioError({ message: 'busy' }))],
        })(c.write(payload))
        assert(result instanceof Array && result[0] === 'ok', ['expected write ok', result])
        assertEq(log[0], 'now', ['expected the sweep to run first', log])
    },
    casWriteGcSkipsLiveLease: () => {
        // A staging file whose deadline is still in the future is left alone by the GC
        // that `write` runs before staging its own file.
        const livePath = join('.', '.cas', '_stage', '0000000000002000000-live')
        const state0 = {
            ...emptyState,
            epochNs: 1_000_000,
            root: { '.cas': { '_stage': { '0000000000002000000-live': [vec8(0x99n)] } } },
        }
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const x = c.write(nonEmpty(content, /** @satisfies {List<never, Vec, IoChannel>} */ (empty())))
        const [state1, w] = virtual(state0)(x)
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, present] = virtual(state1)(access(livePath))
        assert(present[0] === 'ok', 'expected GC to leave the live staging file alone')
    },
    casWriteBytesErrorAborts: () => {
        // A `writeBytes` call failing mid-stream (disk full, permissions) fails closed:
        // the partial staging file is deleted and the error is returned, without ever
        // reaching a real filesystem here.
        const c = fileCas(sha256)('.')
        /** @type {List<never, Vec, IoChannel>} */
        const payload = nonEmpty(vec8(0x11n), empty())
        const [result, log] = drive({ writeBytes: [error(ioError({ message: 'disk full' }))] })(c.write(payload))
        assertIoMessage(errorMessage(result), 'disk full')
        // The cleanup `rm` of the partial staging file must actually run, not just be
        // implied by the returned error tag.
        assertEq(log[log.length - 1], 'rm', ['expected cleanup rm to run', log])
    },
    casWriteLeaseRenewalRenameErrorAborts: () => {
        // The lease-renewal `rename` (after every chunk) failing fails the same way as a
        // `writeBytes` failure: the partial staging file is deleted, error returned.
        const c = fileCas(sha256)('.')
        /** @type {List<never, Vec, IoChannel>} */
        const payload = nonEmpty(vec8(0x11n), empty())
        const [result, log] = drive({ rename: [error(ioError({ message: 'rename failed' }))] })(c.write(payload))
        assertIoMessage(errorMessage(result), 'rename failed')
        assertEq(log[log.length - 1], 'rm', ['expected cleanup rm to run', log])
    },
    casWritePublishSizeMismatchErrors: () => {
        // `publish`'s three filesystem steps (mkdir/rename/rm) run best-effort with their
        // results ignored; success is decided afterward by the final `stat`. A `stat`
        // that reports `ok` but with a size other than what was written — a race with a
        // concurrent writer — surfaces as a "publish size mismatch" error instead of a
        // false "ok". Pins the size half of the check: a `stat` that returns `ok` with
        // any size but the expected one must still fail, even though the tag alone says
        // success.
        const c = fileCas(sha256)('.')
        /** @type {List<never, Vec, IoChannel>} */
        const payload = nonEmpty(vec8(0x11n), empty())
        const [result] = drive({ stat: [ok({ size: 999 })] })(c.write(payload))
        assertIoMessage(errorMessage(result), 'publish size mismatch')
    },
    casWritePublishStatErrorErrorsEvenWithMatchingSize: () => {
        // Pins the tag half of the same check: a `stat` that fails outright must still
        // fail `write`, even in the degenerate case where its error payload happens to
        // carry a `.size` field equal to the expected offset — otherwise a check that
        // only compared `.size` (dropping the `st[0] === 'ok'` tag check) would slip
        // through undetected by the size-mismatch case above, which never sees a
        // coincidentally-matching size on a failed `stat`.
        const c = fileCas(sha256)('.')
        /** @type {List<never, Vec, IoChannel>} */
        const payload = nonEmpty(vec8(0x11n), empty())
        const [result] = drive({ stat: [error({ size: 1 })] })(c.write(payload))
        assertIoMessage(errorMessage(result), 'publish size mismatch')
    },
    collectReadDrainsChunks: () => {
        // The common path: every chunk is `ok`, so collectRead concatenates them all
        // and returns the whole blob as one `Vec`.
        /** @type {List<never, Vec, IoChannel>} */
        const stream = nonEmpty(vec8(0x11n), nonEmpty(vec8(0x22n), empty()))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        assertEq(o[0][0], 'ok')
    },
    collectReadPropagatesStreamFailure: () => {
        // A stream that fails mid-way short-circuits collectRead with that same
        // failure — `step` does it, so `collectRead` has no branch for it.
        /** @type {List<never, Vec, IoChannel>} */
        const stream = nonEmpty(vec8(0x11n), pureError(ioError({ message: 'boom' })))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        const [r] = o
        assert(r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].message === 'boom', r)
    },
    // A single `Vec` cannot exceed `maxLength` bits — feed a pure stream whose second
    // chunk pushes the running total just over the limit so the overflow guard fires
    // without any real I/O.
    collectReadOverflow: () => {
        const half = maxLength / 2n
        const v1 = vec(half)(0n)
        const v2 = vec(half + 1n)(0n)
        /** @type {List<never, Vec, IoChannel>} */
        const stream = nonEmpty(v1, nonEmpty(v2, empty()))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        assertEq(o[0][0], 'error')
    },
    casListPropagatesNonNotFoundAccessError: () => {
        // A non-ENOENT `access` failure (permissions, corruption) is a genuine storage
        // error and must propagate out of `list` as an `error`, neither swallowed as an
        // empty store nor thrown: the caller decides what an unreadable store means.
        const c = fileCas(sha256)('.')
        const boom = ioError({ code: 'EACCES', message: 'permission denied' })
        const r = casCommand(c.list())
        assert(r[0] === 'cont', 'expected list() to issue an access command first')
        assertEq(r[1], 'access')
        const answered = runPure(r[2](error(boom)))
        assert(answered.length === 1, ['expected list() to answer without another command', answered])
        const result = answered[0]
        assert(result[0] === 'error', ['expected the access failure to propagate', result])
        assertEq(result[1], boom)
    },
}
