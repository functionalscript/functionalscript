/**
 * MCP tool definitions for the Evo API (`fjs/cas/evo/module.f.ts`): subjects
 * and revision heads over the content-addressable store, backed by the
 * in-memory cache the core module maintains.
 *
 * ## Tools
 *
 * | Tool        | args                                     | action        | result                    |
 * |-------------|-------------------------------------------|---------------|---------------------------|
 * | `evo_list`  | `{}`                                       | `e.list()`    | subjects, as a JSON array of strings |
 * | `evo_head`  | `{ subject }`                              | `e.head(...)` | head hashes, one per line |
 * | `evo_add`   | `{ parents, snapshot?, subject?, archived? }` | `e.add(...)`  | hash (cBase32)            |
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
import { eff, pure, type Effect, type Operation } from '../../../effects/module.f.ts'
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

/** Arguments for `evo_add`: a new revision, per `fjs/cas/evo`'s `AddRevision`. */
export const evoAddArgs = {
    parents: array(string),
    snapshot: option(string),
    subject: option(string),
    archived: option(true),
} as const

// ── Tool registry ────────────────────────────────────────────────────────────────

/** Canonical JSON encoder for `evo_list`'s result. */
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
        (): Effect<MemOp, ToolsCallResult> =>
            eff(e.list()).step(subjects => pure(okResult(toJson(subjects)))).value,
    ),
    toolEntry(
        'evo_head',
        'List the current head hashes (cBase32) of a subject, one per line. Empty when the subject is unknown.',
        evoHeadArgs,
        ({ subject }): Effect<MemOp, ToolsCallResult> =>
            eff(e.head(subject)).step(heads => pure(okResult(heads.join('\n')))).value,
    ),
    toolEntry(
        'evo_add',
        'Add a new revision (a `vnd.fjs.revision` blob) and return its hash (cBase32). `subject` is required unless there is exactly one parent, from which it is inherited. `snapshot`, when omitted, is resolved from the parents (zero parents → `subject`, one parent → the parent\'s snapshot; a merge requires an explicit `snapshot`) and written explicitly. `generation` is computed by the server.',
        evoAddArgs,
        (input): Effect<O | MemOp, ToolsCallResult> =>
            eff(e.add(input)).step(result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(result[1]))).value,
    ),
]
