/**
 * The `revision` content format: one step in the evolution of a mutable
 * object on top of an immutable content-addressable store.
 *
 * A revision blob links back to its parent revision(s) (a DAG, so concurrent
 * edits can merge) and carries either the full materialized content or an
 * incremental diff against the parent(s). This module is the pure format
 * only — the RTTI schema, the `mimeType` tag, and semantic decoding. It has
 * no store access and no effects; store-touching operations (head
 * resolution, materialization) live in `fs/cas/evo`.
 *
 * See `README.md` for the full spec.
 *
 * @module
 */
import { array, number, option, string, type String as RttiString } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import type { Unknown } from '../../djs/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'

/**
 * Format tag: identifies a BLOB as a revision and names the media type it
 * should be served with (see `README.md`, "Versioning rule": additive
 * changes keep this tag, an incompatible change mints a new one).
 */
export const mimeType = 'application/vnd.functionalscript.revision+json' as const

/**
 * A ref: a URL in content-addressed digital space. Two forms are recognized
 * for now — a cbase32 hash (see `fs/basen/cbase32/`), and a standard
 * `https://` URL bridging to the legacy location-addressed web. Schema-wise
 * this is an unconstrained `string`; `isRef` performs the semantic check.
 */
export const ref: RttiString = string

/**
 * The hash-only subset of `ref`: a parent revision is a CAS blob, so a
 * bridge URL cannot stand in for it. Schema-wise identical to `ref`;
 * `isHash` performs the semantic check.
 */
export const hash: RttiString = string

/** True when `s` is a valid cbase32-encoded CAS hash. */
export const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/** True when `s` is a `https://` bridge URL. */
export const isHttpsRef = (s: string): boolean => s.startsWith('https://')

/** True when `s` is a recognized `ref`: a cbase32 hash or a `https://` URL. */
export const isRef = (s: string): boolean => isHash(s) || isHttpsRef(s)

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

const validateRevision = validate(revision)

/**
 * Decodes an untrusted value as a `Revision`, validating both the shape
 * (via the rtti schema) and the semantic constraints the schema alone can't
 * express: every `parents` entry must be a hash (never a bridge URL), and
 * `object` / `content` / `changes` entries must be recognized `ref`s.
 */
export const decodeRevision = (value: Unknown): Result<Revision, string> => {
    const [tag, v] = validateRevision(value)
    if (tag === 'error') { return error('invalid revision shape') }
    if (!v.parents.every(isHash)) { return error('parents must be hashes, not bridge URLs') }
    if (!isRef(v.object)) { return error('object is not a recognized ref') }
    if (v.content !== undefined && !isRef(v.content)) { return error('content is not a recognized ref') }
    if (v.changes !== undefined && !v.changes.every(isRef)) { return error('changes entries must be recognized refs') }
    return ok(v)
}
