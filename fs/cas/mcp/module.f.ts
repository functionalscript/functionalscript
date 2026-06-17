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
 * | Tool       | args                          | CAS call         | result                              |
 * |------------|-------------------------------|------------------|-------------------------------------|
 * | `cas_add`  | `{ content, type? }`          | `c.write(value)` | hash (cBase32)                      |
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
 * - `'url'`: `content` is a filesystem path; the server reads the file at that
 *   path and stores its raw bytes.
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
import { string, option, or, boolean, type Type } from '../../types/rtti/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import { toJsonSchema } from '../../json/schema/module.f.ts'
import type { Unknown } from '../../json/module.f.ts'
import { pure, type Effect, type Operation } from '../../effects/module.f.ts'
import { create, type MemOp } from '../../effects/memory/module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../cbase32/module.f.ts'
import { decode as base64Decode, encode as base64Encode } from '../../base64/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { detect } from '../../mime/module.f.ts'
import { length as bitVecLength, type Vec } from '../../types/bit_vec/module.f.ts'
import { readFile, type Read, type ReadFile, type Write } from '../../effects/node/module.f.ts'
import { stdioTransport } from '../../mcp/stdio/module.f.ts'
import {
    mcpStep, uninitializedState,
    type McpConfig, type McpHandlers, type Tool,
    type ToolsCallParams, type ToolsCallResult, type ToolsListResult,
} from '../../mcp/module.f.ts'
import type { Cas } from '../module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `cas_add`: content to store, with optional encoding type. */
export const casAddArgs = { content: string, type: option(or(or('text' as const, 'base64' as const), 'url' as const)) } as const

/** Arguments for `cas_get`: the cBase32 hash to look up; optionally request inline content. */
export const casGetArgs = { hash: string, content: option(boolean) } as const

/** Arguments for `cas_list`: none. */
export const casListArgs = {} as const

// ── Tool registry ──────────────────────────────────────────────────────────────

/** A single tool entry combining metadata, schema, and handler. */
type ToolEntry = {
    readonly name: string
    readonly description: string
    readonly inputRtti: Type
    readonly handle: <O extends Operation>(c: Cas<O>, toUrl: ((hash: Vec) => string) | undefined) => (args: Unknown) => Effect<ReadFile | O, ToolsCallResult>
}

/** Registry of all CAS tools. */
const toolRegistry: readonly ToolEntry[] = [
    {
        name: 'cas_add',
        description: 'Store content and return its hash (cBase32). Pass type:"base64" for binary; type:"url" to read from a filesystem path; omit or pass type:"text" for UTF-8 text (default).',
        inputRtti: casAddArgs,
        handle: (c, _toUrl) => (args: Unknown) => {
            const [t, r] = validate(casAddArgs)(args)
            if (t === 'error') {
                return pure(errorResult(`invalid arguments: ${r.message}`))
            }
            const encoding = r.type ?? 'text'
            if (encoding === 'url') {
                return readFile(r.content).step(result => {
                    if (result[0] === 'error') {
                        return pure(errorResult(`cannot read file: ${r.content}: ${result[1]}`))
                    }
                    return c.write(result[1]).step(hash => pure(okResult(vecToCBase32(hash))))
                })
            }
            let value: Vec | null
            if (encoding === 'base64') {
                value = base64Decode(r.content)
                if (value === null) {
                    return pure(errorResult(`invalid base64 content: ${r.content}`))
                }
            } else {
                value = utf8(r.content)
            }
            return c.write(value).step(hash => pure(okResult(vecToCBase32(hash))))
        },
    },
    {
        name: 'cas_get',
        description: 'Inspect a blob by hash. Always returns JSON {length,mime_type,type[,url]} where type is "text" or "base64". Pass content:true to also include the inline content string.',
        inputRtti: casGetArgs,
        handle: (c, toUrl) => (args: unknown) => {
            const [t, r] = validate(casGetArgs)(args as Unknown)
            if (t === 'error') {
                return pure(errorResult(`invalid arguments: ${r.message}`))
            }
            const key = cBase32ToVec(r.hash)
            if (key === null) {
                return pure(errorResult(`invalid cBase32 hash: ${r.hash}`))
            }
            return c.read(key).step(value => {
                if (value === undefined) {
                    return pure(errorResult(`no such hash: ${r.hash}`))
                }
                const byteLength = Number(bitVecLength(value) / 8n)
                // Phase 1: magic-byte sniffing for known binary formats.
                const detectedMime = detect(value)
                if (detectedMime !== null) {
                    const url = toUrl?.(key)
                    const meta: Record<string, unknown> = { length: byteLength, mime_type: detectedMime, type: 'base64', ...(url !== undefined && { url }) }
                    if (r.content === true) {
                        const blob = base64Encode(value)
                        if (blob === null) {
                            return pure(errorResult(`content is not byte-aligned: ${r.hash}`))
                        }
                        return pure(okResult(JSON.stringify({ ...meta, content: blob })))
                    }
                    return pure(okResult(JSON.stringify(meta)))
                }
                // Phase 2: UTF-8 validation — text if valid, octet-stream otherwise.
                const str = fromVec(value)
                const url = toUrl?.(key)
                if (str !== null) {
                    const meta: Record<string, unknown> = { length: byteLength, mime_type: 'text/plain', type: 'text', ...(url !== undefined && { url }) }
                    if (r.content === true) {
                        return pure(okResult(JSON.stringify({ ...meta, content: str })))
                    }
                    return pure(okResult(JSON.stringify(meta)))
                }
                const meta: Record<string, unknown> = { length: byteLength, mime_type: 'application/octet-stream', type: 'base64', ...(url !== undefined && { url }) }
                if (r.content === true) {
                    const blob = base64Encode(value)
                    if (blob === null) {
                        return pure(errorResult(`content is not byte-aligned: ${r.hash}`))
                    }
                    return pure(okResult(JSON.stringify({ ...meta, content: blob })))
                }
                return pure(okResult(JSON.stringify(meta)))
            })
        },
    },
    {
        name: 'cas_list',
        description: 'List all stored content hashes (cBase32), one per line.',
        inputRtti: casListArgs,
        handle: (c, _toUrl) => (args: unknown) => {
            const [t, r] = validate(casListArgs)(args as Unknown)
            if (t === 'error') {
                return pure(errorResult(`invalid arguments: ${r.message}`))
            }
            return c.list().step(hashes =>
                pure(okResult(hashes.map(vecToCBase32).join('\n'))))
        },
    },
]

// ── Result helpers ──────────────────────────────────────────────────────────────

/** A successful single-text-block tool result. */
const okResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }] })

/** A tool-level failure: in-band `isError` result with a text explanation. */
const errorResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }], isError: true })

// ── Handlers ────────────────────────────────────────────────────────────────────

/**
 * MCP handlers for an injected `Cas<O>` — generic in `O` exactly like `Cas`
 * itself, so the same handlers run over `Fs` (production) or memory (tests).
 *
 * When `toUrl` is provided, `cas_get` includes the `url` field pointing to
 * the blob on the local filesystem. When absent (e.g. memory-backed tests),
 * `url` is omitted.
 */
export const casMcpHandlers = <O extends Operation>(
    c: Cas<O>,
    toUrl?: (hash: Vec) => string,
): McpHandlers<ReadFile | O> => ({
    toolsList: (): Effect<ReadFile | O, ToolsListResult> => {
        const tools: Tool[] = toolRegistry.map(entry => ({
            name: entry.name,
            description: entry.description,
            inputSchema: toJsonSchema(entry.inputRtti),
        }))
        return pure({ tools })
    },
    toolsCall: ({ name, arguments: args }: ToolsCallParams): Effect<ReadFile | O, ToolsCallResult> => {
        const entry = toolRegistry.find(e => e.name === name)
        if (entry === undefined) {
            return pure(errorResult(`unknown tool: ${name}`))
        }
        const a = args === undefined ? {} : args
        return entry.handle(c, toUrl)(a)
    },
})

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
 * Runs the CAS MCP server over stdio: allocates the session-state slot, builds
 * the `mcpStep` for `c`, and drives the read → parse → dispatch → write loop
 * until stdin EOF. Generic in `O` so it composes with any `Cas<O>` backing.
 *
 * When `toUrl` is provided, `cas_get` includes the blob's filesystem URL.
 */
export const casMcpServer = <O extends Operation>(
    c: Cas<O>,
    toUrl?: (hash: Vec) => string,
): Effect<Read | Write | MemOp | ReadFile | O, void> =>
    create(uninitializedState).step(key =>
        stdioTransport(mcpStep<ReadFile | O>(casConfig)(casMcpHandlers(c, toUrl))(key)))
