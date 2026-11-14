/**
 * @import { Effect } from '../../effects/types.ts'
 * @import { FileCasOperation } from '../../cas/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { Cache } from '../../cas/evo/types.ts'
 * @import { Key } from '../../effects/memory/types.ts'
 * @import { ToolsCallResult } from '../../protocol/mcp/types.ts'
 */

import { casToolRegistry } from './module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { ioError } from '../../effects/node/module.f.js'
import { maxLengthBytes, vec, vec8 } from '../../types/bit_vec/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.js'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.js'
import { tryUtf8 } from '../../text/module.f.js'
import { number as rttiNumber, string as rttiString } from '../../rtti/module.f.js'
import { parse as rttiParse } from '../../rtti/parse/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { fileCas } from '../../cas/module.f.js'
import { _driveCas } from '../../cas/proof.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.js'

/**
 * Drives a `FileCasOperation | MemOp` effect with `fjs/cas/proof.f.mjs`'s
 * synthetic driver, adding `MemOp`'s always-succeeds answers since `cas_add`
 * also touches the Evo cache on its success path.
 *
 * `cas_add`'s write-failure branch and `cas_get`'s "hash vanished between
 * reads" branches are real only under a race (a failing disk, a concurrent
 * writer, a GC sweep) between two of the tool's own steps — the same shape of
 * branch the CAS proof reaches with the same driver, applied here one layer up
 * at the MCP tool boundary.
 *
 * The result is unwrapped: a tool handler answers
 * `Effect<…, ToolsCallResult, never>`, having absorbed its failures into
 * `isError`, so callers want the answer rather than the `ok` around it. The
 * `never` channel is what makes that unwrap total.
 *
 * @type {(overrides: Partial<Record<string, readonly unknown[]>>) => <T>(e: Effect<FileCasOperation | MemOp, T, never>) => T}
 */
const drive = overrides => {
    /** @type {{ readonly [K in MemOp[0]]: unknown }} */
    const memDefaults = {
        memCreate: ok('mem-key'),
        memRead: ok(undefined),
        memWrite: ok(undefined),
    }
    const driver = _driveCas(memDefaults)(overrides)
    return e => unwrap(driver(e)[0])
}

// These writes store ordinary text or binary rather than revisions, so
// `syncRevision` leaves the Evo cache untouched and the key is not read.
const cacheKey = /** @type {Key<Cache>} */ (/** @type {any} */ ('unused-cache-key'))

const registry = casToolRegistry(fileCas(sha256)('.'))(cacheKey)

/** @type {(name: string) => (args: any) => Effect<FileCasOperation | MemOp, ToolsCallResult, never>} */
const toolHandle = name => {
    const entry = registry.find(t => t.name === name)
    assert(entry !== undefined, `no such tool: ${name}`)
    return /** @type {NonNullable<typeof entry>} */ (entry).handle
}

// Any well-formed cBase32 hash works: none of these cases resolve it against a
// real store, since every filesystem op is driven synthetically.
const someHash = vecToCBase32(vec(256n)(0n))

const meta = /** @type {const} */ ({
    length: rttiNumber,
    mimeType: rttiString,
    type: rttiString,
    uri: rttiString,
})
const parseMeta = rttiParse(meta)

/** @type {(result: ToolsCallResult) => string} */
const textOf = result => {
    const [item] = result.content
    assert(item.type === 'text')
    return item.text
}

export const proof = {
    casAddAcceptsTextAndBase64: () => {
        for (const args of /** @type {const} */ ([{ content: 'A' }, { content: 'QQ==', type: 'base64' }])) {
            const result = drive({ stat: [ok({ size: 1 })] })(toolHandle('cas_add')(args))
            assert(result.isError !== true, result)
            // SHA-256 of the single byte 0x41, independently of its input encoding.
            const expected = vec(256n)(0x559a_ead0_8264_d579_5d39_0971_8cdd_05ab_d495_72e8_4fe5_5590_eef3_1a88_a08f_dffdn)
            assertEq(textOf(result), vecToCBase32(expected))
        }
    },
    casAddRejectsMalformedBase64: () => {
        const result = drive({})(toolHandle('cas_add')({ content: '!', type: 'base64' }))
        assertEq(result.isError, true)
        assert(textOf(result).includes('too large or malformed'))
    },
    casGetRejectsMalformedOrMissingHashes: () => {
        const malformed = drive({})(toolHandle('cas_get')({ hash: '!' }))
        assertEq(malformed.isError, true)
        assert(textOf(malformed).includes('invalid cBase32 hash'))
        const missing = drive({ readBytes: [error(ioError({ message: 'absent' }))] })
            (toolHandle('cas_get')({ hash: someHash }))
        assertEq(missing.isError, true)
        assert(textOf(missing).includes('no such hash'))
    },
    casGetReturnsMetadataAndInlineTextOrBinary: () => {
        for (const [byte, type, payload] of /** @type {const} */ ([[0x41n, 'text', 'A'], [0xffn, 'base64', '/w==']])) {
            for (const content of /** @type {const} */ ([false, true])) {
                const result = drive({ readBytes: [ok(vec8(byte)), ok(vec(0n)(0n)), ok(vec8(byte)), ok(vec(0n)(0n))] })
                    (toolHandle('cas_get')({ hash: someHash, content }))
                assert(result.isError !== true, result)
                const parsed = unwrap(parseJson(textOf(result)))
                assert(parsed !== null && typeof parsed === 'object' && !(parsed instanceof Array))
                assertEq(parsed.length, 1)
                assertEq(parsed.type, type)
                assertEq(parsed.mimeType, type === 'text' ? 'text/plain' : 'application/octet-stream')
                assertEq(parsed.uri, `cas:${someHash}`)
                assertEq(parsed.text, content && type === 'text' ? payload : undefined)
                assertEq(parsed.blob, content && type === 'base64' ? payload : undefined)
            }
        }
    },
    casGetOversizedTextReturnsMetadataButRefusesInlineContent: () => {
        const chunk = assertNotNullish(tryUtf8('A'.repeat(Number(maxLengthBytes))))
        for (const content of /** @type {const} */ ([false, true])) {
            const result = drive({ readBytes: [ok(chunk), ok(vec8(0x41n)), ok(vec(0n)(0n))] })
                (toolHandle('cas_get')({ hash: someHash, content }))
            if (content) {
                assertEq(result.isError, true)
                assert(textOf(result).includes('blob too large to fetch inline'))
                assert(textOf(result).includes(`get ${someHash} <path>`))
            } else {
                assert(result.isError !== true, result)
                const parsed = unwrap(parseMeta(unwrap(parseJson(textOf(result)))))
                assertEq(parsed.length, Number(maxLengthBytes) + 1)
                assertEq(parsed.type, 'text')
            }
        }
    },
    casListEmptyStoreReturnsEmptyText: () => {
        const result = drive({})(toolHandle('cas_list')({}))
        assert(result.isError !== true, result)
        assertEq(textOf(result), '')
    },
    // cas_list: a store that exists but cannot be walked is a tool-level error
    // carrying the host's own words — neither a panic (which is what it used
    // to be, one `unwrap` deep) nor an empty listing, which would tell the
    // client the store holds nothing.
    casListStorageErrorReturnsError: () => {
        const result = drive({ access: [error(ioError({ code: 'EACCES', message: 'permission denied' }))] })(toolHandle('cas_list')({}))
        assert(result.isError === true, ['expected isError', result])
    },
    // cas_add: a writeBytes failure mid-upload (disk full, permissions) is
    // reported as a tool-level error, not a thrown exception or a silent
    // success.
    casAddWriteErrorReturnsError: () => {
        const result = drive({ writeBytes: [error(ioError({ message: 'disk full' }))] })(toolHandle('cas_add')({ content: 'hello' }))
        assert(result.isError === true, ['expected isError', result])
    },
    // cas_get, content:false: the streaming metadata pass finds a small
    // whole-blob-text hash, so it starts a second, independent read to refine
    // `mimeType` via the dialect-aware detector. If that second read finds the
    // hash gone (a GC sweep raced it away), the code falls back to the
    // streaming verdict rather than fail the whole request.
    casGetMetadataRefineHashVanishesFallsBackToStreamingVerdict: () => {
        const result = drive({ readBytes: [ok(vec8(0x41n)), ok(vec(0n)(0n)), error(ioError({ message: 'vanished' }))] })
            (toolHandle('cas_get')({ hash: someHash, content: false }))
        assert(result.isError !== true, ['expected ok result', result])
        const text = result.content[0]
        assert(text.type === 'text', ['expected text content', text])
        const parsed = unwrap(parseMeta(unwrap(parseJson(text.text))))
        assertEq(parsed.type, 'text')
        assertEq(parsed.mimeType, 'text/plain')
        assertEq(parsed.length, 1)
    },
    // cas_get, content:true: the streaming metadata pass succeeds and the blob
    // fits inline, so a second read materializes it. If that second read finds
    // the hash gone, the whole request fails — there is no streaming verdict
    // to fall back to once inline content was actually promised.
    casGetContentFetchHashVanishesReturnsError: () => {
        const result = drive({ readBytes: [ok(vec8(0x41n)), ok(vec(0n)(0n)), error(ioError({ message: 'vanished' }))] })
            (toolHandle('cas_get')({ hash: someHash, content: true }))
        assert(result.isError === true, ['expected isError', result])
        const text = result.content[0]
        assert(text.type === 'text' && text.text.includes('no such hash'), ['expected no-such-hash message', text])
    },
}
