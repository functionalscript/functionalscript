/**
 * @import { Effect } from '../../effects/io/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { FileCasOperation } from '../../cas/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { Cache } from '../../cas/evo/types.ts'
 * @import { Key } from '../../effects/memory/types.ts'
 * @import { ToolsCallResult } from '../../protocol/mcp/types.ts'
 */

import { casToolRegistry } from './module.f.mjs'
import { match } from '../../effects/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { ioError } from '../../effects/node/module.f.mjs'
import { vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { number as rttiNumber, string as rttiString } from '../../types/rtti/module.f.mjs'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { parse as parseJson } from '../../media/json/module.f.mjs'

// A harmless "always succeeds" response for a command, used by `drive` once a
// test's overrides for that command are exhausted — same technique as
// `fjs/cas/proof.f.mjs`'s `drive`, extended with `MemOp` since `cas_add` also
// touches the Evo cache on its success path.
/** @type {(cmd: string) => unknown} */
const defaultResponse = cmd => {
    switch (cmd) {
        case 'now': return ok(0)
        case 'randomInt': return ok(0)
        case 'mkdir': case 'createExclusive': case 'rename': case 'rm':
        case 'writeBytes': case 'access':
            return ok(undefined)
        case 'readdir': return ok(/** @type {readonly unknown[]} */ ([]))
        case 'stat': return ok({ size: 0 })
        // An empty chunk reads as end-of-stream, so a `readBytes` call with no
        // override reads as an immediately-empty file by default.
        case 'readBytes': return ok(vec(0n)(0n))
        case 'memCreate': return ok(/** @type {unknown} */ ('mem-key'))
        case 'memRead': return ok(undefined)
        case 'memWrite': return ok(undefined)
        default: return ok(undefined)
    }
}

/**
 * Drives a `FileCasOperation | MemOp` effect to completion with synthetic op
 * responses instead of a filesystem. `overrides[cmd]` is a queue consumed in
 * call order; once a command's queue is empty (or was never given),
 * `defaultResponse` supplies an always-succeeds value.
 *
 * `cas_add`'s write-failure branch and `cas_get`'s "hash vanished between
 * reads" branches are real only under a race (a failing disk, a concurrent
 * writer, a GC sweep) between two of the tool's own steps — the same shape of
 * branch `fjs/cas/proof.f.mjs` reaches with its own `drive` helper, applied
 * here one layer up at the MCP tool boundary.
 *
 * The result is unwrapped: a tool handler answers
 * `Effect<…, ToolsCallResult, never>`, having absorbed its failures into
 * `isError`, so callers want the answer rather than the `ok` around it. The
 * `never` channel is what makes that unwrap total.
 *
 * @type {(overrides: Partial<Record<string, unknown[]>>) => (e: Effect<FileCasOperation | MemOp, unknown, never>) => unknown}
 */
const drive = overrides => {
    /** @type {(cmd: string) => unknown} */
    const next = cmd => {
        const queue = overrides[cmd]
        return queue !== undefined && queue.length > 0 ? queue.shift() : defaultResponse(cmd)
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
        memCreate: () => next('memCreate'),
        memRead: () => next('memRead'),
        memWrite: () => next('memWrite'),
    })
    const matcher = match(handlers)
    /** @type {(e: Effect<FileCasOperation | MemOp, unknown, unknown>) => Result<unknown, unknown>} */
    const run_ = e => {
        const m = matcher(e)
        return m[0] === 'done' ? m[1] : run_(m[2](/** @type {any} */ (m[1])))
    }
    return e => unwrap(run_(e))
}

// `syncRevision` is only reached on a *successful* write, which none of these
// cases exercise, so the cache key's actual identity never matters — only its
// type does.
const cacheKey = /** @type {Key<Cache>} */ (/** @type {any} */ ('unused-cache-key'))

const registry = casToolRegistry('.')(cacheKey)

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
        const result = /** @type {ToolsCallResult} */ (
            drive({ access: [error(ioError({ code: 'EACCES', message: 'permission denied' }))] })(toolHandle('cas_list')({}))
        )
        assert(result.isError === true, ['expected isError', result])
    },
    // cas_add: a writeBytes failure mid-upload (disk full, permissions) is
    // reported as a tool-level error, not a thrown exception or a silent
    // success.
    casAddWriteErrorReturnsError: () => {
        const result = /** @type {ToolsCallResult} */ (
            drive({ writeBytes: [error(ioError({ message: 'disk full' }))] })(toolHandle('cas_add')({ content: 'hello' }))
        )
        assert(result.isError === true, ['expected isError', result])
    },
    // cas_get, content:false: the streaming metadata pass finds a small
    // whole-blob-text hash, so it starts a second, independent read to refine
    // `mimeType` via the dialect-aware detector. If that second read finds the
    // hash gone (a GC sweep raced it away), the code falls back to the
    // streaming verdict rather than fail the whole request.
    casGetMetadataRefineHashVanishesFallsBackToStreamingVerdict: () => {
        const result = /** @type {ToolsCallResult} */ (
            drive({ readBytes: [ok(vec8(0x41n)), ok(vec(0n)(0n)), error(ioError({ message: 'vanished' }))] })
                (toolHandle('cas_get')({ hash: someHash, content: false }))
        )
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
        const result = /** @type {ToolsCallResult} */ (
            drive({ readBytes: [ok(vec8(0x41n)), ok(vec(0n)(0n)), error(ioError({ message: 'vanished' }))] })
                (toolHandle('cas_get')({ hash: someHash, content: true }))
        )
        assert(result.isError === true, ['expected isError', result])
        const text = result.content[0]
        assert(text.type === 'text' && text.text.includes('no such hash'), ['expected no-such-hash message', text])
    },
}
