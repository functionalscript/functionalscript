/**
 * `revision`: a content format for evolving mutable objects on top of the
 * immutable CAS ("evo" for evolution). A `revision` BLOB is one step in the
 * history of a mutable object — a document, a config, any piece of state
 * referenced by a stable name — linking back to its parent revision(s) so a
 * chain (or DAG, for merges) of updates can be walked, resolved to its current
 * head(s), and materialized into content.
 *
 * See `fs/cas/evo/README.md` (the deployed spec the `evolution` tag URL points
 * to) for the full design; `fs/cas/todo/revision-content-format.md` is the
 * originating design doc.
 *
 * @module
 */
import { string, number, array, option } from '../../types/rtti/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import { validate } from '../../types/rtti/validate/module.f.ts'
import { cBase32ToVec } from '../../cbase32/module.f.ts'
import { ok, error, type Result } from '../../types/result/module.f.ts'
import type { Unknown } from '../../djs/module.f.ts'

// ── ref / hash ───────────────────────────────────────────────────────────────

/**
 * A URL in content-addressed digital space. Two forms are recognized for now:
 * a cbase32 CAS hash (see `fs/cbase32/`), and a standard `https://` URL as a
 * bridge to the legacy location-addressed web. More forms are planned.
 *
 * At the rtti level `ref` is just `string` — the two recognized forms are a
 * refinement checked at runtime by `isRef`, not expressible as a distinct rtti
 * schema tag (there is no "string matching a pattern" schema in `fs/types/rtti`).
 */
export const ref = string

/** The TypeScript type a `ref` value has. */
export type Ref = Ts<typeof ref>

/**
 * The hash-only subset of `ref`: a cbase32 CAS hash, never a bridge URL. Used
 * where a bridge URL cannot stand in for a CAS blob — `parents` is the one
 * schema position that requires it.
 */
export const hash = string

/** The TypeScript type a `hash` value has. */
export type Hash = Ts<typeof hash>

/** True when `s` is a valid cbase32 CAS hash. */
export const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/** True when `s` is a valid `ref`: a CAS hash or an `https://` bridge URL. */
export const isRef = (s: string): boolean => isHash(s) || s.startsWith('https://')

// ── format tag ───────────────────────────────────────────────────────────────

/**
 * Format tag value: identifies a BLOB as a `revision` and pins the format
 * version. The interim value is the URL of the format spec itself (the
 * XML-namespace/JSON-LD approach — globally unique without a registry,
 * self-documenting). A future version migrates this to a content-addressed
 * revision reference; see the spec for the migration plan.
 */
export const evolution = 'https://functionalscript.com/fs/cas/evo/README.md' as const

// ── schema ───────────────────────────────────────────────────────────────────

/** RTTI schema for the `revision` content format. */
export const revision = {
    evolution,
    object: ref,
    parents: array(hash),
    content: option(ref),
    changes: option(array(ref)),
    generation: option(number),
    archived: option(true as const),
} as const

/** TypeScript type derived from the `revision` schema. */
export type Revision = Ts<typeof revision>

const validateSchema = validate(revision)

/**
 * Validates `value` as a `revision`: the rtti schema shape, plus the hash/ref
 * refinements the schema alone cannot express — every `parents` entry must be
 * a CAS hash (never a bridge URL), and `object`/`content`/`changes` entries
 * must be valid `ref`s.
 */
export const validateRevision = (value: Unknown): Result<Revision, string> => {
    const r = validateSchema(value)
    if (r[0] === 'error') { return error(r[1].message) }
    const v = r[1]
    for (const p of v.parents) {
        if (!isHash(p)) { return error(`parent is not a CAS hash: ${p}`) }
    }
    if (!isRef(v.object)) { return error(`object is not a valid ref: ${v.object}`) }
    if (v.content !== undefined && !isRef(v.content)) { return error(`content is not a valid ref: ${v.content}`) }
    if (v.changes !== undefined) {
        for (const c of v.changes) {
            if (!isRef(c)) { return error(`changes entry is not a valid ref: ${c}`) }
        }
    }
    return ok(v)
}

// ── store lookup ─────────────────────────────────────────────────────────────

/** A revision keyed by its own CAS hash — the shape a store exposes to the functions below. */
export type Entry = readonly [Hash, Revision]

/** Looks up a revision by its CAS hash; `undefined` when it isn't known to the caller. */
export type Get = (hash: Hash) => Revision | undefined

// ── head resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the current head(s) of `object`: revisions of that object which are
 * not listed as a parent by any other revision *of the same `object`*. Scoping
 * the "is it a parent" check to same-object revisions is what keeps a revision
 * of a different object — or an unrelated blob imported by sync — from
 * demoting a head just because it happens to reference the same hash.
 */
export const heads = (store: readonly Entry[]) => (object: Ref): readonly Hash[] => {
    const ofObject = store.filter(([, r]) => r.object === object)
    const parented = new Set<Hash>()
    for (const [, r] of ofObject) {
        for (const p of r.parents) { parented.add(p) }
    }
    return ofObject.filter(([h]) => !parented.has(h)).map(([h]) => h)
}

// ── materialization ──────────────────────────────────────────────────────────

/**
 * Materializes the content `ref` of `revision`, first iteration only: `content`
 * wins when present; otherwise the base is used as-is (`changes` application is
 * not implemented yet, so a `changes`-only revision is reported as an error
 * rather than silently ignored). The base is the parent's materialization, or
 * `object` itself when there are no parents. Requires zero or one parent — a
 * merge (multiple parents) with no `content` is unsupported by this iteration
 * and reported as an error rather than guessed at.
 */
export const materialize = (get: Get) => {
    const go = (r: Revision): Result<Ref, string> => {
        if (r.content !== undefined) { return ok(r.content) }
        if (r.changes !== undefined) { return error('changes materialization is not implemented yet') }
        if (r.parents.length === 0) { return ok(r.object) }
        if (r.parents.length > 1) { return error('merge revision without content cannot be materialized') }
        const parentHash = r.parents[0]
        const parent = get(parentHash)
        if (parent === undefined) { return error(`missing parent revision: ${parentHash}`) }
        return go(parent)
    }
    return go
}

// ── generation ───────────────────────────────────────────────────────────────

/**
 * Derives the true generation number of `revision` from its parent chain: `0`
 * for a first revision (no parents), otherwise `1 + max(parent.generation)`.
 * The schema's `generation` field is only a cache and must never be trusted
 * without checking it against this derivation.
 */
export const generationOf = (get: Get) => {
    const go = (r: Revision): Result<number, string> => {
        if (r.parents.length === 0) { return ok(0) }
        let max = -1
        for (const p of r.parents) {
            const parent = get(p)
            if (parent === undefined) { return error(`missing parent revision: ${p}`) }
            const g = go(parent)
            if (g[0] === 'error') { return g }
            if (g[1] > max) { max = g[1] }
        }
        return ok(1 + max)
    }
    return go
}

/** True when `revision.generation` (absent counts as trivially true) matches the derived generation. */
export const verifyGeneration = (get: Get) => (r: Revision): boolean => {
    if (r.generation === undefined) { return true }
    const g = generationOf(get)(r)
    return g[0] === 'ok' && g[1] === r.generation
}

// ── merge ────────────────────────────────────────────────────────────────────

/**
 * Shapes a merge revision that resolves concurrent `parents` into `content`,
 * Git-style: the format itself does not decide how to resolve the conflict —
 * that is the caller's job (an application-level merge tool deciding what
 * `content` should be) — this only builds the resulting revision with a
 * `generation` cache derived from the parents so it starts out consistent.
 */
export const merge = (get: Get) => (object: Ref, parents: readonly Hash[], content: Ref): Result<Revision, string> => {
    if (parents.length === 0) { return error('merge requires at least one parent') }
    let max = -1
    for (const p of parents) {
        const parent = get(p)
        if (parent === undefined) { return error(`missing parent revision: ${p}`) }
        const g = generationOf(get)(parent)
        if (g[0] === 'error') { return g }
        if (g[1] > max) { max = g[1] }
    }
    return ok({ evolution, object, parents, content, generation: 1 + max })
}
