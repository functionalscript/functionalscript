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
 * | `cas_add`  | `{ content, type? }`          | `c.write(...)`   | hash (cBase32)                      |
 * | `cas_get`  | `{ hash, content?: boolean }` | `c.read(key)`    | JSON `{length,mimeType,type[,uri][,text\|blob]}` |
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
 *
 * Inline content (either encoding) is capped at 128 KiB (`maxLength`). There is
 * no MCP route for larger content — the server never opens a local path named by
 * the client (see the invariant in `fs/cas/mcp/README.md`); large files go
 * through the `cas` CLI (`cas add <path>`) instead, run directly by the user.
 *
 * ## `cas_get` output
 *
 * Always returns a JSON object `{ length, mimeType, type[, uri][, text | blob] }`.
 * These field names mirror the MCP resource-contents shape (`resources/read`
 * results), so the tool view and the future resource view of a blob use the same
 * vocabulary: `mimeType` (not `mime_type`), `uri` (not `url`) — the resource URI
 * under which the same blob will be readable via `resources/read` — and `text` /
 * `blob` (not a `type`-tagged `content`) for inline payloads. `type` is always
 * present (`'text'` or `'base64'`) as the discriminator for which of `text` /
 * `blob` a later `content: true` fetch would populate — MCP allows extra fields,
 * so `type` and `length` simply stay alongside the required resource-contents
 * fields. A single classifier — the `fs/mime` detector state machine (length ×
 * magic-byte eliminator × UTF-8 DFA) — produces the same three-way verdict on
 * both paths, so there is no second, divergent copy of the rules:
 *
 * 1. **Magic-byte hit** (PNG/JPEG/GIF/WebP/PDF/ZIP) → `type: 'base64'` with the
 *    detected `mimeType`.
 * 2. **Whole-blob-valid UTF-8** → `type: 'text'`, `mimeType: 'text/plain'`.
 * 3. **Fallback** → `type: 'base64'`, `mimeType: 'application/octet-stream'`.
 *
 * **Metadata-only (`content: false`, the default) is size-independent.** It folds
 * the read stream through `fs/mime` `detectStream` and never buffers the blob.
 * Because a single `Vec` caps at `maxLength` bits (128 KiB), the old
 * drain-into-one-`Vec` approach failed on any blob larger than one chunk even when
 * only metadata was asked for; streaming detection returns correct
 * `{ length, mimeType, type[, uri] }` regardless of size.
 *
 * **`content: true`** first derives `{ length, mimeType, type }` with the same
 * size-independent `fs/mime` `detectStream` machine, then materializes the bytes
 * (via `collectRead`, bounded by `maxLength`) and encodes the inline payload by
 * `type` — a `fs/text/utf8` `fromVec` string on `text` (for `type: 'text'`), base64
 * on `blob` (for `type: 'base64'`). A blob larger than `maxLength` (128 KiB)
 * cannot be buffered into one `Vec`, so it is rejected here with a descriptive
 * *"too large"* error (carrying the byte size and `uri`) rather than being
 * misreported as absent; it should be fetched via `uri` or inspected with
 * metadata-only `cas_get`.
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
 * - `cas_get` with `content: true` on a blob larger than `maxLength` → `isError`
 *   (distinct "too large" message, not "no such hash")
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
import { tryUtf8 } from '../../text/module.f.ts'
import { detectStream } from '../../mime/module.f.ts'
import { empty, length as bitVecLength, maxLength, maxLengthBytes, msb, vec, type Vec } from '../../types/bit_vec/module.f.ts'
import { ok, error, type Ok } from '../../types/result/module.f.ts'
import { type IoResult, type Read, type Write } from '../../effects/node/module.f.ts'
import { stdioTransport } from '../../mcp/stdio/module.f.ts'
import {
    mcpStep, uninitializedState,
    toolEntry, fromRegistry, errorResult,
    type McpConfig, type McpHandlers, type ToolEntry,
    type ToolsCallResult,
} from '../../mcp/module.f.ts'
import { fileCas, type FileCasOperation } from '../module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { sha256 } from '../../crypto/sha2/module.f.ts'
import { nonEmpty, empty as elEmpty, type List } from '../../effects/list/module.f.ts'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `cas_add`: content to store, with optional encoding type. */
export const casAddArgs = {
    content: string,
    type: or('text' as const, 'base64' as const, undefined)
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
 * Drains a CAS read stream into a single `Vec`. Used only on the `content: true`
 * path, where the whole blob is needed for inline base64 / UTF-8 transfer; the
 * chunk stream is concatenated and an error item is surfaced as the result.
 * Metadata-only `cas_get` avoids this entirely via `fs/mime` `detectStream`,
 * which is why it is not bound by the `maxLength` ceiling below.
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
    readonly mimeType: string
    readonly type: 'text' | 'base64'
    readonly uri: string
}

/** Registry of all CAS tools. */
const casToolRegistry =
(home: string): readonly ToolEntry<FileCasOperation>[] => {
    const c = fileCas(sha256)(home)
    return [
    toolEntry(
        'cas_add',
        'Store content and return its hash (cBase32). Pass type:"base64" for binary; omit or pass type:"text" for UTF-8 text (default). Inline content is capped at 128 KiB (131072 bytes) — larger content is rejected. For larger content, store the file with the `cas` CLI instead: run `npx functionalscript cas add <path>` yourself if you have shell access, or give the user that exact command to run — it prints the resulting hash on stdout.',
        casAddArgs,
        ({ type, content }): Effect<FileCasOperation, ToolsCallResult> => {
            // type:'text' or 'base64' — resolve content to Vec, store via c.write()
            let x: Vec|null = type === 'base64'
                ? base64Decode(content)
                : tryUtf8(content)
            return x === null
                ? pure(errorResult('too large or malformed — for large content, run `npx functionalscript cas add <path>` (or have the user run it) instead'))
                // The resolved content fits in one chunk; feed it as a single-item stream.
                : c.write(nonEmpty(ok(x), elEmpty<never, Ok<Vec>>())).step(([tag, hash]) => pure(tag === 'error'
                    ? errorResult('write')
                    : okResult(vecToCBase32(hash))))
        },
    ),
    toolEntry(
        'cas_get',
        'Inspect a blob by hash. Always returns JSON {length,mimeType,type[,uri]} where type is "text" or "base64". Pass content:true to also include the inline payload as text (type:"text") or blob (type:"base64"), but content is capped at 128 KiB (131072 bytes) — a larger blob is rejected with an error. To download a blob, prefer the uri field returned in the result instead of requesting inline content.',
        casGetArgs,
        r => {
            const key = cBase32ToVec(r.hash)
            if (key === null) {
                return pure(errorResult(`invalid cBase32 hash: ${r.hash}`))
            }
            const uri = c.url(key)
            return detectStream(c.read(key)).step(([tag, detected]) => {
                if (tag === 'error') {
                    return pure(errorResult(`no such hash: ${r.hash}`))
                }
                const { length, mime_type: mimeType, type } = detected
                const meta: Meta = { length: Number(length), mimeType, type, uri }
                if (r.content !== true) {
                    // content:true path continues below; this is just the metadata step.
                    return pure(okResult(toJson(meta)))
                }
                // A single `Vec` caps at `maxLength` bits (`maxLengthBytes` bytes), so
                // a larger blob cannot be buffered for inline transfer. Report the
                // size and point at the size-independent alternatives instead of
                // misreporting an existing blob as `no such hash`.
                if (length > maxLengthBytes) {
                    return pure(errorResult(
                        `blob too large to fetch inline (${length} bytes, limit ${maxLengthBytes} bytes); use the uri field (${uri}) or omit content for metadata`))
                }
                return collectRead(c.read(key)).step(([collectTag, value]) => {
                    if (collectTag === 'error') {
                        return pure(errorResult(`no such hash: ${r.hash}`))
                    }
                    if (type === 'text') {
                        // `type: 'text'` means the detector validated `value` as UTF-8,
                        // so `fromVec` is non-null here; guard defensively regardless.
                        const str = fromVec(value)
                        return pure(str === null
                            ? errorResult(`content is not byte-aligned: ${r.hash}`)
                            : okResult(toJson({ ...meta, text: str }))
                        )
                    }
                    const blob = base64Encode(value)
                    return pure(blob === null
                        ? errorResult(`content is not byte-aligned: ${r.hash}`)
                        : okResult(toJson({ ...meta, blob }))
                    )
                })
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
export const casMcpHandlers = (home: string): McpHandlers<FileCasOperation> =>
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
): Effect<Read | Write | MemOp | FileCasOperation, void> =>
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
