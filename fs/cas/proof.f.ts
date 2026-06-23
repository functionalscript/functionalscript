import { casUpload, fileCas, type FileCasOperation } from './module.f.ts'
import { commands } from './cli/module.f.ts'
import { computeSync, sha256 } from '../crypto/sha2/module.f.ts'
import { length, maxLength, msb, vec, vec8 } from '../types/bit_vec/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'
import { listEffectCons, listEffectEnd, pure, type Effect, type ListEffect } from '../effects/module.f.ts'
import { error, ok } from '../types/result/module.f.ts'
import { defaultNodeProgramOptions, emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { access, type IoResult, type NodeProgramOptions } from '../effects/node/module.f.ts'
import { join } from '../path/module.f.ts'
import { dispatch } from '../cli/module.f.ts'

const makeOptions = (args: readonly string[]): NodeProgramOptions =>
    ({ ...defaultNodeProgramOptions, args })

const main = dispatch(commands)

export const proof = {
    mainAdd: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [finalState, exitCode] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
        if (finalState.stdout.length === 0) { throw 'expected hash in stdout' }
    },
    mainAddWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['add'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetFound: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1, exitCode1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        if (exitCode1 !== 0) { throw ['expected add exit 0', exitCode1] }
        const hashStr = state1.stdout.trim()
        const [, exitCode2] = virtual(state1)(main(makeOptions(['get', hashStr, 'output'])))
        if (exitCode2 !== 0) { throw ['expected get exit 0', exitCode2] }
    },
    mainGetNotFound: () => {
        // valid cBase32 hash that has not been stored
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const hashStr = state1.stdout.trim()
        // use an empty store so the hash is not found
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get', hashStr, 'output'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetWrongArgs: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainGetInvalidHash: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['get', 'not-a-valid-hash', 'output'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainList: () => {
        const content = vec8(0x2An)
        const state = { ...emptyState, root: { myfile: [content] } }
        const [state1] = virtual(state)(main(makeOptions(['add', 'myfile'])))
        const [, exitCode] = virtual(state1)(main(makeOptions(['list'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
    },
    mainListEmptyStore: () => {
        // A fresh directory has no `.cas` yet; listing must succeed (empty),
        // not crash unwrapping a readdir ENOENT.
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['list'])))
        if (exitCode !== 0) { throw ['expected exit 0', exitCode] }
        if (finalState.stdout !== '') { throw ['expected empty stdout', finalState.stdout] }
    },
    mainListCorruptStore: () => {
        // `.cas` exists but is a file, not a directory: a real storage error
        // that must surface, not be masked as an empty list.
        const state = { ...emptyState, root: { '.cas': [vec8(0x2An)] } }
        let threw = false
        try { virtual(state)(main(makeOptions(['list']))) } catch { threw = true }
        if (!threw) { throw 'expected list to surface the storage error' }
    },
    mainNoCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions([])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    mainUnknownCmd: () => {
        const [finalState, exitCode] = virtual(emptyState)(main(makeOptions(['bogus'])))
        if (exitCode !== 1) { throw ['expected exit 1', exitCode] }
        if (finalState.stderr.length === 0) { throw 'expected error in stderr' }
    },
    casWriteRead: () => {
        // Round-trip a single-chunk payload through the real streaming CAS: `write` returns
        // the content hash, and `read` streams the same bytes back as `ok` chunk items.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const payload: ListEffect<FileCasOperation, IoResult<Vec>> =
            listEffectCons(ok(content), listEffectEnd())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        if (writeResult[0] !== 'ok') { throw ['expected write ok', writeResult] }
        const hash = writeResult[1]
        if (length(hash) !== 256n) { throw ['expected 256-bit hash', length(hash)] }
        if (msb.cmp(hash)(computeSync(sha256)([content])) !== 0) { throw 'write hash mismatch' }
        const drain = (acc: readonly Vec[]) =>
            (stream: ListEffect<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                stream.step((node): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    if (node === undefined) { return pure(ok(acc)) }
                    const [item, rest] = node
                    if (item[0] === 'error') { return pure(item) }
                    return drain([...acc, item[1]])(rest)
                })
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        if (readResult[0] !== 'ok') { throw ['expected read ok', readResult] }
        if (msb.cmp(msb.listToVec(readResult[1]))(content) !== 0) { throw 'read content mismatch' }
    },
    casReadMissingShard: () => {
        // A missing shard surfaces as an explicit error *item*, never as end-of-stream.
        const c = fileCas(sha256)('.')
        const hash = computeSync(sha256)([vec8(0x2An)])
        const [, node] = virtual(emptyState)(c.read(hash))
        if (node === undefined) { throw 'missing shard must not be EOF' }
        if (node[0][0] !== 'error') { throw ['expected error item', node[0]] }
    },
    casWriteMultiChunk: () => {
        // A multi-chunk payload streams through `writeBytes` chunk-by-chunk (the lease is
        // renewed between chunks); the hash equals the SHA-256 of the concatenated bytes,
        // and read streams the same content back.
        const chunks = [vec8(0x11n), vec8(0x22n), vec8(0x33n)] as const
        const c = fileCas(sha256)('.')
        const payload: ListEffect<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<ListEffect<FileCasOperation, IoResult<Vec>>>(
                (tail, chunk) => listEffectCons(ok(chunk), tail), listEffectEnd())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        if (writeResult[0] !== 'ok') { throw ['expected write ok', writeResult] }
        const hash = writeResult[1]
        if (msb.cmp(hash)(computeSync(sha256)(chunks)) !== 0) { throw 'multi-chunk write hash mismatch' }
        const drain = (acc: readonly Vec[]) =>
            (stream: ListEffect<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                stream.step((node): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    if (node === undefined) { return pure(ok(acc)) }
                    const [item, rest] = node
                    if (item[0] === 'error') { return pure(item) }
                    return drain([...acc, item[1]])(rest)
                })
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        if (readResult[0] !== 'ok') { throw ['expected read ok', readResult] }
        const expected = msb.concat(msb.concat(chunks[0])(chunks[1]))(chunks[2])
        if (msb.cmp(msb.listToVec(readResult[1]))(expected) !== 0) { throw 'multi-chunk read content mismatch' }
    },
    casWriteDedup: () => {
        // Same content ⇒ same hash; the second upload's replace-`rename` publishes over the
        // first, leaving exactly one shard in the store.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const payload = (): ListEffect<FileCasOperation, IoResult<Vec>> =>
            listEffectCons(ok(content), listEffectEnd())
        const [state1, w1] = virtual(emptyState)(c.write(payload()))
        const [state2, w2] = virtual(state1)(c.write(payload()))
        if (w1[0] !== 'ok' || w2[0] !== 'ok') { throw ['expected both writes ok', w1, w2] }
        if (msb.cmp(w1[1])(w2[1]) !== 0) { throw 'dedup hash mismatch' }
        const [, hashes] = virtual(state2)(c.list())
        if (hashes.length !== 1) { throw ['expected one shard after dedup', hashes.length] }
    },
    casWriteErrorItemAborts: () => {
        // An error item mid-stream deletes the partial staging file and fails; nothing is
        // published, so the store stays empty.
        const c = fileCas(sha256)('.')
        const okItem: IoResult<Vec> = ok(vec8(0x11n))
        const errItem: IoResult<Vec> = error({ code: 'BOOM' })
        const payload: ListEffect<FileCasOperation, IoResult<Vec>> =
            listEffectCons<FileCasOperation, IoResult<Vec>>(okItem,
                listEffectCons<FileCasOperation, IoResult<Vec>>(errItem, listEffectEnd()))
        const [state1, result] = virtual(emptyState)(c.write(payload))
        if (result[0] !== 'error') { throw ['expected write error', result] }
        const [, hashes] = virtual(state1)(c.list())
        if (hashes.length !== 0) { throw ['expected nothing published on abort', hashes] }
    },
    casWriteReadExceedsMaxLength: () => {
        // The point of streaming: a payload larger than a single `Vec`'s `maxLength`
        // (128 KiB) must round-trip. `write` lands the chunks on disk without ever
        // holding them as one `Vec`, and `read` streams them back the same way — so the
        // round-trip is verified by hashing the read stream incrementally rather than
        // concatenating it (which would itself overflow `maxLength`).
        const big = vec(maxLength)(0xABn)   // one full-size chunk: exactly maxLength bits
        const tail = vec8(0x2An)            // one more byte ⇒ total > maxLength
        const chunks = [big, tail] as const
        const c = fileCas(sha256)('.')
        const payload: ListEffect<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<ListEffect<FileCasOperation, IoResult<Vec>>>(
                (tl, chunk) => listEffectCons(ok(chunk), tl), listEffectEnd())
        const [state1, w] = virtual(emptyState)(c.write(payload))
        if (w[0] !== 'ok') { throw ['expected write ok', w] }
        const hash = w[1]
        if (msb.cmp(hash)(computeSync(sha256)(chunks)) !== 0) { throw 'oversized write hash mismatch' }
        // Fold the read stream straight into a fresh SHA-2 state — never one `Vec`.
        const rehash = (state: typeof sha256.init) =>
            (stream: ListEffect<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<Vec>> =>
                stream.step((node): Effect<FileCasOperation, IoResult<Vec>> => {
                    if (node === undefined) { return pure(ok(sha256.end(state))) }
                    const [item, rest] = node
                    if (item[0] === 'error') { return pure(item) }
                    return rehash(sha256.append(item[1])(state))(rest)
                })
        const [, readBack] = virtual(state1)(rehash(sha256.init)(c.read(hash)))
        if (readBack[0] !== 'ok') { throw ['expected read ok', readBack] }
        if (msb.cmp(readBack[1])(hash) !== 0) { throw 'oversized read-back hash mismatch' }
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
        const [state1, w] = virtual(state0)(c.write(listEffectCons(ok(content), listEffectEnd())))
        if (w[0] !== 'ok') { throw ['expected write ok', w] }
        const [, present] = virtual(state1)(access(stalePath))
        if (present[0] !== 'error') { throw 'expected GC to reclaim the expired staging file' }
    },
    casUploadSuccess: () => {
        // A successful upload returns the hash and deletes the source file from cas_upload/.
        const content = vec8(0x2An)
        const state0 = { ...emptyState, root: { 'cas_upload': { 'myfile': [content] } } }
        const [state1, result] = virtual(state0)(casUpload('.')('myfile'))
        if (result[0] !== 'ok') { throw ['expected casUpload ok', result] }
        if (length(result[1]) !== 256n) { throw ['expected 256-bit hash', length(result[1])] }
        // Source must be deleted after successful publish.
        const srcPath = join('.', 'cas_upload', 'myfile')
        const [, srcAccess] = virtual(state1)(access(srcPath))
        if (srcAccess[0] !== 'error') { throw 'expected source to be deleted after successful upload' }
    },
    casUploadFailureKeepsSource: () => {
        // A missing source file causes write to fail; casUpload returns error and the
        // source is left in place (trivially: it was never there, but the upload is not published).
        const state0 = { ...emptyState, root: {} }
        const [state1, result] = virtual(state0)(casUpload('.')('nonexistent'))
        if (result[0] !== 'error') { throw ['expected casUpload to fail on missing source', result] }
        // Nothing published to the store.
        const c = fileCas(sha256)('.')
        const [, hashes] = virtual(state1)(c.list())
        if (hashes.length !== 0) { throw ['expected nothing published on failed upload', hashes] }
    },
}
