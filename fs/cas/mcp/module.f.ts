/**
 * MCP adapter for the content-addressable store.
 *
 * Maps the three `Cas<O>` operations onto three MCP tools, so an agent that
 * speaks MCP can store a blob and get back its hash, fetch a blob by hash, and
 * enumerate what is stored — without shelling out to the `cas` CLI. The store
 * itself (`fs/cas/module.f.ts`) stays transport-agnostic; this is an additional
 * front end alongside the CLI `main`.
 *
 * ## The three tools
 *
 * | Tool       | args                  | CAS call         | result                          |
 * |------------|-----------------------|------------------|---------------------------------|
 * | `cas_add`  | `{ content: string }` | `c.write(value)` | hash (cBase32)                  |
 * | `cas_get`  | `{ hash: string }`    | `c.read(key)`    | content (base64; see below)     |
 * | `cas_list` | `{}`                  | `c.list()`       | hashes, one per line            |
 *
 * Each tool's argument schema is an rtti struct declared once and used twice:
 * `toJsonSchema` derives the `inputSchema` advertised in `tools/list`, and
 * `validate` decodes the `arguments` object in `tools/call`. No drift between
 * what we advertise and what we accept.
 *
 * ## Encoding split: hashes vs. content
 *
 * `Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` today.
 * Two encodings cross the protocol, each chosen for its consumer:
 * - **Hashes** travel as cBase32 (`fs/cbase32`) — the canonical CAS hash format,
 *   shared with the CLI and the on-disk store layout.
 * - **Content** travels as standard RFC 4648 base64 (`fs/base64`) — the
 *   MCP-idiomatic encoding for opaque binary, which external tools and LLMs
 *   already understand without project-specific knowledge.
 *
 * Both decoders return `null` on malformed input, giving free validation.
 *
 * ## File-type detection on `cas_get`
 *
 * The store is type-agnostic — it keeps raw bytes only — so type is recovered
 * on read, not stored. `cas_get` sniffs the retrieved bytes with `fs/mime`
 * `detect`:
 * - a recognised magic-byte signature (PNG, JPEG, GIF, WebP, PDF, ZIP) →
 *   an MCP `EmbeddedResource` (`BlobResource`) with the base64 `blob`, the
 *   detected `mimeType`, and a `cas://sha256/<hash>` URI;
 * - unrecognised bytes (`detect` → `null`) → the plain `textContent` block,
 *   so the tool stays backward compatible.
 *
 * ## Error convention
 *
 * MCP draws a line the dispatcher already respects: *protocol* failures
 * (unknown method, malformed JSON-RPC params) are JSON-RPC errors handled by
 * `mcpStep`. *Tool* failures come back as a normal `tools/call` result with
 * `isError: true` and a text explanation, so the model can read and react:
 * - malformed `content` (base64 `decode` → `null`) → `isError` result
 * - malformed `hash` (`cBase32ToVec` → `null`) → `isError` result
 * - `cas_get` on an absent hash (`c.read` → `undefined`) → `isError` result
 * - unknown tool `name` → `isError` result
 *
 * @module
 */
import { string, option, or } from '../../types/rtti/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import { toJsonSchema } from '../../json/schema/module.f.ts'
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
export const casAddArgs = { content: string, type: option(or('text' as const, 'base64' as const)) } as const

/** Arguments for `cas_get`: the cBase32 hash to look up. */
export const casGetArgs = { hash: string } as const

/** Arguments for `cas_list`: none. */
export const casListArgs = {} as const

/** Arguments for `cas_add_url`: filesystem path to read and store. */
export const casAddUrlArgs = { url: string } as const

/** Arguments for `cas_get_meta`: the cBase32 hash to inspect. */
export const casGetMetaArgs = { hash: string } as const

// ── Tool descriptors ────────────────────────────────────────────────────────────

const casAddTool: Tool = {
    name: 'cas_add',
    description: 'Store content and return its hash (cBase32). Pass type:"base64" for binary; omit or pass type:"text" for UTF-8 text (default).',
    inputSchema: toJsonSchema(casAddArgs),
}

const casGetTool: Tool = {
    name: 'cas_get',
    description: 'Fetch content by its hash (cBase32). Returns JSON {content,type,mime_type}: type is "text" for valid UTF-8 or known binary formats, "base64" otherwise.',
    inputSchema: toJsonSchema(casGetArgs),
}

const casListTool: Tool = {
    name: 'cas_list',
    description: 'List all stored content hashes (cBase32), one per line.',
    inputSchema: toJsonSchema(casListArgs),
}

const casAddUrlTool: Tool = {
    name: 'cas_add_url',
    description: 'Read the file at the given path (url), store it, and return its hash (cBase32).',
    inputSchema: toJsonSchema(casAddUrlArgs),
}

const casGetMetaTool: Tool = {
    name: 'cas_get_meta',
    description: 'Return metadata (length, mime_type, url) for a blob by hash — no content transfer.',
    inputSchema: toJsonSchema(casGetMetaArgs),
}

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
 * When `toUrl` is provided, `cas_get_meta` includes the `url` field pointing to
 * the blob on the local filesystem. When absent (e.g. memory-backed tests),
 * `url` is omitted.
 */
export const casMcpHandlers = <O extends Operation>(
    c: Cas<O>,
    toUrl?: (hash: Vec) => string,
): McpHandlers<ReadFile | O> => ({
    toolsList: (): Effect<ReadFile | O, ToolsListResult> =>
        pure({ tools: [casAddTool, casGetTool, casListTool, casAddUrlTool, casGetMetaTool] }),
    toolsCall: ({ name, arguments: args }: ToolsCallParams): Effect<ReadFile | O, ToolsCallResult> => {
        const a = args === undefined ? {} : args
        switch (name) {
            case 'cas_add': {
                const [t, r] = validate(casAddArgs)(a)
                if (t === 'error') {
                    return pure(errorResult(`invalid arguments: ${r.message}`))
                }
                const encoding = r.type ?? 'text'
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
            }
            case 'cas_get': {
                const [t, r] = validate(casGetArgs)(a)
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
                    // Phase 1: magic-byte sniffing for known binary formats.
                    const detectedMime = detect(value)
                    if (detectedMime !== null) {
                        const blob = base64Encode(value)
                        if (blob === null) {
                            return pure(errorResult(`content is not byte-aligned: ${r.hash}`))
                        }
                        return pure(okResult(JSON.stringify({ content: blob, type: 'base64', mime_type: detectedMime })))
                    }
                    // Phase 2: UTF-8 validation — text if valid, octet-stream otherwise.
                    const str = fromVec(value)
                    if (str !== null) {
                        return pure(okResult(JSON.stringify({ content: str, type: 'text', mime_type: 'text/plain' })))
                    }
                    const blob = base64Encode(value)
                    if (blob === null) {
                        return pure(errorResult(`content is not byte-aligned: ${r.hash}`))
                    }
                    return pure(okResult(JSON.stringify({ content: blob, type: 'base64', mime_type: 'application/octet-stream' })))
                })
            }
            case 'cas_list': {
                return c.list().step(hashes =>
                    pure(okResult(hashes.map(vecToCBase32).join('\n'))))
            }
            case 'cas_add_url': {
                const [t, r] = validate(casAddUrlArgs)(a)
                if (t === 'error') {
                    return pure(errorResult(`invalid arguments: ${r.message}`))
                }
                return readFile(r.url).step(result => {
                    if (result[0] === 'error') {
                        return pure(errorResult(`cannot read file: ${r.url}: ${result[1]}`))
                    }
                    return c.write(result[1]).step(hash => pure(okResult(vecToCBase32(hash))))
                })
            }
            case 'cas_get_meta': {
                const [t, r] = validate(casGetMetaArgs)(a)
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
                    const mimeType = detect(value) ?? (fromVec(value) !== null ? 'text/plain' : 'application/octet-stream')
                    const url = toUrl?.(key)
                    const meta = url !== undefined
                        ? { length: byteLength, mime_type: mimeType, url }
                        : { length: byteLength, mime_type: mimeType }
                    return pure(okResult(JSON.stringify(meta)))
                })
            }
            default: {
                return pure(errorResult(`unknown tool: ${name}`))
            }
        }
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
 * When `toUrl` is provided, `cas_get_meta` includes the blob's filesystem URL.
 */
export const casMcpServer = <O extends Operation>(
    c: Cas<O>,
    toUrl?: (hash: Vec) => string,
): Effect<Read | Write | MemOp | ReadFile | O, void> =>
    create(uninitializedState).step(key =>
        stdioTransport(mcpStep<ReadFile | O>(casConfig)(casMcpHandlers(c, toUrl))(key)))
