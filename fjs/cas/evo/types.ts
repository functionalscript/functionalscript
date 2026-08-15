/**
 * Type-level API for `fjs/cas/evo/module.f.mjs`: the Evo cache shape and the
 * `Evo<O>` API surface it builds.
 *
 * @module
 */

import type { Operation, Effect } from '../../effects/types.ts'
import type { MemOp } from '../../effects/memory/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type { LockField } from '../../media/revision/types.ts'

/** A cBase32 content hash, as accepted/returned by `Cas<O>`. */
export type Hash = string

/** The identity of a mutable object whose revisions are being evolved. */
export type Subject = string

/**
 * The semantic content of a revision: the media-level `Revision`
 * (`fjs/media/revision`) minus `dialect`, which is a serialization tag
 * carrying no information once decoding has validated it. One structure is
 * the vocabulary of both directions — {@link addRevision} takes it,
 * {@link readRevision} returns it — so what you add is what you get back, and
 * a value read back can be fed to `add` unchanged, without stripping fields.
 * Every direction-specific field is therefore optional, with the guarantees
 * documented per field rather than typed:
 *
 * - `parents` — required in both directions; index 0 is the mainline parent.
 *   On output the entries are canonical cBase32 spellings
 *   ({@link canonicalHash}), so they compare directly against {@link Evo.head}
 *   output.
 * - `subject` — input: absent means "inherit from my single parent" (see
 *   {@link resolveSubject}); output: always present.
 * - `snapshot` — input: absent is a write-boundary convenience resolved from
 *   the parents (see {@link resolveSnapshot}), because the stored blob
 *   requires it explicitly; output: always present, canonical, and exactly
 *   what the stored blob names.
 * - `archived` — genuinely optional in both directions; the only field that
 *   can be absent from a read.
 * - `generation` — input: **ignored**, {@link computeGeneration} derives the
 *   authoritative value from the parents; output: always present. It exists as
 *   an input field only so a read value round-trips into `add` as-is.
 * - `lock` — the format's own field, so it is an inline map or the hash of a
 *   `vnd.fjs.lock` blob (`fjs/media/lock`) holding one. Both directions
 *   validate and canonicalize every hash it names — the reference itself, or
 *   each direct value at every depth of a map. Following a reference is not
 *   done here: evo stores and reads revisions, it does not resolve
 *   dependencies.
 *
 * Relaxing what the format requires is the point, not an oversight. The stored
 * `vnd.fjs.revision` blob requires `subject`, `snapshot` and `generation`, and
 * {@link readRevision} does return all three — but this is not that blob's
 * type. It is the type of the API that *reads and constructs* revisions, and
 * its purpose is to make both easy: `add` asks only for what a caller can
 * actually know, resolving or computing the rest at the write boundary, and a
 * read hands back a value that goes straight into `add` again. A separate
 * output type with `subject`/`snapshot`/`generation` required would state that
 * one direction more precisely, at the cost of splitting the one vocabulary
 * into two — the trade this API declines, deliberately and not by omission.
 * `fjs/media/revision`'s `Revision` remains the all-required type of the
 * stored blob for anyone who wants it.
 */
export type RevisionData = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash | undefined
    readonly subject?: Subject | undefined
    readonly archived?: true | undefined
    readonly generation?: number | undefined
    readonly lock?: LockField | undefined
}

/**
 * Per-subject bookkeeping: every revision hash seen for the subject, every
 * hash any of those revisions names as a parent, and which of the seen
 * revisions are `archived`. See the module doc for why the first two sets are
 * kept (rather than a running head list), {@link headsOf} for how heads are
 * derived from them, and {@link subjectListed} for how `archived` classifies a
 * subject once its heads are known.
 *
 * `archived` is keyed by revision hash, not by subject, for the same reason
 * heads are computed at read time: which revisions are heads is only known
 * once the whole store has been folded in, so a per-subject archived flag
 * would have to be revised every time a later fold changes the head set.
 */
export type SubjectState = {
    readonly hashes: readonly Hash[]
    readonly parents: readonly Hash[]
    readonly archived: readonly Hash[]
}

/** In-memory index: subject → its {@link SubjectState}. */
export type Cache = {
    readonly bySubject: StringMap<SubjectState>
}

/** The Evo API described in `fjs/cas/evo/README.md`, bound to a `Cas<O>` and its cache slot. */
export type Evo<O extends Operation> = {
    /**
     * Returns the subjects matching a status filter: the active ones by
     * default, the archived ones when `archived` is `true`. A subject's status
     * is derived from its current heads — see {@link subjectListed}, which
     * also explains why a subject with no current heads is in neither result.
     *
     * There is deliberately no all-subjects mode: nothing needs one yet, and
     * adding it later is a compatible extension of this parameter, while
     * removing it would not be.
     */
    readonly list: (archived?: true) => Effect<MemOp, readonly Subject[]>
    /** Returns the current head hashes of `subject` (empty if unknown). */
    readonly head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    /** Adds a new head; see {@link addRevision}. */
    readonly add: (input: RevisionData) => Effect<O | MemOp, Result<Hash, string>>
    /**
     * The revision at `hash`, decoded, validated, and canonicalized; see
     * {@link readRevision}. Served from the store today, so the `MemOp` in the
     * declared operation set is unused — it is there because a revision is
     * immutable and therefore memoizable in the same cache slot the other
     * operations read, which must not become a breaking change to this type
     * when it happens.
     */
    readonly revision: (hash: Hash) => Effect<O | MemOp, Result<RevisionData, string>>
}
