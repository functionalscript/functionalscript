/**
 * The `revision` content format: one step in the evolution of a mutable
 * object on top of an immutable content-addressable store.
 *
 * A revision blob links back to its parent revision(s) (a DAG, so concurrent
 * edits can merge) and carries either the full materialized content or an
 * incremental diff against the parent(s). This module is the pure format
 * only — the RTTI schema and the `mimeType` tag. It has no store access and
 * no effects; store-touching operations (head resolution, materialization)
 * live in `fs/cas/evo`.
 *
 * See `README.md` for the full spec.
 *
 * @module
 */
import { array, number, option, string, type String as RttiString } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'

/**
 * Format tag: identifies a BLOB as a revision and names the media type it
 * should be served with (see `README.md`, "Versioning rule": additive
 * changes keep this tag, an incompatible change mints a new one). Content
 * type is determined by `mimeType` (the referenced blob's own tag), not by
 * the shape of a `ref`, so `ref` only ever names a cbase32 CAS hash.
 */
export const mimeType = 'application/vnd.functionalscript.revision+json' as const

/**
 * A ref: a cbase32-encoded CAS hash (see `fs/basen/cbase32/`) naming another
 * blob in this store. Schema-wise an unconstrained `string`; the rtti struct
 * validation this module provides does not itself check that a `ref`/`hash`
 * string decodes to a valid hash — a consumer resolving one against the
 * store (see `fs/cas/evo`) already fails gracefully on an invalid hash.
 */
export const ref: RttiString = string

/** The same shape as `ref`, named separately for documentation: every
 *  `parents` entry is a hash-only reference to a parent revision blob. */
export const hash: RttiString = string

export const revision = {
    mimeType,
    /** Identity of the mutable object being revised. */
    object: ref,
    /** Parent Revision BLOBs. Empty array means this is the first revision. */
    parents: array(hash),
    /**
     * Complete materialized content of this revision.
     *
     * If present, this is authoritative and `changes` do not need to be replayed.
     */
    content: option(ref),
    /**
     * Incremental changes introduced by this revision.
     *
     * Used only when `content` is absent.
     */
    changes: option(array(ref)),
    /**
     * Optional cached generation number within the object's evolution.
     *
     * Normally: `generation = 0` for the first revision,
     * `generation = 1 + max(parent.generation)` otherwise.
     */
    generation: option(number),
    /**
     * Marks the mutable object as archived/inactive. The revision still
     * exists; it is just hidden from normal active views.
     */
    archived: option(true),
} as const

export type Revision = Ts<typeof revision>

/** Decodes an untrusted value as a `Revision` — plain rtti shape validation. */
export const decodeRevision = validate(revision)
