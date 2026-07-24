import { length, maxLength, msb, vec, vec8, type Vec } from '../types/bit_vec/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../basen/cbase32/module.f.ts'
import { computeSync, sha256 } from '../crypto/sha2/module.f.ts'
import { fileCas, casAddFile, collectRead, type FileCasOperation, casUpload } from './module.f.ts'
import { eff, decode, pure, type Effect } from '../effects/module.f.ts'
import { mkdir, writeFile, rm, readFile, type ReadFile, type WriteFile, type Rm, type Mkdir, type IoResult, access } from '../effects/node/module.f.ts'
import { error, ok, type Ok } from '../types/result/module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { join } from '../path/module.f.ts'
import { nonEmpty, empty, type List } from '../effects/list/module.f.ts'
import { assert, assertEq, assertNotNullish } from '../asserts/module.f.ts'

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
    eff(mkdir(testDir, { recursive: true })).step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return eff(writeFile(bigFilePath, bigContent)).step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return eff(casAddFile(cas)(bigFilePath)).step(addRes => {
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
                assertNotNullish(cBase32ToVec(hashCBase32), new Error('Failed to decode hash from base32'))

                return eff(rm(testDir)).step(() => pure(undefined)).value
            }).value
        }).value
    }).value

// Test adding and retrieving a big file
const testAddAndGetBigFile = (): Effect<TestOp, void> =>
    eff(mkdir(testDir, { recursive: true })).step(() => {
        const bigContent = createBigFileContent()
        const bigFilePath = `${testDir}/big-file.bin`

        return eff(writeFile(bigFilePath, bigContent)).step(writeRes => {
            if (writeRes[0] === 'error') {
                throw new Error(`Failed to write test file: ${writeRes[1]}`)
            }

            const cas = fileCas(sha256)(testDir)
            return eff(casAddFile(cas)(bigFilePath)).step(addRes => {
                if (addRes[0] === 'error') {
                    throw new Error(`Failed to add file to CAS: ${addRes[1]}`)
                }

                const hash = addRes[1]
                const storedPath = cas.url(hash)

                // Verify file is stored at the expected location
                return eff(readFile(storedPath)).step(readRes => {
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

                    return eff(rm(testDir)).step(() => pure(undefined)).value
                }).value
            }).value
        }).value
    }).value

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
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(length(hash), 256n, ['expected 256-bit hash', length(hash)])
        assertEq(msb.cmp(hash)(computeSync(sha256)([content])), 0, 'write hash mismatch')
        const drain = (acc: readonly Vec[]) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                eff(stream).step((node): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    if (node === undefined) { return pure(ok(acc)) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return drain([...acc, first[1]])(tail)
                }).value
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
        const chunks = [vec8(0x11n), vec8(0x22n), vec8(0x33n)] as const
        const c = fileCas(sha256)('.')
        const payload: List<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<List<FileCasOperation, IoResult<Vec>>>(
                (tail, chunk) => nonEmpty(ok(chunk), tail), empty())
        const [state1, writeResult] = virtual(emptyState)(c.write(payload))
        assert(writeResult[0] === 'ok', ['expected write ok', writeResult])
        const hash = writeResult[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'multi-chunk write hash mismatch')
        const drain = (acc: readonly Vec[]) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<readonly Vec[]>> =>
                eff(stream).step((node): Effect<FileCasOperation, IoResult<readonly Vec[]>> => {
                    if (node === undefined) { return pure(ok(acc)) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return drain([...acc, first[1]])(tail)
                }).value
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
        const payload = (): List<FileCasOperation, IoResult<Vec>> =>
            nonEmpty(ok(content), empty())
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
        const okItem: IoResult<Vec> = ok(vec8(0x11n))
        const errItem: IoResult<Vec> = error({ code: 'BOOM' })
        const payload: List<FileCasOperation, IoResult<Vec>> =
            nonEmpty<FileCasOperation, IoResult<Vec>>(okItem,
                nonEmpty<FileCasOperation, IoResult<Vec>>(errItem, empty()))
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
        const chunks = [big, tail] as const
        const c = fileCas(sha256)('.')
        const payload: List<FileCasOperation, IoResult<Vec>> =
            chunks.reduceRight<List<FileCasOperation, IoResult<Vec>>>(
                (tl, chunk) => nonEmpty(ok(chunk), tl), empty())
        const [state1, w] = virtual(emptyState)(c.write(payload))
        assert(w[0] === 'ok', ['expected write ok', w])
        const hash = w[1]
        assertEq(msb.cmp(hash)(computeSync(sha256)(chunks)), 0, 'oversized write hash mismatch')
        // Fold the read stream straight into a fresh SHA-2 state — never one `Vec`.
        const rehash = (state: typeof sha256.init) =>
            (stream: List<FileCasOperation, IoResult<Vec>>): Effect<FileCasOperation, IoResult<Vec>> =>
                eff(stream).step((node): Effect<FileCasOperation, IoResult<Vec>> => {
                    if (node === undefined) { return pure(ok(sha256.end(state))) }
                    const { first, tail } = node
                    if (first[0] === 'error') { return pure(first) }
                    return rehash(sha256.append(first[1])(state))(tail)
                }).value
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
        const x = c.write(nonEmpty(ok(content), empty<never, Ok<Vec>>()))
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
        const x = c.write(nonEmpty(ok(content), empty<never, Ok<Vec>>()))
        const [state1, w] = virtual(state0)(x)
        assert(w[0] === 'ok', ['expected write ok', w])
        const [, present] = virtual(state1)(access(livePath))
        assert(present[0] === 'ok', 'expected GC to leave the live staging file alone')
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
        const stream: List<never, IoResult<Vec>> =
            nonEmpty<never, IoResult<Vec>>(ok(vec8(0x11n)), nonEmpty<never, IoResult<Vec>>(ok(vec8(0x22n)), empty()))
        const d = decode(collectRead(stream))
        assert(d.done, 'expected collectRead to finish without issuing a command')
        assertEq(d.result[0], 'ok')
    },
    collectReadPropagatesErrorItem: () => {
        // An error item mid-stream short-circuits collectRead with that same error.
        const boom: IoResult<Vec> = error('boom')
        const stream: List<never, IoResult<Vec>> =
            nonEmpty<never, IoResult<Vec>>(ok(vec8(0x11n)), nonEmpty<never, IoResult<Vec>>(boom, empty()))
        const d = decode(collectRead(stream))
        assert(d.done, 'expected collectRead to finish without issuing a command')
        assertEq(d.result[0], 'error')
        assertEq(d.result[1], 'boom')
    },
    // A single `Vec` cannot exceed `maxLength` bits — feed a pure stream whose second
    // chunk pushes the running total just over the limit so the overflow guard fires
    // without any real I/O.
    collectReadOverflow: () => {
        const half = maxLength / 2n
        const v1 = vec(half)(0n)
        const v2 = vec(half + 1n)(0n)
        const stream: List<never, IoResult<Vec>> =
            nonEmpty<never, IoResult<Vec>>(ok(v1), nonEmpty<never, IoResult<Vec>>(ok(v2), empty()))
        const d = decode(collectRead(stream))
        assert(d.done, 'expected collectRead to finish without issuing a command')
        assertEq(d.result[0], 'error')
    },
    casListPropagatesNonNotFoundAccessError: () => {
        // A non-ENOENT `access` failure (permissions, corruption) is a genuine storage
        // error and must propagate out of `list`, not be swallowed as an empty store.
        const c = fileCas(sha256)('.')
        const boom = { code: 'EACCES' }
        const d = decode(c.list())
        assert(!d.done, 'expected list() to issue an access command first')
        assertEq(d.command, 'access')
        const continuation = d.continuation as (r: IoResult<void>) => Effect<FileCasOperation, readonly Vec[]>
        let threw: unknown
        try {
            continuation(error(boom))
        } catch (e) {
            threw = e
        }
        assertEq(threw, boom)
    },
}
