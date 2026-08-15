/**
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { FileCasOperation } from './types.ts'
 * @import { Effect } from '../effects/types.ts'
 * @import { ReadFile, WriteFile, Rm, Mkdir, IoResult } from '../effects/node/types.ts'
 * @import { Ok } from '../types/result/types.ts'
 * @import { List } from '../effects/list/types.ts'
 */

import { length, maxLength, msb, vec, vec8 } from '../types/bit_vec/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../crypto/sha2/module.f.mjs'
import { fileCas, casAddFile, collectRead, casUpload } from './module.f.mjs'
import { match, pure, runPure, step } from '../effects/module.f.mjs'
import { mkdir, writeFile, rm, readFile, access } from '../effects/node/module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
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
        case 'now': return 0
        case 'randomInt': return 0
        case 'mkdir': case 'createExclusive': case 'rename': case 'rm':
        case 'writeBytes': case 'access':
            return ok(undefined)
        case 'readdir': return ok(/** @type {readonly unknown[]} */ ([]))
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
 * @type {(overrides: Partial<Record<string, unknown[]>>) => (e: Effect<FileCasOperation, unknown>) => readonly [unknown, readonly string[]]}
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
    const handlers = /** @type {Parameters<typeof match>[0]} */ ({
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
    })
    const matcher = match(handlers)
    /** @type {(e: Effect<FileCasOperation, unknown>) => unknown} */
    const run_ = e => {
        const m = matcher(e)
        return m[0] === 'done' ? m[1] : run_(m[2](/** @type {any} */ (m[1])))
    }
    return e => [run_(e), log]
}

// Create a 128 KiB big file content (at the max Vec size limit)
// This tests the boundary where files are at the chunk size limit
/** @type {() => Vec} */
const createBigFileContent = () => {
    const byteCount = 128n * 1024n // 128 KiB
    // Create a repeating pattern: 0x42 repeated across the file
    return vec(byteCount * 8n)(0x42424242n)
}

// Test adding a big file and verifying the hash
/** @type {() => Effect<_TestOp, void>} */
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
/** @type {() => Effect<_TestOp, void>} */
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
    // Both effects must be interpreted, not merely built: an `Effect` is inert
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
        /** @type {List<FileCasOperation, IoResult<Vec>>} */
        const payload = nonEmpty(ok(content), empty())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(length(hash), 256n, ['expected 256-bit hash', length(hash)])
        assertEq(msb.cmp(hash)(computeSync(sha256)([content])), 0, 'write hash mismatch')
        /** @type {(acc: readonly Vec[]) => (stream: List<FileCasOperation, IoResult<Vec>>) => Effect<FileCasOperation, IoResult<readonly Vec[]>>} */
        const drain = acc =>
            stream =>
                step(
                    stream,
                    (node) => {
                        if (node === undefined) { return pure(ok(acc)) }
                        const { first, tail } = node
                        if (first[0] === 'error') { return pure(first) }
                        return drain([...acc, first[1]])(tail)
                    },
                )
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        assert(readResult[0] === 'ok', ['expected read ok', readResult])
        assertEq(msb.cmp(msb.listToVec(readResult[1]))(content), 0, 'read content mismatch')
    },
    casReadMissingShard: () => {
        // A missing shard surfaces as an explicit error *item*, never as end-of-stream.
        const c = fileCas(sha256)('.')
        const hash = computeSync(sha256)([vec8(0x2An)])
        const node = virtual(emptyState)(c.read(hash))[1]
        assert(node !== undefined, 'missing shard must not be EOF')
        assert(node.first[0] === 'error', ['expected error item', node.tail])
    },
    casWriteMultiChunk: () => {
        // A multi-chunk payload streams through `writeBytes` chunk-by-chunk (the lease is
        // renewed between chunks); the hash equals the SHA-256 of the concatenated bytes,
        // and read streams the same content back.
        const chunks = /** @type {const} */ ([vec8(0x11n), vec8(0x22n), vec8(0x33n)])
        const c = fileCas(sha256)('.')
        /** @type {List<FileCasOperation, IoResult<Vec>>} */
        const payload = chunks.reduceRight(
            (tail, chunk) => nonEmpty(ok(chunk), tail),
            /** @type {List<FileCasOperation, IoResult<Vec>>} */ (empty()))
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'multi-chunk write hash mismatch')
        /** @type {(acc: readonly Vec[]) => (stream: List<FileCasOperation, IoResult<Vec>>) => Effect<FileCasOperation, IoResult<readonly Vec[]>>} */
        const drain = acc =>
            stream =>
                step(
                    stream,
                    (node) => {
                        if (node === undefined) { return pure(ok(acc)) }
                        const { first, tail } = node
                        if (first[0] === 'error') { return pure(first) }
                        return drain([...acc, first[1]])(tail)
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
        /** @type {() => List<FileCasOperation, IoResult<Vec>>} */
        const payload = () => nonEmpty(ok(content), empty())
        const [state1, w1] = virtual(emptyState)(c.write(payload()))
        const [state2, w2] = virtual(state1)(c.write(payload()))
        assert(!(w1[0] !== 'ok' || w2[0] !== 'ok'), ['expected both writes ok', w1, w2])
        assertEq(msb.cmp(w1[1])(w2[1]), 0, 'dedup hash mismatch')
        const [, hashes] = virtual(state2)(c.list())
        assertEq(hashes.length, 1, ['expected one shard after dedup', hashes.length])
    },
    casWriteErrorItemAborts: () => {
        // An error item mid-stream deletes the partial staging file and fails; nothing is
        // published, so the store stays empty.
        const c = fileCas(sha256)('.')
        /** @type {IoResult<Vec>} */
        const okItem = ok(vec8(0x11n))
        /** @type {IoResult<Vec>} */
        const errItem = error({ code: 'BOOM' })
        /** @type {List<FileCasOperation, IoResult<Vec>>} */
        const payload = nonEmpty(okItem, nonEmpty(errItem, /** @type {List<FileCasOperation, IoResult<Vec>>} */ (empty())))
        const [state1, result] = virtual(emptyState)(c.write(payload))
        assert(result[0] === 'error', ['expected write error', result])
        const [, hashes] = virtual(state1)(c.list())
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
        /** @type {List<FileCasOperation, IoResult<Vec>>} */
        const payload = chunks.reduceRight(
            (tl, chunk) => nonEmpty(ok(chunk), tl),
            /** @type {List<FileCasOperation, IoResult<Vec>>} */ (empty()))
        const [state1, w] = virtual(emptyState)(c.write(payload))
        assert(w[0] === 'ok', ['expected write ok', w])
        const hash = w[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'oversized write hash mismatch')
        // Fold the read stream straight into a fresh SHA-2 state — never one `Vec`.
        /** @type {(state: typeof sha256.init) => (stream: List<FileCasOperation, IoResult<Vec>>) => Effect<FileCasOperation, IoResult<Vec>>} */
        const rehash = state =>
            stream =>
                step(
                    stream,
                    (node) => {
                        if (node === undefined) { return pure(ok(sha256.end(state))) }
                        const { first, tail } = node
                        if (first[0] === 'error') { return pure(first) }
                        return rehash(sha256.append(first[1])(state))(tail)
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
        const x = c.write(nonEmpty(ok(content), /** @type {List<never, Ok<Vec>>} */ (empty())))
        const [state1, w] = virtual(state0)(x)
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, present] = virtual(state1)(access(stalePath))
        assert(present[0] === 'error', 'expected GC to reclaim the expired staging file')
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
        const x = c.write(nonEmpty(ok(content), /** @type {List<never, Ok<Vec>>} */ (empty())))
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
        /** @type {List<never, IoResult<Vec>>} */
        const payload = nonEmpty(ok(vec8(0x11n)), empty())
        const [result, log] = drive({ writeBytes: [error('disk full')] })(c.write(payload))
        assert(/** @type {IoResult<Vec>} */ (result)[0] === 'error', ['expected write error', result])
        assertEq(/** @type {IoResult<Vec>} */ (result)[1], 'disk full')
        // The cleanup `rm` of the partial staging file must actually run, not just be
        // implied by the returned error tag.
        assertEq(log[log.length - 1], 'rm', ['expected cleanup rm to run', log])
    },
    casWriteLeaseRenewalRenameErrorAborts: () => {
        // The lease-renewal `rename` (after every chunk) failing fails the same way as a
        // `writeBytes` failure: the partial staging file is deleted, error returned.
        const c = fileCas(sha256)('.')
        /** @type {List<never, IoResult<Vec>>} */
        const payload = nonEmpty(ok(vec8(0x11n)), empty())
        const [result, log] = drive({ rename: [error('rename failed')] })(c.write(payload))
        assert(/** @type {IoResult<Vec>} */ (result)[0] === 'error', ['expected write error', result])
        assertEq(/** @type {IoResult<Vec>} */ (result)[1], 'rename failed')
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
        /** @type {List<never, IoResult<Vec>>} */
        const payload = nonEmpty(ok(vec8(0x11n)), empty())
        const [result] = drive({ stat: [ok({ size: 999 })] })(c.write(payload))
        assert(/** @type {IoResult<Vec>} */ (result)[0] === 'error', ['expected write error', result])
        assertEq(/** @type {IoResult<Vec>} */ (result)[1], 'publish size mismatch')
    },
    casWritePublishStatErrorErrorsEvenWithMatchingSize: () => {
        // Pins the tag half of the same check: a `stat` that fails outright must still
        // fail `write`, even in the degenerate case where its error payload happens to
        // carry a `.size` field equal to the expected offset — otherwise a check that
        // only compared `.size` (dropping the `st[0] === 'ok'` tag check) would slip
        // through undetected by the size-mismatch case above, which never sees a
        // coincidentally-matching size on a failed `stat`.
        const c = fileCas(sha256)('.')
        /** @type {List<never, IoResult<Vec>>} */
        const payload = nonEmpty(ok(vec8(0x11n)), empty())
        const [result] = drive({ stat: [error({ size: 1 })] })(c.write(payload))
        assert(/** @type {IoResult<Vec>} */ (result)[0] === 'error', ['expected write error', result])
        assertEq(/** @type {IoResult<Vec>} */ (result)[1], 'publish size mismatch')
    },
    casUploadSuccess: () => {
        // A successful upload returns the hash and deletes the source file from cas_upload/.
        const content = vec8(0x2An)
        const state0 = { ...emptyState, root: { 'cas_upload': { 'myfile': [content] } } }
        const [state1, result] = virtual(state0)(casUpload('.')('myfile'))
        assert(result[0] === 'ok', ['expected casUpload ok', result])
        assertEq(length(result[1]), 256n, ['expected 256-bit hash', length(result[1])])
        // Source must be deleted after successful publish.
        const srcPath = join('.', 'cas_upload', 'myfile')
        const [, srcAccess] = virtual(state1)(access(srcPath))
        assert(srcAccess[0] === 'error', 'expected source to be deleted after successful upload')
    },
    casUploadFailureKeepsSource: () => {
        // A missing source file causes write to fail; casUpload returns error and the
        // source is left in place (trivially: it was never there, but the upload is not published).
        const state0 = { ...emptyState, root: {} }
        const [state1, result] = virtual(state0)(casUpload('.')('nonexistent'))
        assert(result[0] === 'error', ['expected casUpload to fail on missing source', result])
        // Nothing published to the store.
        const c = fileCas(sha256)('.')
        const [, hashes] = virtual(state1)(c.list())
        assertEq(hashes.length, 0, ['expected nothing published on failed upload', hashes])
    },
    collectReadDrainsChunks: () => {
        // The common path: every chunk is `ok`, so collectRead concatenates them all
        // and returns the whole blob as one `Vec`.
        /** @type {List<never, IoResult<Vec>>} */
        const stream = nonEmpty(ok(vec8(0x11n)), nonEmpty(ok(vec8(0x22n)), empty()))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        assertEq(o[0][0], 'ok')
    },
    collectReadPropagatesErrorItem: () => {
        // An error item mid-stream short-circuits collectRead with that same error.
        /** @type {IoResult<Vec>} */
        const boom = error('boom')
        /** @type {List<never, IoResult<Vec>>} */
        const stream = nonEmpty(ok(vec8(0x11n)), nonEmpty(boom, /** @type {List<never, IoResult<Vec>>} */ (empty())))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        const [r] = o
        assertEq(r[0], 'error')
        assertEq(r[1], 'boom')
    },
    // A single `Vec` cannot exceed `maxLength` bits — feed a pure stream whose second
    // chunk pushes the running total just over the limit so the overflow guard fires
    // without any real I/O.
    collectReadOverflow: () => {
        const half = maxLength / 2n
        const v1 = vec(half)(0n)
        const v2 = vec(half + 1n)(0n)
        /** @type {List<never, IoResult<Vec>>} */
        const stream = nonEmpty(ok(v1), nonEmpty(ok(v2), empty()))
        const o = runPure(collectRead(stream))
        assert(o.length === 1, 'expected collectRead to finish without issuing a command')
        assertEq(o[0][0], 'error')
    },
    casListPropagatesNonNotFoundAccessError: () => {
        // A non-ENOENT `access` failure (permissions, corruption) is a genuine storage
        // error and must propagate out of `list`, not be swallowed as an empty store.
        const c = fileCas(sha256)('.')
        const boom = { code: 'EACCES' }
        const r = casCommand(c.list())
        assert(r[0] === 'cont', 'expected list() to issue an access command first')
        assertEq(r[1], 'access')
        /** @type {unknown} */
        let threw
        try {
            r[2](error(boom))
        } catch (e) {
            threw = e
        }
        assertEq(threw, boom)
    },
}
