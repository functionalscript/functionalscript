/**
 * `vnd.fjs.revision` — one step in the evolution of a mutable object on top
 * of an immutable content-addressable store.
 *
 * A revision BLOB links back to its parent revision(s) (a DAG, not just a
 * chain, so concurrent edits can merge) and carries the full materialized
 * content of that step — never an incremental diff (see the versioning rule
 * in the README). It may also carry an optional {@link lock} map, recording
 * the immutable content chosen for the other revision subjects its snapshot
 * references, so processing the same revision twice can produce the same
 * result. This module is the pure format only: the rtti schema, the `dialect`
 * tag, and decode/validate. No store access, no effects — head resolution,
 * materialization, resolution algorithms, and reverse indexes are a separate,
 * deferred concern.
 *
 * See `README.md` for the full spec.
 *
 * @module
 */
import { array, number, option, or, string } from '../../types/rtti/module.f.ts'
import { validate as rttiValidate, type ValidationError } from '../../types/rtti/validate/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import type { Phantom } from '../../types/phantom/module.f.ts'
import { parse as parseJson, type Unknown } from '../json/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { definedEntries } from '../../types/object/module.f.ts'
import { dialectEntry, type DialectEntry } from '../module.f.ts'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.revision' as const

/** The media type derived from {@link dialect}: `application/vnd.fjs.revision+json`. */
export const mediaType = `application/${dialect}+json` as const

/**
 * rtti schema for the snapshot-reference type: a cbase32 CAS hash string.
 *
 * This is `string` at the rtti (structural) level — rtti schemas can't
 * express string-content refinements — so cbase32 decodability, and the
 * rejection of `https://` bridge URLs and any other location-addressed
 * reference form, is enforced by {@link isHash} / {@link validate} below,
 * not by this schema on its own.
 */
export const hash = string

/**
 * The rtti schema type of {@link lock}, spelled out so the thunk can name
 * itself: `or(hash, lock)` expands to `() => ['or', typeof string, LockSchema]`.
 *
 * Written as an explicit annotation rather than inferred because the schema is
 * self-referential — inference would report `lock` as implicitly `any` for
 * being used in its own initializer. A type alias may recurse through a
 * function's return type, which is exactly where the reference sits.
 */
type LockSchema = () => readonly['record', () => readonly['or', typeof string, LockSchema]]

/**
 * A lock map: an immutable, resolver-facing index from revision `subject` to
 * either one content hash or a nested, subject-scoped lock map.
 *
 * The recursion is written into the mapped type directly — a type alias may
 * not reach itself through another alias's instantiation, so `StringMap<…>`
 * would be TS2456 here (see `fjs/types/object`). Reads are therefore
 * `string | LockMap | undefined`: a missing subject is `undefined`, and both
 * empty and partial maps are valid.
 *
 * A leaf `string` is the content selected for that subject — the same kind of
 * value `revision.snapshot` carries, not the hash of a revision blob. That is
 * what lets a lock map resolve mutually recursive subjects without a
 * content-addressing cycle: a revision's bytes include its own lock map, so
 * pointing at revisions would make two subjects that reference each other
 * unhashable, while pointing at snapshots does not.
 */
export type LockMap = {
    readonly[k in string]?: string | LockMap
}

/**
 * rtti schema for a {@link LockMap}: `['record', or(hash, lock)]`, recursing
 * into itself through the lazily-evaluated thunk body.
 *
 * The `Phantom` annotation carries the derived TypeScript type: `Ts<>` would
 * otherwise expand the self-reference forever and raise TS2589, so it reads
 * {@link LockMap} straight off the phantom key instead of walking the schema
 * (see `fjs/types/rtti/ts`). rtti's own `validate` needs no such help — it
 * instantiates a container's item validator only after finding the container
 * non-empty, so an empty map terminates the recursion at runtime.
 *
 * The schema is structure only. It says nothing about precedence between a
 * revision's own `subject`/`snapshot` binding and an entry for that same
 * subject, about how a nested map relates to the map enclosing it, or about
 * which subjects have to be present — all of that is a resolver's algorithm,
 * not the format's (see the README).
 */
export const lock: Phantom<LockSchema, LockMap> = () => ['record', or(hash, lock)] as const

/**
 * rtti schema for a `revision` BLOB. See the README for the full semantics of
 * each field; `dialect` is the type discriminant, matched here as an exact
 * literal so structural validation alone rejects any other dialect's blob.
 */
export const revisionSchema = {
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: option(true),
    lock: option(lock),
} as const

/** The TypeScript type derived from {@link revisionSchema} — the single source of truth. */
export type Revision = Ts<typeof revisionSchema>

/** Structural-only validator: checks the shape, not the hash / generation semantics. */
const validateShape = rttiValidate(revisionSchema)

/** True when `s` decodes as a cbase32 CAS hash (rejects `https://` and any other non-cbase32 string). */
export const isHash = (s: string): boolean => cBase32ToVec(s) !== null

/** Either a structural validation error or a semantic (hash / generation) error message. */
export type RevisionError = ValidationError | string

/**
 * The one semantic refinement a lock map carries: every leaf is a cbase32
 * content hash ({@link isHash}). The recursive record structure itself is
 * already guaranteed by {@link lock}, so this walk only reaches into nested
 * maps to check *their* leaves — it never interprets them.
 *
 * Deliberately store-independent, like the rest of this module: a leaf names
 * content, not a revision, so there is no blob to load and no `subject` to
 * compare a key against. Nothing else about a lock map is checkable in
 * isolation either — a subject bound both by `revision.subject`/`snapshot` and
 * by a lock entry, a nested map that omits the subject it appears under, a
 * subject the resolver never asks about, and a subject it asks about but the
 * map never binds are all structurally valid resolver inputs. Whether the
 * available bindings are enough is a property of one resolver invocation, not
 * of the blob (see the README).
 *
 * `keys` is the enclosing subject path, outermost first, and exists only to
 * point the error message at the offending entry.
 */
const checkLock = (keys: readonly string[]) => (m: LockMap): string | null => {
    for (const [k, v] of definedEntries(m)) {
        const path = [...keys, k]
        const message = typeof v === 'string'
            ? (isHash(v) ? null : `lock entry is not a valid hash: ${path.join('.')} = ${v}`)
            : checkLock(path)(v)
        if (message !== null) { return message }
    }
    return null
}

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid revision: every `parents` entry, the `snapshot`, and
 * every leaf of the optional `lock` map ({@link checkLock}) must decode as a
 * cbase32 hash ({@link isHash}), and `generation` must be a non-negative *safe*
 * integer. `subject` is not checked — it is an identity string, never a
 * snapshot reference, so any string is valid; neither are a lock map's *keys*,
 * which are subjects for the same reason.
 *
 * `generation` uses `Number.isSafeInteger`, not `Number.isInteger`: a value at
 * or above `2 ** 53` passes `isInteger` but is no longer uniquely
 * representable, so `1 + max(parents' generations)` — how a writer derives the
 * next generation — can round back to the parent's value and fail to advance.
 * Rejecting unsafe integers keeps stored generations exact.
 *
 * Both `snapshot` and `generation` are required by the schema, so no absence
 * ever has to be resolved here: a revision states its content and its
 * generation explicitly, and is fully interpretable in isolation (see the
 * README). The former snapshot-resolution algorithm (subject-as-fallback,
 * single-parent inheritance, multi-parent rejection) is gone.
 *
 * Exported separately from {@link validate} for callers that assemble a
 * `Revision` themselves from already-typed fields (e.g. `fjs/cas/evo`'s
 * `addRevision`): the shape is then guaranteed by TypeScript already, so only
 * these semantic (string-only error) checks are worth re-running — routing
 * through the combined structural-plus-semantic `validate` would add an
 * unreachable structural-error branch on the caller's side.
 */
export const checkReferences = (r: Revision): Result<Revision, string> => {
    for (const p of r.parents) {
        if (!isHash(p)) { return error(`parent is not a valid hash: ${p}`) }
    }
    if (!isHash(r.snapshot)) { return error(`snapshot is not a valid hash: ${r.snapshot}`) }
    if (!Number.isSafeInteger(r.generation) || r.generation < 0) {
        return error(`generation must be a non-negative safe integer: ${r.generation}`)
    }
    if (r.lock !== undefined) {
        const lockError = checkLock([])(r.lock)
        if (lockError !== null) { return error(lockError) }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `revision` BLOB: structural
 * (rtti) validation followed by the hash / generation semantic checks.
 */
export const validate = (value: Unknown): Result<Revision, RevisionError> => {
    const [t, v] = validateShape(value)
    if (t === 'error') { return error(v) }
    return checkReferences(v)
}

/**
 * Decodes `text` as a `revision` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a revision, regardless of key order or whitespace.
 */
export const decodeText = (text: string): Result<Revision, RevisionError> => {
    const [t, v] = parseJson(text)
    if (t === 'error') { return error(v) }
    return validate(v)
}

/** {@link checkReferences} as the `boolean` refinement a {@link DialectEntry} takes. */
const isValidRevision = (r: Revision): boolean => {
    const [tag] = checkReferences(r)
    return tag === 'ok'
}

/**
 * This dialect as a registry entry for `fjs/media`'s `detect`. It carries the
 * semantic checks too, so a blob is detected as `vnd.fjs.revision` exactly when
 * {@link decodeText} would accept it — a structurally valid revision whose
 * `snapshot` is not a cbase32 hash is not one.
 */
export const revisionDialect: DialectEntry = dialectEntry(revisionSchema, isValidRevision)
