/**
 * MCP adapter for the content-addressable store.
 *
 * Maps `Cas<O>` operations onto MCP tools, so an agent that speaks MCP can
 * store a blob and get back its hash, fetch a blob by hash, and enumerate
 * what is stored — without shelling out to the `cas` CLI. The store itself
 * (`fs/cas/module.f.ts`) stays transport-agnostic; this is an additional
 * front end alongside the CLI `main`.
 *
 * ## Tools
 *
 * | Tool       | args                          | action           | result                              |
 * |------------|-------------------------------|------------------|-------------------------------------|
 * | `cas_add`  | `{ content, type? }`          | write/upload     | hash (cBase32)                      |
 * | `cas_get`  | `{ hash, content?: boolean }` | `c.read(key)`    | JSON `{length,mime_type,type[,content]}` |
 * | `cas_list` | `{}`                          | `c.list()`       | hashes, one per line                |
 *
 * ## `cas_add` input encoding
 *
 * The optional `type` field controls how `content` is interpreted:
 * - `'text'` (default, or omitted): `content` is a UTF-8 string stored as raw
 *   bytes. Most agent-generated content (scripts, JSON, prompts) can be stored
 *   without any encoding step.
 * - `'base64'`: `content` is RFC 4648 base64, decoded to bytes before storage.
 *   Use this for pre-encoded binary payloads.
 * - `'url'`: `content` is a filesystem path within `$HOME/cas_upload/`; the server
 *   moves the file via the streaming move-hash-move pipeline (no size limit).
 *   Paths outside `$HOME/cas_upload/` or containing `..` are rejected for security.
 *
 * ## `cas_get` output
 *
 * Always returns a JSON object `{ length, mime_type, type[, url][, content] }`.
 * `type` is always present (`'text'` or `'base64'`). When `content: true` is
 * requested, the inline payload is also included. Two-phase MIME detection
 * determines the encoding:
 *
 * 1. **Magic-byte sniffing** (`fs/mime` `detect`): PNG/JPEG/GIF/WebP/PDF/ZIP →
 *    `type: 'base64'` with the detected `mime_type`.
 * 2. **UTF-8 validation** (`fs/text/utf8` `fromVec`): valid UTF-8 →
 *    `type: 'text'`, `mime_type: 'text/plain'`.
 * 3. **Fallback**: `type: 'base64'`, `mime_type: 'application/octet-stream'`.
 *
 * When `content: false` (default), only `{ length, mime_type, type[, url] }` is
 * returned — no content transfer.
 *
 * ## Encoding split: hashes vs. content
 *
 * `Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` today.
 * **Hashes** travel as cBase32 (`fs/cbase32`) — the canonical CAS hash format,
 * shared with the CLI and the on-disk store layout. **Content** encoding is
 * determined at read time as described above.
 *
 * ## Error convention
 *
 * MCP draws a line the dispatcher already respects: *protocol* failures
 * (unknown method, malformed JSON-RPC params) are JSON-RPC errors handled by
 * `mcpStep`. *Tool* failures come back as a normal `tools/call` result with
 * `isError: true` and a text explanation, so the model can read and react:
 * - `type: 'base64'` with malformed content (base64 `decode` → `null`) → `isError`
 * - malformed `hash` (`cBase32ToVec` → `null`) → `isError`
 * - `cas_get` on an absent hash (`c.read` → `undefined`) → `isError`
 * - unknown tool `name` → `isError`
 *
 * @module
 */
import { string, option, or, boolean } from '../../types/rtti/module.f.ts'
import { stringify } from '../../json/module.f.ts'
import { pure, decode, type Effect, type Operation } from '../../effects/module.f.ts'
import { create, type MemOp } from '../../effects/memory/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../cbase32/module.f.ts'
import { decode as base64Decode, encode as base64Encode } from '../../base64/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { detect } from '../../mime/module.f.ts'
import { empty, length as bitVecLength, maxLength, msb, vec, type Vec } from '../../types/bit_vec/module.f.ts'
import { ok, error, type Ok } from '../../types/result/module.f.ts'
import { rm, type IoResult, type Read, type Rm, type Write } from '../../effects/node/module.f.ts'
import { stdioTransport } from '../../mcp/stdio/module.f.ts'
import {
    mcpStep, uninitializedState,
    toolEntry, fromRegistry, errorResult,
    type McpConfig, type McpHandlers, type ToolEntry,
    type ToolsCallResult,
} from '../../mcp/module.f.ts'
import { casAddFile, fileCas, type Cas, type FileCas, type FileCasOperation } from '../module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { nonEmpty, empty as elEmpty, type List } from '../../effects/list/module.f.ts'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `cas_add`: content to store, with optional encoding type. */
export const casAddArgs = {
    content: string,
    type: or('text' as const, 'base64' as const, 'url' as const, undefined)
} as const

/** Arguments for `cas_get`: the cBase32 hash to look up; optionally request inline content. */
export const casGetArgs = {
    hash: string,
    content: option(boolean)
} as const

/** Arguments for `cas_list`: none. */
export const casListArgs = {} as const

// ── Stream helper ────────────────────────────────────────────────────────────────

/**
 * Drains a CAS read stream into a single `Vec`. MCP needs the whole blob in hand
 * (MIME sniffing, UTF-8 validation, base64 encoding all inspect the full content),
 * so the chunk stream is concatenated; an error item is surfaced as the result.
 */
const collectRead = <O extends Operation>(stream: List<O, IoResult<Vec>>): Effect<O, IoResult<Vec>> => {
    const loop = (acc: Vec) => (s: List<O, IoResult<Vec>>): Effect<O, IoResult<Vec>> =>
        s.step((node): Effect<O, IoResult<Vec>> => {
            if (node === undefined) { return pure(ok(acc)) }
            const { first, tail } = node
            const [t, v] = first
            if (t === 'error') { return pure(first) }
            // A single `Vec` cannot exceed `maxLength` bits; concatenating past it would
            // overflow the runtime's `bigint` constraint. Surface that as an error item
            // so the tool reports a failure rather than crashing the process.
            if (bitVecLength(acc) + bitVecLength(v) > maxLength) {
                return pure(error(`cas blob exceeds maximum vector length of ${maxLength} bits`))
            }
            return loop(msb.concat(acc)(v))(tail)
        })
    return loop(empty)(stream)
}

// ── Tool registry ──────────────────────────────────────────────────────────────

const toJson = stringify(identity)

type Meta = {
    readonly length: number
    readonly mime_type: string
    readonly type: 'text' | 'base64'
    readonly url: string
}

/** Registry of all CAS tools. */
const casToolRegistry =
(home: string): readonly ToolEntry<FileCasOperation|Rm>[] => {
    const c = fileCas(sha256)(home)
    const casUploadDir = `${home}/cas_upload`
    return [
    toolEntry(
        'cas_add',
        'Store content and return its hash (cBase32). Pass type:"base64" for binary; type:"url" to stream a file from $HOME/cas_upload/ (no size limit); omit or pass type:"text" for UTF-8 text (default).',
        casAddArgs,
        ({ type, content }): Effect<FileCasOperation | Rm, ToolsCallResult> => {
            // type:'url' — stream the file into cas, then delete the source on success
            if (type === 'url') {
                if (!content.startsWith(`${casUploadDir}/`) || content.includes('..')) {
                    return pure(errorResult(`cas_add type:url paths must be within ${casUploadDir}/ — got: ${content}`))
                }
                return casAddFile(c)(content).step(([t, v]) =>
                    t === 'error'
                        ? pure(errorResult(`upload failed: ${v}`))
                        : rm(content).step(() => pure(okResult(vecToCBase32(v))))
                )
            }
            // type:'text' or 'base64' — resolve content to Vec, store via c.write()
            let x: Effect<Rm, Vec|string>
            switch(type) {
                case 'base64':
                    const value = base64Decode(content)
                    x = pure(value === null ? `invalid base64 content: ${content}` : value)
                    break
                default:
                    x = pure(utf8(content))
                    break
            }
            return x.step(value => typeof value === 'string'
                ? pure(errorResult(value))
                // The resolved content fits in one chunk; feed it as a single-item stream.
                : c.write(nonEmpty(ok(value), elEmpty<never, Ok<Vec>>())).step(hashResult => pure(hashResult[0] === 'error'
                    ? errorResult('write')
                    : okResult(vecToCBase32(hashResult[1]))))
            )
        },
    ),
    toolEntry(
        'cas_get',
        'Inspect a blob by hash. Always returns JSON {length,mime_type,type[,url]} where type is "text" or "base64". Pass content:true to also include the inline content string.',
        casGetArgs,
        r => {
            const key = cBase32ToVec(r.hash)
            if (key === null) {
                return pure(errorResult(`invalid cBase32 hash: ${r.hash}`))
            }
            return collectRead(c.read(key)).step(result => {
                if (result[0] === 'error') {
                    return pure(errorResult(`no such hash: ${r.hash}`))
                }
                const value = result[1]
                const byteLength = Number(bitVecLength(value) / 8n)
                const url = c.url(key)
                // Phase 1: magic-byte sniffing for known binary formats.
                const detectedMime = detect(value)
                if (detectedMime !== null) {
                    const meta: Meta = {
                        length: byteLength,
                        mime_type: detectedMime,
                        type: 'base64',
                        url,
                    }
                    if (r.content === true) {
                        const blob = base64Encode(value)
                        return pure(blob === null
                            ? errorResult(`content is not byte-aligned: ${r.hash}`)
                            : okResult(toJson({ ...meta, content: blob }))
                        )
                    }
                    return pure(okResult(toJson(meta)))
                }
                // Phase 2: UTF-8 validation — text if valid, octet-stream otherwise.
                const str = fromVec(value)
                if (str !== null) {
                    const meta: Meta = {
                        length: byteLength,
                        mime_type: 'text/plain',
                        type: 'text',
                        url,
                    }
                    return pure(r.content === true
                        ? okResult(toJson({ ...meta, content: str }))
                        : okResult(toJson(meta))
                    )
                }
                const meta: Meta = {
                    length: byteLength,
                    mime_type: 'application/octet-stream',
                    type: 'base64',
                    url,
                }
                if (r.content === true) {
                    const blob = base64Encode(value)
                    return pure(blob === null
                        ? errorResult(`content is not byte-aligned: ${r.hash}`)
                        : okResult(toJson({ ...meta, content: blob }))
                    )
                }
                return pure(okResult(toJson(meta)))
            })
        },
    ),
    toolEntry(
        'cas_list',
        'List all stored content hashes (cBase32), one per line.',
        casListArgs,
        () => c.list().step(hashes =>
            pure(okResult(hashes.map(vecToCBase32).join('\n')))),
    ),
    ]
}

// ── Result helpers ──────────────────────────────────────────────────────────────

/** A successful single-text-block tool result. */
const okResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }] })

// ── Handlers ────────────────────────────────────────────────────────────────────

/**
 * MCP handlers for `FileCas`.
 */
export const casMcpHandlers = (home: string): McpHandlers<FileCasOperation | Rm> =>
    fromRegistry(casToolRegistry(home))

// ── Session configuration ───────────────────────────────────────────────────────

/**
 * Static MCP configuration for the CAS server: advertises the `tools`
 * capability, identifies the server, and pins the protocol version.
 */
export const casConfig: McpConfig = {
    serverInfo: { name: 'functionalscript-cas', version: '0.30.0' },
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}

// ── Server ──────────────────────────────────────────────────────────────────────

/**
 * Runs the file CAS MCP server over stdio: allocates the session-state slot, builds
 * the `mcpStep` for `c`, and drives the read → parse → dispatch → write loop
 * until stdin EOF.
 */
export const casMcpServer = (
    home: string,
): Effect<Read | Write | MemOp | FileCasOperation | Rm, void> =>
    create(uninitializedState).step(key =>
        stdioTransport(mcpStep(casConfig)(casMcpHandlers(home))(key)))

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // casMcpServer is never called in integration tests because it drives a
    // real stdio server; call it here to cover its Effect-building body.
    casMcpServer: () => { casMcpServer('/') },
    // The overflow guard in collectRead (lines 125-126) is only reached when
    // the running total of two stream chunks would exceed maxLength.  Feed a
    // pure stream whose second chunk pushes it just over the limit so the
    // error branch executes without any real I/O.
    collectReadOverflow: () => {
        const half = maxLength / 2n
        const v1 = vec(half)(0n)
        const v2 = vec(half + 1n)(0n)
        const stream = nonEmpty<never, IoResult<Vec>>(ok(v1), nonEmpty<never, IoResult<Vec>>(ok(v2), elEmpty<never, IoResult<Vec>>()))
        const d = decode(collectRead(stream))
        if (!d.done || d.result[0] !== 'error') { throw 'expected overflow error' }
    },
}
