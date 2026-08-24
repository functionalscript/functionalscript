/**
 * The `cas_add` / `cas_get` / `cas_list` tool registry: maps `Cas<O>`
 * operations onto MCP tools, so an agent that speaks MCP can store a blob and
 * get back its hash, fetch a blob by hash, and enumerate what is stored —
 * without shelling out to the `cas` CLI. The store itself
 * (`fjs/cas/module.f.mjs`) stays transport-agnostic; this is an additional
 * front end alongside the CLI `main`. This registry is one of the tool sets
 * `fjs/mcp/module.f.mjs` composes into the FJS MCP server — see that module
 * for the full tool table (including `fjs/mcp/evo`'s `evo_*` tools) and the
 * server entry point.
 *
 * ## Tools
 *
 * | Tool           | args                          | action           | result                              |
 * |----------------|--------------------------------|------------------|--------------------------------------|
 * | `cas_add`      | `{ content, type? }`          | `c.write(...)`   | hash (cBase32)                      |
 * | `cas_get`      | `{ hash, content?: boolean }` | `c.read(key)`    | JSON `{length,mimeType,type[,uri][,text\|blob]}` |
 * | `cas_list`     | `{}`                          | `c.list()`       | hashes, one per line                |
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
 * the client (see the invariant in `fjs/mcp/README.md`); large files go
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
 * fields. A single classifier — the `fjs/media/type` detector state machine (length ×
 * magic-byte eliminator × UTF-8 DFA) — produces the same three-way verdict on
 * both paths, so there is no second, divergent copy of the rules:
 *
 * 1. **Magic-byte hit** (PNG/JPEG/GIF/WebP/PDF/ZIP) → `type: 'base64'` with the
 *    detected `mimeType`.
 * 2. **Whole-blob-valid UTF-8** → `type: 'text'`, `mimeType: 'text/plain'`.
 * 3. **Fallback** → `type: 'base64'`, `mimeType: 'application/octet-stream'`.
 *
 * **Metadata-only (`content: false`, the default) is size-independent for
 * non-text and oversized blobs.** It folds the read stream through
 * `fjs/media/type` `detectStream` and never buffers the blob. Because a single
 * `Vec` caps at `maxLength` bits (128 KiB), the old drain-into-one-`Vec`
 * approach failed on any blob larger than one chunk even when only metadata
 * was asked for; streaming detection returns correct
 * `{ length, mimeType, type[, uri] }` regardless of size. A dialect (e.g.
 * `vnd.fjs.revision`, see `fjs/media/module.f.mjs`) can only be recognized by
 * parsing the whole blob as JSON, so when the streaming verdict is
 * whole-blob-valid text within the same bounded inline cap as `content: true`
 * (`maxLengthBytes`), one extra bounded read materializes the blob purely to
 * refine `mimeType` through the dialect-aware detector; a larger or non-text
 * blob is never a dialect match and is returned from the streaming verdict
 * alone, unbuffered.
 *
 * **`content: true`** first derives `{ length, mimeType, type }` with the same
 * size-independent `fjs/media/type` `detectStream` machine (to decide whether the
 * blob even fits inline), then materializes the bytes (via `collectRead`, bounded
 * by `maxLength`) and re-derives the verdict from the dialect-aware detector
 * (`fjs/media/module.f.mjs` `detect`) — now that the whole blob is in hand, a
 * dialect match is reflected in the result — before encoding the inline payload
 * by `type` — a `fjs/text/utf8` `fromVec` string on `text` (for `type: 'text'`),
 * base64 on `blob` (for `type: 'base64'`). A blob larger than `maxLength` (128
 * KiB) cannot be buffered into one `Vec`, so it is rejected here with a
 * descriptive *"too large"* error (carrying the byte size and `uri`) rather than
 * being misreported as absent; it should be fetched via `uri` or inspected with
 * metadata-only `cas_get`.
 *
 * ## Encoding split: hashes vs. content
 *
 * `Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` today.
 * **Hashes** travel as cBase32 (`fjs/basen/cbase32`) — the canonical CAS hash format,
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
 *
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { ToolEntry } from '../../protocol/mcp/types.ts'
 * @import { FileCasOperation } from '../../cas/types.ts'
 * @import { Cache } from '../../cas/evo/types.ts'
 * @import { Key } from '../../effects/memory/types.ts'
 */

import { string, option, or, boolean } from '../../types/rtti/module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { pureOk, resultStep } from '../../effects/module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { decode as base64Decode, encode as base64Encode } from '../../basen/base64/module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { detectStream } from '../../media/type/module.f.mjs'
import { detect } from '../../media/module.f.mjs'
import { revisionDialect } from '../../media/revision/module.f.mjs'
import { lockDialect } from '../../media/lock/module.f.mjs'
import { noteDialect } from '../../media/note/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import {
    toolEntry, errorResult, okResult,
} from '../../protocol/mcp/module.f.mjs'
import { collectRead, fileCas } from '../../cas/module.f.mjs'
import { errorSummary } from '../../effects/node/module.f.mjs'
import { fromVec } from '../../text/utf8/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { sha256 } from '../../crypto/sha2/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.mjs'
import { syncRevision } from '../../cas/evo/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `cas_add`: content to store, with optional encoding type. */
export const casAddArgs = /** @type {const} */ ({
    content: string,
    type: or('text', 'base64', undefined)
})

/** Arguments for `cas_get`: the cBase32 hash to look up; optionally request inline content. */
export const casGetArgs = /** @type {const} */ ({
    hash: string,
    content: option(boolean)
})

/** Arguments for `cas_list`: none. */
export const casListArgs = /** @type {const} */ ({})

// ── Tool registry ──────────────────────────────────────────────────────────────

const toJson = stringify(identity)

/**
 * The dialect-aware classifier, bound to the dialects this server recognizes:
 * the revision format, the shared lock maps revisions reference
 * (`fjs/media/lock`), and notes (`fjs/media/note`), so `cas_get` reports each
 * under its own media type instead of `text/plain`.
 */
const detectDialect = detect([revisionDialect, lockDialect, noteDialect])

/** @typedef {{
 *   readonly length: number
 *   readonly mimeType: string
 *   readonly type: 'text' | 'base64'
 *   readonly uri: string
 * }} _Meta */

/**
 * Registry of all CAS tools, bound to `home` and the Evo cache at
 * `cacheKey`. `cas_add` is the only tool that writes, so it is the only one
 * that needs `cacheKey`: a successfully stored blob is folded into the Evo
 * cache via `syncRevision` when it happens to be a `vnd.fjs.revision` — a
 * plain `cas_add` and `evo_add` are two ways to reach the same store, and
 * this keeps `evo_list`/`evo_head` honest about either one without a
 * rescan.
 *
 * @type {(home: string) => (cacheKey: Key<Cache>) => readonly ToolEntry<FileCasOperation | MemOp>[]}
 */
export const casToolRegistry = home => cacheKey => {
    const c = fileCas(sha256)(home)
    return [
        toolEntry(
            'cas_add',
            'Store content and return its hash (cBase32). Pass type:"base64" for binary; omit or pass type:"text" for UTF-8 text (default). Inline content is capped at 128 KiB (131072 bytes) — larger content is rejected. For larger content, store the file with the `cas` CLI instead: run `npx functionalscript cas add <path>` yourself if you have shell access, or give the user that exact command to run — it prints the resulting hash on stdout.',
            casAddArgs,
            ({ type, content }) => {
                // type:'text' or 'base64' — resolve content to Vec, store via c.write()
                /** @type {Vec | null} */
                let x = type === 'base64'
                    ? base64Decode(content)
                    : tryUtf8(content)
                return x === null
                    ? pureOk(errorResult('too large or malformed — for large content, run `npx functionalscript cas add <path>` (or have the user run it) instead'))
                    // The resolved content fits in one chunk; feed it as a single-item stream.
                    : resultStep(
                        c.write(nonEmpty(x, elEmpty())),
                        writeResult => {
                            if (writeResult[0] === 'error') { return pureOk(errorResult('write')) }
                            const hash = writeResult[1]
                            return resultStep(
                                syncRevision(cacheKey)(hash)(x),
                                () => pureOk(okResult(vecToCBase32(hash)))
                            )
                        },
                    )
            },
        ),
        toolEntry(
            'cas_get',
            'Inspect a blob by hash. Always returns JSON {length,mimeType,type[,uri]} where type is "text" or "base64". Pass content:true to also include the inline payload as text (type:"text") or blob (type:"base64"), but content is capped at 128 KiB (131072 bytes) — a larger blob is rejected with an error. To download a blob, prefer the uri field returned in the result instead of requesting inline content.',
            casGetArgs,
            r => {
                const key = cBase32ToVec(r.hash)
                if (key === null) {
                    return pureOk(errorResult(`invalid cBase32 hash: ${r.hash}`))
                }
                const uri = c.url(key)
                return resultStep(
                    detectStream(c.read(key)),
                    ([tag, detected]) => {
                        if (tag === 'error') {
                            return pureOk(errorResult(`no such hash: ${r.hash}`))
                        }
                        const { length, mime_type: mimeType, type } = detected
                        /** @type {_Meta} */
                        const meta = { length: Number(length), mimeType, type, uri }
                        if (r.content !== true) {
                            // A dialect match can only be decided from the whole parsed blob;
                            // only attempt the extra bounded read when it stands a chance
                            // (whole-blob text within the same cap `content: true` allows).
                            if (type !== 'text' || length > maxLengthBytes) {
                                return pureOk(okResult(toJson(meta)))
                            }
                            return resultStep(
                                collectRead(c.read(key)),
                                ([collectTag, value]) => {
                                    // Already known to fit from the streaming pass above, so an
                                    // error here means the hash vanished between reads; fall back
                                    // to the streaming verdict rather than fail the whole request.
                                    if (collectTag === 'error') { return pureOk(okResult(toJson(meta))) }
                                    const refined = detectDialect(value)
                                    return pureOk(okResult(toJson({ ...meta, mimeType: refined.mime_type })))
                                }
                            )
                        }
                        // A single `Vec` caps at `maxLength` bits (`maxLengthBytes` bytes), so
                        // a larger blob cannot be buffered for inline transfer. Report the
                        // size and point at the size-independent alternatives instead of
                        // misreporting an existing blob as `no such hash`.
                        if (length > maxLengthBytes) {
                            return pureOk(errorResult(
                                `blob too large to fetch inline (${length} bytes, limit ${maxLengthBytes} bytes); use the uri field (${uri}) or omit content for metadata`))
                        }
                        return resultStep(
                            collectRead(c.read(key)),
                            ([collectTag, value]) => {
                                if (collectTag === 'error') {
                                    return pureOk(errorResult(`no such hash: ${r.hash}`))
                                }
                                // Re-derive the verdict from the now-materialized blob so a
                                // dialect match — only decidable with the whole parsed JSON in
                                // hand — is reflected in the inline result too, not just the
                                // streaming guess.
                                const refined = detectDialect(value)
                                /** @type {_Meta} */
                                const refinedMeta = { length: Number(refined.length), mimeType: refined.mime_type, type: refined.type, uri }
                                if (refined.type === 'text') {
                                    // `type: 'text'` means the detector validated `value` as
                                    // whole-blob UTF-8 with a byte-aligned length (see
                                    // `media/type`'s `finish`) — the same two conditions
                                    // `fromVec` checks, via the same decoder — so `fromVec`
                                    // cannot return `null` here (mirrors `media`'s own `detect`).
                                    const str = assertNotNullish(fromVec(value), 'cas_get: type text implies fromVec succeeds')
                                    return pureOk(okResult(toJson({ ...refinedMeta, text: str })))
                                }
                                // Every byte ever written through `cas_add`/the CAS store is
                                // whole-byte chunks (UTF-8 text or already-decoded base64), so
                                // `value` is always byte-aligned regardless of which branch
                                // classified it — `base64Encode` only rejects a non-byte-aligned
                                // input.
                                const blob = assertNotNullish(base64Encode(value), 'cas_get: stored content is always byte-aligned')
                                return pureOk(okResult(toJson({ ...refinedMeta, blob })))
                            },
                        )
                    },
                )
            },
        ),
        toolEntry(
            'cas_list',
            'List all stored content hashes (cBase32), one per line.',
            casListArgs,
            () => resultStep(
                c.list(),
                r => pureOk(r[0] === 'error'
                    ? errorResult(errorSummary(r[1]))
                    : okResult(r[1].map(vecToCBase32).join('\n')))
            ),
        ),
    ]
}
