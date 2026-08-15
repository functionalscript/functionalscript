/**
 * MCP tool definitions for the Evo API (`fjs/cas/evo/module.f.mjs`): subjects,
 * revision heads, and the typed read of a single revision over the
 * content-addressable store, backed by the in-memory cache the core module
 * maintains.
 *
 * ## Tools
 *
 * | Tool           | args                                          | action            | result                               |
 * |----------------|-----------------------------------------------|-------------------|--------------------------------------|
 * | `evo_list`     | `{ archived? }`                                      | `e.list(...)`     | subjects, as a JSON array of strings |
 * | `evo_head`     | `{ subject }`                                        | `e.head(...)`     | head hashes, one per line            |
 * | `evo_revision` | `{ hash }`                                           | `e.revision(...)` | the revision, as JSON `RevisionData` |
 * | `evo_add`      | `{ parents, snapshot?, subject?, archived?, lock? }`  | `e.add(...)`      | hash (cBase32)                       |
 *
 * `evo_add` and `evo_revision` speak the same structure — `fjs/cas/evo`'s
 * `RevisionData` — in opposite directions, so a revision read back can be
 * added again as-is, `lock` scopes and all. The one field `evo_revision`
 * returns that `evo_add` does not accept is `generation`, which the server
 * computes, and rtti's struct validation
 * ignores properties the schema does not name, so a whole `evo_revision`
 * result can be passed straight back to `evo_add`.
 *
 * ## Result size
 *
 * `evo_list` and `evo_revision` answer with JSON carried as MCP *text*
 * content, so the JSON-RPC serializer escapes it a second time on the way
 * out and a modest result can encode to a much longer line (a subject of
 * quote characters is the worst case). A response whose encoded line exceeds
 * the transport cap is not lost: `fjs/protocol/mcp/stdio` retries with a small
 * `-32603` body carrying the request's `id`, so every request still gets a
 * response and the process never crashes. That is the transport's contract
 * for every tool — `cas_get` has proofs for the same double-escaping path —
 * and no tool here can pre-empt it: whether the encoded response fits is
 * known only by encoding it, which is the transport's job, and guessing from
 * an unencoded size is exactly the size estimate that must never be made.
 *
 * These tools are not served by their own process: `fjs/mcp` (the same
 * server as `cas_add`/`cas_get`/`cas_list`) builds one `Evo<O>` from its own
 * `Cas<O>` and cache slot, concatenates `evoToolRegistry` onto its own
 * registry, and serves everything from that single process — one `~/.cas/`
 * store, one Evo cache, one server.
 *
 * @module
 *
 * @import { Effect, Operation } from '../../effects/types.ts'
 * @import { MemOp } from '../../effects/memory/types.ts'
 * @import { ToolEntry, ToolsCallResult } from '../../protocol/mcp/types.ts'
 * @import { Evo } from '../../cas/evo/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 */

import { string, option, array } from '../../types/rtti/module.f.mjs'
import { lockField } from '../../media/revision/module.f.mjs'
import { pure, step } from '../../effects/module.f.mjs'
import {
    toolEntry, errorResult, okResult,
} from '../../protocol/mcp/module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/**
 * Arguments for `evo_list`: an optional status filter, forwarded unchanged to
 * `Evo.list` — omitted lists the active subjects, `true` the archived ones.
 */
export const evoListArgs = /** @type {const} */ ({
    archived: option(true),
})

/** Arguments for `evo_head`: the subject whose current heads are requested. */
export const evoHeadArgs = /** @type {const} */ ({
    subject: string,
})

/** Arguments for `evo_revision`: the hash of the revision to read. */
export const evoRevisionArgs = /** @type {const} */ ({
    hash: string,
})

/**
 * Arguments for `evo_add`: a new revision, per `fjs/cas/evo`'s
 * `RevisionData` — every field of it the caller supplies, i.e. all but
 * `generation`, which the server computes.
 *
 * `lock` is the media format's own field schema
 * (`fjs/media/revision`'s `lockField`), not a restatement of it, so the
 * advertised `inputSchema` and what the server accepts cannot drift apart. It
 * therefore accepts either form the format does — the bindings inline, or the
 * hash of a `vnd.fjs.lock` blob holding them. The map half is recursive, which
 * makes it the one argument whose JSON Schema reaches a named `$defs` rule
 * through a local `$ref` rather than being inlined whole — see
 * `fjs/media/json/schema`.
 */
export const evoAddArgs = /** @type {const} */ ({
    parents: array(string),
    snapshot: option(string),
    subject: option(string),
    archived: option(true),
    lock: option(lockField),
})

// ── Tool registry ────────────────────────────────────────────────────────────────

/** Canonical JSON encoder for the `evo_list` and `evo_revision` results. */
const toJson = stringify(identity)

/**
 * Registry of all Evo tools, bound to an `Evo<O>`.
 * @template {Operation} O
 * @param {Evo<O>} e
 * @returns {readonly ToolEntry<O | MemOp>[]}
 */
export const evoToolRegistry = e => [
    toolEntry(
        'evo_list',
        'List subjects, as a JSON array of strings. By default only the active ones: a subject is active while at least one of its current heads is not archived. Pass `archived: true` to list the archived subjects instead — those with at least one current head, all of them archived. A subject with no current heads is in neither list.',
        evoListArgs,
        // Subjects are arbitrary caller-supplied strings (unlike hashes, not
        // constrained to a newline-free alphabet), so a `join('\n')` line
        // format could not represent an empty subject or one containing a
        // newline without ambiguity — JSON encoding can.
        /** @type {(args: Ts<typeof evoListArgs>) => Effect<MemOp, ToolsCallResult>} */
        (({ archived }) => step(
            e.list(archived),
            subjects => pure(okResult(toJson(subjects)))
        )),
    ),
    toolEntry(
        'evo_head',
        'List the current head hashes (cBase32) of a subject, one per line. Empty when the subject is unknown.',
        evoHeadArgs,
        /** @type {(args: Ts<typeof evoHeadArgs>) => Effect<MemOp, ToolsCallResult>} */
        (({ subject }) => step(
            e.head(subject),
            heads => pure(okResult(heads.join('\n'))),
        )),
    ),
    toolEntry(
        'evo_revision',
        'Read one revision by hash, as JSON: `{ subject, parents, snapshot, generation, archived?, lock? }`. `parents[0]` is the mainline parent and every further entry is a merged-in branch; `parents` and `snapshot` come back in their canonical cBase32 spelling, so they compare directly against `evo_head` output. Errors when the hash is not cBase32, is not present in the store, could not be read, or does not hold a `vnd.fjs.revision` blob — use `cas_get` for raw bytes of non-revision content.',
        evoRevisionArgs,
        // The revision goes out as JSON in a text content item, like
        // `evo_list`'s. An encoded response that outgrows the transport cap is
        // the transport's `-32603`, not a tool-level error — see "Result size"
        // in the module doc.
        /** @type {(args: Ts<typeof evoRevisionArgs>) => Effect<O | MemOp, ToolsCallResult>} */
        (({ hash }) => step(
            e.revision(hash),
            result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(toJson(result[1])))
        )),
    ),
    toolEntry(
        'evo_add',
        'Add a new revision (a `vnd.fjs.revision` blob) and return its hash (cBase32). `subject` is required unless there is exactly one parent, from which it is inherited. `snapshot`, when omitted, is resolved from the parents (zero parents → `subject`, one parent → the parent\'s snapshot; a merge requires an explicit `snapshot`) and written explicitly. `generation` is computed by the server. `lock` is optional resolver input: a map from dependency subject to the cBase32 hash of the content it resolves to, or to a nested map scoping further bindings under that subject (use nesting only for conflicting choices a flat map cannot express, e.g. two dependencies needing different versions of a third). Pass a cBase32 hash instead of a map to share one already stored as a `vnd.fjs.lock` blob; the server records the reference and does not follow it.',
        evoAddArgs,
        /** @type {(input: Ts<typeof evoAddArgs>) => Effect<O | MemOp, ToolsCallResult>} */
        (input => step(
            e.add(input),
            result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(result[1]))
        )),
    ),
]
