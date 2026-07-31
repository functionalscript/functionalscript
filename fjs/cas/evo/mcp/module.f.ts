/**
 * MCP tool definitions for the Evo API (`fjs/cas/evo/module.f.ts`): subjects,
 * revision heads, and the typed read of a single revision over the
 * content-addressable store, backed by the in-memory cache the core module
 * maintains.
 *
 * ## Tools
 *
 * | Tool           | args                                          | action            | result                               |
 * |----------------|-----------------------------------------------|-------------------|--------------------------------------|
 * | `evo_list`     | `{}`                                          | `e.list()`        | subjects, as a JSON array of strings |
 * | `evo_head`     | `{ subject }`                                 | `e.head(...)`     | head hashes, one per line            |
 * | `evo_revision` | `{ hash }`                                    | `e.revision(...)` | the revision, as JSON `RevisionData` |
 * | `evo_add`      | `{ parents, snapshot?, subject?, archived? }`  | `e.add(...)`      | hash (cBase32)                       |
 *
 * `evo_add` and `evo_revision` speak the same structure — `fjs/cas/evo`'s
 * `RevisionData` — in opposite directions, so a revision read back can be
 * added again as-is. `evo_add`'s advertised arguments stay as they are: the
 * one field `evo_revision` returns that `evo_add` does not accept is
 * `generation`, which the server computes, and rtti's struct validation
 * ignores properties the schema does not name, so a whole `evo_revision`
 * result can be passed straight back to `evo_add`.
 *
 * ## Result size
 *
 * `evo_list` and `evo_revision` answer with JSON carried as MCP *text*
 * content, so the JSON-RPC serializer escapes it a second time on the way
 * out and a modest result can encode to a much longer line (a subject of
 * quote characters is the worst case). A response whose encoded line exceeds
 * the transport cap is not lost: `fjs/mcp/stdio` retries with a small
 * `-32603` body carrying the request's `id`, so every request still gets a
 * response and the process never crashes. That is the transport's contract
 * for every tool — `cas_get` has proofs for the same double-escaping path —
 * and no tool here can pre-empt it: whether the encoded response fits is
 * known only by encoding it, which is the transport's job, and guessing from
 * an unencoded size is exactly the size estimate that must never be made.
 *
 * These tools are not served by their own process: `fjs/cas/mcp` (the same
 * server as `cas_add`/`cas_get`/`cas_list`) builds one `Evo<O>` from its own
 * `Cas<O>` and cache slot, concatenates `evoToolRegistry` onto its own
 * registry, and serves everything from that single process — one `~/.cas/`
 * store, one Evo cache, one server.
 *
 * @module
 */
import { string, option, array } from '../../../types/rtti/module.f.ts'
import { pure, step, type Effect, type Operation } from '../../../effects/module.f.ts'
import { type MemOp } from '../../../effects/memory/module.f.ts'
import {
    toolEntry, errorResult, okResult,
    type ToolEntry, type ToolsCallResult,
} from '../../../mcp/module.f.ts'
import { stringify } from '../../../media/json/module.f.ts'
import { identity } from '../../../types/function/module.f.ts'
import { type Evo } from '../module.f.ts'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `evo_list`: none. */
export const evoListArgs = {} as const

/** Arguments for `evo_head`: the subject whose current heads are requested. */
export const evoHeadArgs = {
    subject: string,
} as const

/** Arguments for `evo_revision`: the hash of the revision to read. */
export const evoRevisionArgs = {
    hash: string,
} as const

/**
 * Arguments for `evo_add`: a new revision, per `fjs/cas/evo`'s
 * `RevisionData` — every field of it the caller supplies, i.e. all but
 * `generation`, which the server computes.
 */
export const evoAddArgs = {
    parents: array(string),
    snapshot: option(string),
    subject: option(string),
    archived: option(true),
} as const

// ── Tool registry ────────────────────────────────────────────────────────────────

/** Canonical JSON encoder for the `evo_list` and `evo_revision` results. */
const toJson = stringify(identity)

/** Registry of all Evo tools, bound to an `Evo<O>`. */
export const evoToolRegistry =
    <O extends Operation>(e: Evo<O>): readonly ToolEntry<O | MemOp>[] => [
    toolEntry(
        'evo_list',
        'List all subjects with at least one stored revision, as a JSON array of strings.',
        evoListArgs,
        // Subjects are arbitrary caller-supplied strings (unlike hashes, not
        // constrained to a newline-free alphabet), so a `join('\n')` line
        // format could not represent an empty subject or one containing a
        // newline without ambiguity — JSON encoding can.
        (): Effect<MemOp, ToolsCallResult> => step(
            e.list(),
            subjects => pure(okResult(toJson(subjects)))
        ),
    ),
    toolEntry(
        'evo_head',
        'List the current head hashes (cBase32) of a subject, one per line. Empty when the subject is unknown.',
        evoHeadArgs,
        ({ subject }): Effect<MemOp, ToolsCallResult> => step(
            e.head(subject),
            heads => pure(okResult(heads.join('\n'))),
        )
    ),
    toolEntry(
        'evo_revision',
        'Read one revision by hash, as JSON: `{ subject, parents, snapshot, generation, archived? }`. `parents[0]` is the mainline parent and every further entry is a merged-in branch; `parents` and `snapshot` come back in their canonical cBase32 spelling, so they compare directly against `evo_head` output. Errors when the hash is not cBase32, is not present in the store, could not be read, or does not hold a `vnd.fjs.revision` blob — use `cas_get` for raw bytes of non-revision content.',
        evoRevisionArgs,
        // The revision goes out as JSON in a text content item, like
        // `evo_list`'s. An encoded response that outgrows the transport cap is
        // the transport's `-32603`, not a tool-level error — see "Result size"
        // in the module doc.
        ({ hash }): Effect<O | MemOp, ToolsCallResult> => step(
            e.revision(hash),
            result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(toJson(result[1])))
        ),
    ),
    toolEntry(
        'evo_add',
        'Add a new revision (a `vnd.fjs.revision` blob) and return its hash (cBase32). `subject` is required unless there is exactly one parent, from which it is inherited. `snapshot`, when omitted, is resolved from the parents (zero parents → `subject`, one parent → the parent\'s snapshot; a merge requires an explicit `snapshot`) and written explicitly. `generation` is computed by the server.',
        evoAddArgs,
        (input): Effect<O | MemOp, ToolsCallResult> => step(
            e.add(input),
            result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(result[1]))
        ),
    ),
]
