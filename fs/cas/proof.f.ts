import { length, maxLength, msb, vec, vec8, type Vec } from '../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../cbase32/module.f.ts'
import { computeSync, sha256 } from '../crypto/sha2/module.f.ts'
import { fileCas, casAddFile, type FileCasOperation, casUpload } from './module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { mkdir, writeFile, rm, readFile, type ReadFile, type WriteFile, type Rm, type Mkdir, type IoResult, access } from '../effects/node/module.f.ts'
import { error, ok, type Ok } from '../types/result/module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { join } from '../path/module.f.ts'
import { nonEmpty, empty, type List } from '../effects/list/module.f.ts'

const testDir = './test-cas-cli'

type TestOp = FileCasOperation | WriteFile | ReadFile | Rm | Mkdir

// Create a 128 KiB big file content (at the max Vec size limit)
// This tests the boundary where files are at the chunk size limit
const createBigFileContent = (): Vec => {
    const byteCount = 128n * 1024n // 128 KiB
    // Create a repeating pattern: 0x42 repeated across the file
    return vec(byteCount * 8n)(0x42424242n)
}

// Test adding a big file and verifying the hash
const testAddBigFile = (): Effect<TestOp, void> =>
    mkdir(testDir, { recursive: true }).step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return writeFile(bigFilePath, bigContent).step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return casAddFile(cas)(bigFilePath).step(addRes => {
                if (addRes[0] === 'error') {
                    throw new Error(`Failed to add file to CAS: ${addRes[1]}`)
                }

                const hash = addRes[1]

                // Verify hash is 256 bits (SHA-256)
                if (length(hash) !== 256n) {
                    throw new Error(`Expected hash length 256 bits, got ${length(hash)}`)
                }

                // Verify hash can be encoded/decoded
                const hashCBase32 = vecToCBase32(hash)
                const decodedHash = cBase32ToVec(hashCBase32)
                if (decodedHash === null) {
                    throw new Error('Failed to decode hash from base32')
                }

                return rm(testDir).step(() => pure(undefined))
            })
        })
    })

// Test adding and retrieving a big file
const testAddAndGetBigFile = (): Effect<TestOp, void> =>
    mkdir(testDir, { recursive: true })
    .step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return writeFile(bigFilePath, bigContent)
        .step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return casAddFile(cas)(bigFilePath)
            .step(addRes => {
                if (addRes[0] === 'error') {
                    throw new Error(`Failed to add file to CAS: ${addRes[1]}`)
                }

                const hash = addRes[1]
                const storedPath = cas.url(hash)

                // Verify file is stored at the expected location
                return readFile(storedPath).step(readRes => {
                    if (readRes[0] === 'error') {
                        throw new Error(`Failed to read stored file: ${readRes[1]}`)
                    }

                    const storedContent = readRes[1]

                    // Verify content is the same size as original
                    const storedLen = length(storedContent)
                    const originalLen = length(bigContent)
                    if (storedLen !== originalLen) {
                        throw new Error(
                            `Content size mismatch: stored ${storedLen} bits, expected ${originalLen} bits`
                        )
                    }

                    return rm(testDir).step(() => pure(undefined))
                })
            })
        })
    })

export const proof = {
    addBigFile: testAddBigFile,
    addAndGetBigFile: testAddAndGetBigFile,
    //
    casWriteRead: () => {
        // Round-trip a single-chunk payload through the real streaming CAS: `write` returns
        // the content hash, and `read` streams the same bytes back as `ok` chunk items.
        const content = vec8(0x2An)
        const c = fileCas(sha256)('.')
        const payload: List<FileCasOperation, IoResult<Vec>> =
            nonEmpty(ok(content), empty())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        if (writeResult[0] !== 'ok') { throw ['expected write ok', writeResult] }
        const hash = writeResult[1]
        if (length(hash) !== 256n) { throw ['expected 256-bit hash', length(hash)] }
        if (msb.cmp(hash)(computeSync(sha256)([content])) !== 0) { throw 'write hash mismatch' }
        const drain = (acc: readonly Vec[]) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                stream.step((nodeThunk): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    const node = nodeThunk()
                    if (node === undefined) { return pure(ok(acc)) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return drain([...acc, first[1]])(tail)
                })
        const [, readResult] = virtual(state1)(drain([])(c.read(hash)))
        if (readResult[0] !== 'ok') { throw ['expected read ok', readResult] }
        if (msb.cmp(msb.listToVec(readResult[1]))(content) !== 0) { throw 'read content mismatch' }
    },
    casReadMissingShard: () => {
        // A missing shard surfaces as an explicit error *item*, never as end-of-stream.
        const c = fileCas(sha256)('.')
        const hash = computeSync(sha256)([vec8(0x2An)])
        const node = virtual(emptyState)(c.read(hash))[1]()
        if (node === undefined) { throw 'missing shard must not be EOF' }
        if (node.first[0] !== 'error') { throw ['expected error item', node.tail] }
    },
    casWriteMultiChunk: () => {
        // A multi-chunk payload streams through `writeBytes` chunk-by-chunk (the lease is
        // renewed between chunks); the hash equals the SHA-256 of the concatenated bytes,
        // and read streams the same content back.
        const chunks = [vec8(0x11n), vec8(0x22n), vec8(0x33n)] as const
        const c = fileCas(sha256)('.')
        const payload: List<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<List<FileCasOperation, IoResult<Vec>>>(
                (tail, chunk) => nonEmpty(ok(chunk), tail), empty())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        if (writeResult[0] !== 'ok') { throw ['expected write ok', writeResult] }
        const hash = writeResult[1]
        if (msb.cmp(hash)(computeSync(sha256)(chunks)) !== 0) { throw 'multi-chunk write hash mismatch' }
        const drain = (acc: readonly Vec[]) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                stream.step((nodeThunk): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    const node = nodeThunk()
                    if (node === undefined) { return pure(ok(acc)) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return drain([...acc, first[1]])(tail)
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
        const payload = (): List<FileCasOperation, IoResult<Vec>> =>
            nonEmpty(ok(content), empty())
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
        const payload: List<FileCasOperation, IoResult<Vec>> =
            nonEmpty<FileCasOperation, IoResult<Vec>>(okItem,
                nonEmpty<FileCasOperation, IoResult<Vec>>(errItem, empty()))
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
        const payload: List<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<List<FileCasOperation, IoResult<Vec>>>(
                (tl, chunk) => nonEmpty(ok(chunk), tl), empty())
        const [state1, w] = virtual(emptyState)(c.write(payload))
        if (w[0] !== 'ok') { throw ['expected write ok', w] }
        const hash = w[1]
        if (msb.cmp(hash)(computeSync(sha256)(chunks)) !== 0) { throw 'oversized write hash mismatch' }
        // Fold the read stream straight into a fresh SHA-2 state — never one `Vec`.
        const rehash = (state: typeof sha256.init) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<Vec>> =>
                stream.step((nodeThunk): Effect<FileCasOperation, IoResult<Vec>> => {
                    const node = nodeThunk()
                    if (node === undefined) { return pure(ok(sha256.end(state))) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return rehash(sha256.append(first[1])(state))(tail)
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
        const x = c.write(nonEmpty(ok(content), empty<never, Ok<Vec>>()))
        const [state1, w] = virtual(state0)(x)
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
