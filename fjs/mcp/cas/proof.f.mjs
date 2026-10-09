/**
 * @import { Effect } from '../../effects/types.ts'
 * @import { FileCasOperation } from '../../cas/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { Cache } from '../../cas/evo/types.ts'
 * @import { Key } from '../../effects/memory/types.ts'
 * @import { ToolsCallResult } from '../../protocol/mcp/types.ts'
 */

import { casToolRegistry } from './module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { ioError } from '../../effects/node/module.f.mjs'
import { vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { number as rttiNumber, string as rttiString } from '../../rtti/module.f.mjs'
import { parse as rttiParse } from '../../rtti/parse/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { fileCas } from '../../cas/module.f.mjs'
import { _driveCas } from '../../cas/proof.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.mjs'

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

// `syncRevision` is only reached on a *successful* write, which none of these
// cases exercise, so the cache key's actual identity never matters — only its
// type does.
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

export const proof = {
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
