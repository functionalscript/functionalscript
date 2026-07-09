/**
 * Revision content format: evolving mutable objects on top of immutable CAS.
 *
 * A `revision` is a BLOB representing one step in the evolution of a mutable
 * object (a document, a config, any piece of mutable state referenced by a
 * stable name). Revisions link back to their parent revision(s) — a DAG, not
 * just a chain, so concurrent edits can merge — and carry either the full
 * materialized content or an incremental diff against the parent(s).
 *
 * See [`README.md`](./README.md) for the full format spec.
 *
 * @module
 */
import { array, number, option, string } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate as rttiValidate } from '../../types/rtti/validate/module.f.ts'
import { cBase32ToVec } from '../../cbase32/module.f.ts'
import { ok, error, type Result } from '../../types/result/module.f.ts'

// ── ref / hash ──────────────────────────────────────────────────────────────

/**
 * A URL in content-addressed digital space. Two forms are recognized today: a
 * cbase32 hash (a native CAS address, see [`fs/cbase32`](../../cbase32/)) and
 * a standard `https://` URL as a bridge to the legacy location-addressed web.
 * More forms are planned — see `README.md`.
 *
 * Structurally just a `string` in the RTTI schema (there is no "refine"
 * concept in `fs/types/rtti`); `isRef` below carries the semantic check that
 * distinguishes it from an arbitrary string.
 */
export const ref = string

/** TypeScript type for {@link ref}. */
export type Ref = Ts<typeof ref>

/**
 * The hash-only subset of `ref`: a cbase32 CAS address, never a bridge URL.
 * Used where a bridge URL must not stand in for the value — `parents`, since
 * a parent revision is always a CAS blob addressed by its own hash.
 */
export const hash = string

/** TypeScript type for {@link hash}. */
export type Hash = Ts<typeof hash>

/** True when `s` decodes as a cbase32 CAS hash (a native `hash`/`ref`). */
export const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/** True when `s` is a recognized `ref`: a cbase32 hash or an `https://` bridge URL. */
export const isRef = (s: string): boolean => isHash(s) || s.startsWith('https://')

// ── revision ──────────────────────────────────────────────────────────────

/**
 * Format tag for a `revision` BLOB: identifies the BLOB as a revision and
 * names the media type it should be served with — the same key MCP resource
 * contents use for the served type. A vendor-tree (RFC 6838) media type with
 * the `+json` structured-syntax suffix (RFC 6839); see `README.md` for the
 * versioning rule (additive changes keep the tag, breaking changes mint a
 * new one).
 */
export const mimeType = 'application/vnd.functionalscript.revision+json' as const

/** RTTI schema for a `revision` BLOB. See `README.md` for the field-by-field spec. */
export const revision = {
    mimeType,
    /** Identity of the mutable object being revised. */
    object: ref,
    /** Parent revision BLOBs (hash-only — a parent is always a CAS blob). Empty means first revision. */
    parents: array(hash),
    /** Complete materialized content. Authoritative when present. */
    content: option(ref),
    /** Incremental changes against the parent(s). Used only when `content` is absent. */
    changes: option(array(ref)),
    /** Cached generation number — re-derivable from `parents`, never trust it unverified. */
    generation: option(number),
    /** Marks the mutable object as archived/inactive. The revision still exists. */
    archived: option(true),
} as const

/** TypeScript type for {@link revision}. */
export type Revision = Ts<typeof revision>

const structValidate = rttiValidate(revision)

/**
 * Validates an unknown value as a `revision`: structural RTTI validation
 * (`revision` schema) plus the semantic checks the schema alone cannot
 * express — every `parents` entry must decode as a cbase32 hash (a bridge URL
 * must not validate there), and `object`/`content`/`changes` refs must be a
 * recognized `ref` form. A revision with a non-CAS parent does not validate.
 */
export const parseRevision = (value: unknown): Result<Revision, string> => {
    const r = structValidate(value as any)
    if (r[0] === 'error') { return error(`${r[1].path.join('.')}: ${r[1].message}`) }
    const rev = r[1]
    if (!isRef(rev.object)) { return error('object: not a recognized ref') }
    for (const p of rev.parents) {
        if (!isHash(p)) { return error('parents: not a cbase32 hash') }
    }
    if (rev.content !== undefined && !isRef(rev.content)) { return error('content: not a recognized ref') }
    if (rev.changes !== undefined) {
        for (const c of rev.changes) {
            if (!isRef(c)) { return error('changes: not a recognized ref') }
        }
    }
    return ok(rev)
}

// ── head resolution ─────────────────────────────────────────────────────────

/** A stored revision paired with its own content hash. */
export type Entry = {
    readonly hash: Hash
    readonly revision: Revision
}

/**
 * Resolves the head(s) of `object`: the revisions of `object` in `entries`
 * that are not listed as a parent by any *other* revision of the same
 * `object`. A reverse index scoped per object — a revision of a different
 * object referencing the same hash (or an unrelated blob) never demotes a
 * head, and a head can be demoted retroactively simply by re-running this
 * over a larger `entries` set once a new same-object child is synced in.
 */
export const heads = (object: Ref) => (entries: readonly Entry[]): readonly Hash[] => {
    const sameObject = entries.filter(e => e.revision.object === object)
    const referencedAsParent = new Set<Hash>()
    for (const e of sameObject) {
        for (const p of e.revision.parents) { referencedAsParent.add(p) }
    }
    return sameObject.filter(e => !referencedAsParent.has(e.hash)).map(e => e.hash)
}

// ── materialization ─────────────────────────────────────────────────────────

/** Looks up a stored revision by hash. `undefined` when not present/resolvable. */
export type Resolve = (hash: Hash) => Revision | undefined

/**
 * Materializes the content `ref` of `rev`, per the precedence rule: `content`
 * has priority when present; otherwise the base — the materialization of the
 * single parent, or `object` itself when there are no parents — is used.
 *
 * First iteration only: `changes` replay is not implemented, so a revision
 * with `changes` and no `content` cannot be materialized here (`undefined`),
 * and a revision with more than one parent must carry `content` (a merge
 * revision) — materializing a bare multi-parent revision also returns
 * `undefined`. An unresolvable parent (`resolve` returns `undefined`) also
 * yields `undefined` rather than throwing, since a store may legitimately be
 * missing a blob it hasn't synced yet.
 */
export const materialize = (resolve: Resolve) => (object: Ref) => (rev: Revision): Ref | undefined => {
    if (rev.content !== undefined) { return rev.content }
    if (rev.changes !== undefined) { return undefined }
    if (rev.parents.length === 0) { return object }
    if (rev.parents.length > 1) { return undefined }
    const parent = resolve(rev.parents[0])
    return parent === undefined ? undefined : materialize(resolve)(object)(parent)
}

// ── generation cache ─────────────────────────────────────────────────────────

/**
 * Cheap generation cache for a *new* revision being constructed locally:
 * `0` when `parents` is empty, else `1 + max` of each parent's own cached
 * `generation` (defaulting an uncached/unresolved parent to `0`). This trusts
 * the parent's cached field, which is fine for a producer building on top of
 * its own (already-trusted) history — see {@link actualGeneration} for the
 * untrusted-input counterpart.
 */
export const cachedGeneration = (resolve: Resolve) => (parents: readonly Hash[]): number => {
    if (parents.length === 0) { return 0 }
    let max = -1
    for (const p of parents) {
        const g = resolve(p)?.generation ?? 0
        if (g > max) { max = g }
    }
    return max + 1
}

/**
 * Recomputes the generation of the revision at `h` by walking the *actual*
 * parent chain — it never trusts a parent's own cached `generation` field,
 * which is exactly the untrusted value this guards against when a revision
 * arrives from sync. Throws if `h` (or an ancestor) is unresolvable; callers
 * that need a total function should resolve reachability first.
 */
export const actualGeneration = (resolve: Resolve) => (h: Hash): number => {
    const rev = resolve(h)
    if (rev === undefined) { throw new Error(`revision-content-format: unresolved revision ${h}`) }
    return rev.parents.length === 0 ? 0 : 1 + Math.max(...rev.parents.map(actualGeneration(resolve)))
}

/**
 * True when `rev.generation` is absent (nothing to verify) or equals the
 * generation recomputed from the actual parent chain (never the parents' own
 * cached values) — the check a consumer must run before trusting a cached
 * `generation` from an untrusted source.
 */
export const verifyGeneration = (resolve: Resolve) => (rev: Revision): boolean =>
    rev.generation === undefined
    || rev.generation === (rev.parents.length === 0 ? 0 : 1 + Math.max(...rev.parents.map(actualGeneration(resolve))))

// ── archived ─────────────────────────────────────────────────────────────────

/** True when `rev` marks its object as archived/inactive. */
export const isArchived = (rev: Revision): boolean => rev.archived === true

// ── merge ────────────────────────────────────────────────────────────────────

/**
 * Builds a merge revision resolving concurrent `parents` (heads) of `object`
 * into one new revision carrying the already-resolved `content`. Mirrors
 * Git's model: the format does not resolve the conflict itself, a merge tool
 * (or a person) does, and this just records that resolution as a new
 * revision whose `parents` are the merged heads. `parents` must have at
 * least two entries — resolving one head is not a merge (see `README.md`).
 */
export const merge = (resolve: Resolve) => (object: Ref) => (parents: readonly Hash[]) => (content: Ref): Revision => {
    if (parents.length < 2) { throw new Error('revision-content-format: merge requires at least two parents') }
    return {
        mimeType,
        object,
        parents,
        content,
        generation: cachedGeneration(resolve)(parents),
    }
}
