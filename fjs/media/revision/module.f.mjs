/**
 * `vnd.fjs.revision` — one step in the evolution of a mutable object on top
 * of an immutable content-addressable store.
 *
 * A revision BLOB links back to its parent revision(s) (a DAG, not just a
 * chain, so concurrent edits can merge) and carries the full materialized
 * content of that step — never an incremental diff (see the versioning rule
 * in the README). This module is the pure format only: the rtti schema, the
 * `dialect` tag, and decode/validate. No store access, no effects — head
 * resolution, materialization, and reverse indexes are a separate, deferred
 * concern.
 *
 * See `README.md` for the full spec.
 *
 * @module
 *
 * @import { Unknown } from '../json/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { DialectEntry } from '../types.ts'
 * @import { String as RttiString } from '../../rtti/types.ts'
 * @import { List, Thunk } from '../../types/list/types.ts'
 * @import { HashEntry, LockField, LockFieldSchema, LockMap, LockSchema, Revision, RevisionError } from './types.ts'
 */

import { array, number, open, option, or, string } from '../../rtti/module.f.mjs'
import { parse as rttiParse } from '../../rtti/parse/module.f.mjs'
import { parse as parseJson } from '../json/module.f.mjs'
import { cBase32ToVec } from '../../basen/cbase32/module.f.mjs'
import { error, ok, okThen } from '../../types/result/module.f.mjs'
import { dialectEntry } from '../module.f.mjs'
import { definedEntries, sort } from '../../types/object/module.f.mjs'
import { stringify } from '../json/module.f.mjs'
import { entries, find, flat, map, toArray } from '../../types/list/module.f.mjs'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = /** @type {const} */ ('vnd.fjs.revision')

/** The media type derived from {@link dialect}: `application/vnd.fjs.revision+json`. */
export const mediaType = /** @type {const} */ (`application/${dialect}+json`)

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
 * rtti schema for a lock map: an open map whose every value is either a
 * direct hash string or a nested lock map, to any depth.
 *
 * Self-referential through {@link lockValue}, which is a module-level
 * constant rather than a union rebuilt inside the thunk: the rtti data form
 * (`fjs/rtti/data`, which `toJsonSchema` routes through) closes
 * reference cycles by *identity*, so a schema handing out a fresh union thunk
 * on every call would present an infinite graph and never terminate.
 *
 * The named `@type` — rather than `@type {const}` — is what a self-referential
 * schema needs twice over: a `const` cannot reference itself in its own
 * initializer at all, and naming the recursive position is also what keeps
 * declaration emit from inlining the structure and giving up at depth (see
 * `fjs/AGENTS.md` §3.2 and `../json/rtti/module.f.mjs`).
 *
 * Like `hash`, this is `string` at the structural level; cbase32 decodability
 * of every direct value, at every depth, is enforced by
 * {@link checkReferences}.
 *
 * @type {LockSchema}
 */
export const lock = () => ['record', lockValue]

/**
 * One lock-map value: a direct hash, or a nested lock map. Written as the
 * union tuple rather than as `or(string, lock)` so the thunk carries the name
 * `lockValue`: this is where the reference cycle closes, and the data form
 * names a rule after its defining function — an anonymous thunk would publish
 * the recursion as `$defs: { '': … }` in every derived JSON Schema.
 *
 * @type {() => readonly['or', RttiString, LockSchema]}
 */
const lockValue = () => ['or', string, lock]

/**
 * rtti schema for a revision's `lock` **field**: the bindings inline as a lock
 * map, or a hash naming a `vnd.fjs.lock` blob (`fjs/media/lock`) that holds
 * one to share — see [Shared lock references](./README.md#shared-lock-references).
 *
 * Structurally identical to {@link lockValue}, and deliberately a separate
 * name: the two positions mean different things. A string *inside* a map is a
 * dependency's content hash; a string in this position is a lock blob's hash,
 * i.e. where the whole map lives. Only the top level is widened, so a nested
 * string keeps meaning exactly what it always did and no position is
 * ambiguous.
 *
 * Widening the field rather than adding a `lockRef` sibling is what keeps this
 * dialect: an older reader validates `lock` as a map and rejects a string
 * outright, whereas an unknown sibling field would validate and be read as
 * "no bindings were recorded" — the fail-open misread the versioning rule
 * exists to prevent. It also makes "inline map *and* reference" unstatable, so
 * the format defines no precedence between them, consistent with its refusal
 * to define overlay or inheritance for nested maps.
 *
 * @type {LockFieldSchema}
 */
export const lockField = () => ['or', hash, lock]

/**
 * rtti schema for a `revision` BLOB. See the README for the full semantics of
 * each field; `dialect` is the type discriminant, matched here as an exact
 * literal so structural validation alone rejects any other dialect's blob.
 *
 * `open`, and deliberately so: a bare struct is closed, so an older reader
 * would reject a blob a newer writer had added a field to, and this dialect's
 * own versioning rule — additive extension keeps the tag, see `./README.md` —
 * is stated in terms of that older reader accepting it. Do not drop the
 * wrapper.
 */
export const revisionSchema = open(/** @type {const} */ ({
    dialect,
    subject: string,
    parents: array(hash),
    snapshot: hash,
    generation: number,
    archived: or(option, true),
    lock: or(option, lockField),
}))

/** Serializes a revision canonically, recursively sorting every object's property names.
 * @type {(revision: Revision) => string}
 */
export const encodeText = stringify(sort)

/** Structural-only validator: checks the shape, not the hash / generation semantics. */
const validateShape = rttiParse(revisionSchema)

/**
 * The walk over a `lock` field's hashes, generic in what it builds: `leaf`
 * answers for one hash with the path that reaches it, `node` for one map from
 * its entries' answers. A string is a leaf wherever it sits — a shared-lock
 * reference at the top, a dependency's content inside a map — so a
 * reference's path is `scope` itself. Nested maps are scopes, not references:
 * their keys are subjects, extend the path, and are never hashes.
 *
 * `node` gets each entry's answer as a thunk, so a `node` that builds a lazy
 * list walks only as far as its consumer reads — a validator stops at the
 * first invalid hash and never descends into the rest of the map.
 *
 * @template L, N
 * @param {(path: readonly string[]) => (h: string) => L} leaf
 * @returns {(node: (entries: readonly (readonly [string, () => L | N])[]) => N) => (scope: readonly string[]) => (value: LockField) => L | N}
 */
const walkLock = leaf => node => {
    /** @type {(scope: readonly string[]) => (value: LockField) => L | N} */
    const walk = scope => value => typeof value === 'string'
        ? leaf(scope)(value)
        : node(definedEntries(value).map(([subject, v]) => [subject, () => walk([...scope, subject])(v)]))
    return walk
}

/**
 * The one statement of which fields of a revision hold hashes: every
 * `parents` entry, `snapshot`, and every hash in `lock` ({@link walkLock}).
 * {@link hashEntries} and {@link mapHashes} read the record this returns
 * without naming a field, so a new hash-bearing field is added here and
 * nowhere else, and reaches the validator and every canonicaliser at once.
 *
 * Every field is answered as a thunk, for the same reason `walkLock` hands
 * `node` thunks: a validator that stops at an invalid `parents[0]` touches
 * nothing after it. `array` builds the answer for an array of hashes from
 * its items' answers, lazily listed. The fields are in the order a validator
 * reports them.
 *
 * @template L, N, A
 * @param {(path: readonly string[]) => (h: string) => L} leaf
 * @returns {(node: (entries: readonly (readonly [string, () => L | N])[]) => N) => (array: (items: List<L>) => A) => (r: Revision) => { readonly parents: () => A, readonly snapshot: () => L, readonly lock?: () => L | N }}
 */
const walkRevision = leaf => node => array => ({ parents, snapshot, lock }) => ({
    parents: () => array(map(([i, h]) => leaf(['parents', `${i}`])(h))(entries(parents))),
    snapshot: () => leaf(['snapshot'])(snapshot),
    ...(lock === undefined ? {} : { lock: () => walkLock(leaf)(node)(['lock'])(lock) }),
})

/** @type {(path: readonly string[]) => (h: string) => List<HashEntry>} */
const entryOf = path => h => [[path, h]]

/** @type {(children: readonly (readonly [string, Thunk<HashEntry>])[]) => List<HashEntry>} */
const flatEntries = children => flat(map(([, e]) => e)(children))

/** @type {(children: readonly (readonly [string, () => LockField])[]) => LockMap} */
const lockMapOf = children => Object.fromEntries(children.map(([subject, value]) => [subject, value()]))

/**
 * Every field of `fields` with its thunk forced — the fields named by the
 * record itself, so a caller never lists them.
 *
 * @type {<T extends { readonly [k in string]: () => unknown }>(fields: T) => { readonly [K in keyof T]: ReturnType<T[K]> }}
 */
const forceFields = fields => /** @type {any} */ (Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f()])))

/**
 * Every hash-bearing field of a revision with its path, in the order
 * {@link checkReferences} reports them: `parents`, `snapshot`, then `lock`.
 * The list is lazy: reading its first entries does not walk the rest. Each
 * field's thunk already is a lazy list, so the record's values are listed as
 * they stand.
 *
 * @type {(r: Revision) => List<HashEntry>}
 */
export const hashEntries = r => flat(Object.values(walkRevision(entryOf)(flatEntries)(flat)(r)))

/**
 * The revision with every hash-bearing field passed through `f` — the lock
 * map to its leaves, its scopes kept — and every other field as it was.
 *
 * @type {(f: (h: string) => string) => (r: Revision) => Revision}
 */
export const mapHashes = f => r => ({ ...r, ...forceFields(walkRevision(() => f)(lockMapOf)(toArray)(r)) })

/** True when `s` decodes as a cbase32 CAS hash (rejects `https://` and any other non-cbase32 string).
 * @type {(s: string) => boolean}
 */
export const isHash = s => cBase32ToVec(s) !== null

/** The first entry whose hash is not one ({@link isHash}), or `null`; reads no further.
 * @type {(entries: List<HashEntry>) => HashEntry | null}
 */
const firstInvalid = find(null)(([, h]) => !isHash(h))

/**
 * Why the hash at `path` inside a `lock` field is not one: an empty path is
 * the shared-lock reference itself, any other names the subjects walked to
 * reach a map's value, so a failure deep in a nested map still says where it
 * is.
 *
 * @type {(path: readonly string[]) => (h: string) => string}
 */
const lockMessage = path => h => path.length === 0
    ? `lock reference is not a valid hash: ${h}`
    : `lock value for ${path.join('/')} is not a valid hash: ${h}`

/**
 * The first reason a structurally valid `lock` field is not a valid one, or
 * `null`. A map is checked at every depth, but only its strings: nested maps
 * are scopes, not references. A string is a reference to a `vnd.fjs.lock`
 * blob and is checked as a cbase32 hash and nothing more — this module is
 * pure format with no store access, so whether the blob exists, and what its
 * bindings mean once fetched, stay a resolver's business exactly as they do
 * for `snapshot`.
 *
 * @type {(value: LockField) => string | null}
 */
export const lockFieldError = value => {
    const invalid = firstInvalid(walkLock(entryOf)(flatEntries)([])(value))
    return invalid === null ? null : lockMessage(invalid[0])(invalid[1])
}

/**
 * The first reason a structurally valid lock map is not a valid one, or
 * `null` — {@link lockFieldError} on a map, so a reported path is relative to
 * the map itself.
 *
 * Exported because `fjs/media/lock` validates the very same map as a
 * standalone blob: one recursive schema and one semantic check, so a map means
 * the same thing inline and shared, and the two forms cannot drift.
 *
 * @type {(lock: LockMap) => string | null}
 */
export const lockMapError = lockFieldError

/** Why the hash at a {@link hashEntries} path is not one, named after its field.
 * @type {(path: readonly string[]) => (h: string) => string}
 */
const hashMessage = ([field, ...rest]) => h =>
    field === 'parents' ? `parent is not a valid hash: ${h}`
    : field === 'snapshot' ? `snapshot is not a valid hash: ${h}`
    : lockMessage(rest)(h)

/**
 * Checks the semantic refinements the structural schema can't express on an
 * already shape-valid revision: every `parents` entry and the `snapshot` must
 * decode as a cbase32 hash ({@link isHash}), the `lock` field must too —
 * every direct value at every depth of an inline map, or the shared-lock
 * reference itself ({@link lockFieldError}) — and `generation` must be a
 * non-negative *safe* integer. `subject` is not checked — it is an identity
 * string, never a snapshot reference, so any string is valid, and the same
 * goes for a lock map's keys, which are subjects.
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
 *
 * @type {(r: Revision) => Result<Revision, string>}
 */
export const checkReferences = r => {
    const invalid = firstInvalid(hashEntries(r))
    if (invalid !== null) { return error(hashMessage(invalid[0])(invalid[1])) }
    if (!Number.isSafeInteger(r.generation) || r.generation < 0) {
        return error(`generation must be a non-negative safe integer: ${r.generation}`)
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `revision` BLOB: structural
 * (rtti) validation followed by the hash / generation semantic checks.
 *
 * `RevisionError` is the union of the two stages' own error types, so each
 * failure reaches the caller as it was raised — `ValidationError` from the
 * schema, `string` from {@link checkReferences} — which is exactly what
 * `okThen` produces here.
 *
 * @type {(value: Unknown) => Result<Revision, RevisionError>}
 */
export const validate = value => okThen(checkReferences)(validateShape(value))

/**
 * Decodes `text` as a `revision` BLOB: JSON-parses it, then validates it per
 * {@link validate}. Detection is semantic, not syntactic — any JSON that
 * satisfies the schema is a revision, regardless of key order or whitespace.
 *
 * @type {(text: string) => Result<Revision, RevisionError>}
 */
export const decodeText = text => okThen(validate)(parseJson(text))

/** {@link checkReferences} as the `boolean` refinement a {@link DialectEntry} takes.
 * @type {(r: Revision) => boolean}
 */
const isValidRevision = r => {
    const [tag] = checkReferences(r)
    return tag === 'ok'
}

/**
 * This dialect as a registry entry for `fjs/media`'s `detect`. It carries the
 * semantic checks too, so a blob is detected as `vnd.fjs.revision` exactly when
 * {@link decodeText} would accept it — a structurally valid revision whose
 * `snapshot` is not a cbase32 hash is not one.
 *
 * @type {DialectEntry}
 */
export const revisionDialect = dialectEntry(revisionSchema, isValidRevision)
