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
import { array, number, option, string, unknown as rttiUnknown } from '../../types/rtti/module.f.ts'
import { validate as rttiValidate, type ValidationError } from '../../types/rtti/validate/module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import type { Phantom } from '../../types/phantom/module.f.ts'
import { parse as parseJson, type Unknown } from '../json/module.f.ts'
import { cBase32ToVec } from '../../basen/cbase32/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { definedEntries, isObject } from '../../types/object/module.f.ts'
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
 * rtti schema for the `lock` field.
 *
 * Structurally this is `unknown`, **not** the `['record', or(hash, lock)]` the
 * format actually describes — the same layering as `hash` being `string`: the
 * shape rtti can express here is not the shape that is safe to check. A
 * recursive record schema spends validator frames in proportion to the
 * *input's* nesting depth, and the input is untrusted. A ~12 KiB blob nested
 * 2000 deep overflows the call stack, and `fjs/cas/evo`'s `buildCache` decodes
 * every blob in the store, so one such blob would abort the scan instead of
 * being skipped as a non-revision — a stored-blob denial of service on
 * startup. {@link checkLock} validates the whole shape iteratively instead, at
 * any depth, reporting failure as a message like every other refinement here.
 *
 * The recursive schema returns once rtti can validate a self-referential
 * schema without unbounded stack growth
 * ([todo/recursive-validation-stack-safety.md](../../types/rtti/todo/recursive-validation-stack-safety.md)).
 * Until then {@link LockMap} and the README carry the shape.
 *
 * The `Phantom` annotation keeps the derived type exact: `Ts<>` reads
 * {@link LockMap} off the phantom key, so `Revision['lock']` stays
 * `LockMap | undefined` rather than widening to rtti's `Unknown`.
 */
const lockThunk = rttiUnknown

/** @see {@link lockThunk} — the `lock` field's schema, typed as {@link LockMap}. */
export const lock: Phantom<typeof lockThunk, LockMap> = lockThunk

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

/** One pending lock value and the subject path that reaches it, outermost first. */
type LockEntry = readonly[readonly string[], unknown]

/** The entries of one lock value; none for a hash leaf or any non-map. */
const lockChildren = ([keys, value]: LockEntry): readonly LockEntry[] =>
    isObject(value)
        ? definedEntries(value).map(([k, v]) => [[...keys, k], v] as const)
        : []

/**
 * Validates a lock map **completely**: every value is either a cbase32 content
 * hash ({@link isHash}) or a nested map, to any depth. Returns `null` when the
 * whole map is well formed, else a message naming the offending subject path.
 *
 * This is the *only* check the `lock` field gets, by design on two counts.
 *
 * It is **total over any input**, not a refinement of an already shape-valid
 * value, because it is reached from two directions: {@link validate} runs
 * structural validation first, but {@link checkReferences} is called directly
 * by writers such as `fjs/cas/evo`'s `addRevision` on a value TypeScript
 * believes is a `Revision` and the runtime does not — an MCP `evo_add`
 * argument object keeps every undeclared key rtti validation ignored, `lock`
 * among them. A structure-assuming walk let `lock: {B: 0}` through to be
 * stored as a revision no reader would accept, and threw outright on
 * `lock: null`.
 *
 * It is **iterative**, processing one level at a time rather than recursing,
 * because nesting depth comes from untrusted input — see {@link lock} for the
 * denial of service a per-level stack frame allows.
 *
 * Store-independent like the rest of this module: a leaf names content, not a
 * revision, so there is no blob to load and no `subject` to compare a key
 * against. Nothing else about a lock map is checkable in isolation either — a
 * subject bound both by `revision.subject`/`snapshot` and by a lock entry, a
 * nested map that omits the subject it appears under, a subject the resolver
 * never asks about, and a subject it asks about but the map never binds are
 * all valid resolver inputs. Whether the bindings are enough is a property of
 * one resolver invocation, not of the blob (see the README).
 */
const checkLock = (root: unknown): string | null => {
    // The lock itself is a map, never a bare hash: `lock` binds subjects.
    if (!isObject(root)) { return 'lock is not a map' }
    let level: readonly LockEntry[] = lockChildren([[], root])
    while (level.length !== 0) {
        for (const [keys, value] of level) {
            const path = keys.join('.')
            if (typeof value === 'string') {
                if (!isHash(value)) {
                    return `lock entry is not a valid hash: ${path} = ${value}`
                }
            } else if (!isObject(value)) {
                return `lock entry is not a hash or a nested map: ${path}`
            }
        }
        level = level.flatMap(lockChildren)
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
        const lockError = checkLock(r.lock)
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
