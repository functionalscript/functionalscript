/**
 * Evo API: subjects and revision heads, cached in memory over an immutable
 * content-addressable store.
 *
 * A `Cas<O>` stores `vnd.fjs.revision` blobs ([`fs/media/revision`](../../media/revision/module.f.ts))
 * like any other content: as immutable bytes under a hash. Resolving "what
 * are the current heads of subject X" from that store means walking every
 * stored revision and reversing the parent links — too expensive to redo on
 * every query. This module scans the store once into an in-memory `Cache`
 * ([`fs/effects/memory`](../../effects/memory/module.f.ts)) mapping subject →
 * head hashes, then keeps the cache current as new revisions are `add`ed
 * through it — or, for a revision stored some other way (e.g. the generic
 * `cas_add` MCP tool), via {@link syncRevision}.
 *
 * A **head** of a subject is any stored revision of that subject whose hash
 * is not referenced as a `parents` entry by another revision of the same
 * subject (see [`fs/media/revision/README.md`](../../media/revision/README.md)).
 * `Cache` therefore tracks, per subject, every revision hash seen and every
 * hash referenced as somebody's parent; heads are the set difference between
 * the two, computed at read time ({@link headsOf}). Storing both sets rather
 * than a running head list is what makes folding revisions truly order
 * independent: `cas.list()` (used by {@link buildCache} to scan an existing
 * store) returns hashes in hash order, not revision ancestry, so a child can
 * be seen before its parent — an incremental "drop this hash from the head
 * set, then re-add whichever hash we just saw" would wrongly resurrect the
 * parent as a head once it is scanned after its child. Tracking the two sets
 * separately and only subtracting at read time has no such ordering
 * dependency: whichever order revisions are folded in, `hashes − parents`
 * converges to the same result. {@link buildCache} and {@link addRevision}
 * both fold through the same {@link addRevisionToCache}, the former over the
 * whole store at once, the latter incrementally for one new revision.
 *
 * @module
 */
import { pure, foldStep, type Effect, type Operation } from '../../effects/module.f.ts'
import { create, read, write, type Key, type MemOp } from '../../effects/memory/module.f.ts'
import { collectRead, type Cas } from '../module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'
import { tryUtf8 } from '../../text/module.f.ts'
import { decodeText, dialect, checkReferences, isHash, type Revision } from '../../media/revision/module.f.ts'
import { stringify } from '../../media/json/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { ok, error, type Ok, type Result } from '../../types/result/module.f.ts'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.ts'
import { at, definedEntries, type StringMap } from '../../types/object/module.f.ts'
import { unwrap } from '../../types/nullable/module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'

/** A cBase32 content hash, as accepted/returned by `Cas<O>`. */
export type Hash = string

/** The identity of a mutable object whose revisions are being evolved. */
export type Subject = string

/**
 * Input to {@link addRevision}: everything the caller supplies for a new
 * revision. Both `subject` and `snapshot` are input conveniences the write
 * boundary resolves, because the stored `vnd.fjs.revision` blob requires
 * them explicitly (see `fs/media/revision`): `subject`, when omitted, is
 * inherited from the single parent's own `subject` (see
 * {@link resolveSubject}); `snapshot`, when omitted, is resolved from the
 * parents (see {@link resolveSnapshot}) — the inference the format used to
 * carry, run once here with the parents already in hand. `generation` is
 * never an input: {@link computeGeneration} derives the authoritative value.
 */
export type AddRevision = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash | undefined
    readonly subject?: Subject | undefined
    readonly archived?: true | undefined
}

/**
 * Per-subject bookkeeping: every revision hash seen for the subject, and
 * every hash any of those revisions names as a parent. See the module doc
 * for why both sets are kept (rather than a running head list) and
 * {@link headsOf} for how heads are derived from them.
 */
export type SubjectState = {
    readonly hashes: readonly Hash[]
    readonly parents: readonly Hash[]
}

/** In-memory index: subject → its {@link SubjectState}. */
export type Cache = {
    readonly bySubject: StringMap<string, SubjectState>
}

/** A cache with no known subjects yet — the starting point for {@link buildCache}. */
export const emptyCache: Cache = { bySubject: {} }

/** Canonical JSON encoder for a `Revision` — key order carries no meaning for detection. */
const toJson = stringify(identity)

const emptySubjectState: SubjectState = { hashes: [], parents: [] }

/** Adds every item of `items` to `set` that isn't already there, preserving `set`'s existing order. */
const union = (set: readonly Hash[]) => (items: readonly Hash[]): readonly Hash[] =>
    items.reduce((acc: readonly Hash[], h) => acc.includes(h) ? acc : [...acc, h], set)

/**
 * Re-encodes `h` in its canonical cBase32 spelling. `cBase32ToVec` accepts
 * more than one spelling of the same hash (e.g. case, or alphabet aliases),
 * but {@link headsOf} compares hash strings directly, so a parent reference
 * recorded in a non-canonical spelling would never match the canonical
 * spelling a revision's own hash is always recorded under ({@link
 * addRevisionToCache}'s `hash` parameter is always produced by
 * `vecToCBase32`) — silently keeping a demoted revision listed as a head.
 * Every caller of this module reaches {@link addRevisionToCache} only with a
 * `revision` whose `parents` already passed `isHash`
 * (`fs/media/revision` `checkReferences`), so decoding here cannot fail.
 */
const canonicalHash = (h: Hash): Hash => vecToCBase32(unwrap(cBase32ToVec(h)))

/** A subject's current heads: revision hashes seen that no other revision of the same subject names as a parent. */
const headsOf = (state: SubjectState): readonly Hash[] =>
    state.hashes.filter(h => !state.parents.includes(h))

/**
 * Folds one more stored revision into `cache`: `hash` joins its subject's
 * `hashes` set, and `revision.parents` (canonicalized, see
 * {@link canonicalHash}) join its `parents` set. Order independent (see the
 * module doc) — used both for a full-store scan and for a single
 * incremental `add`.
 *
 * Looks `revision.subject` up via {@link at} (own-property only), not plain
 * bracket indexing: a subject is an arbitrary caller-supplied string
 * (`AddRevision.subject`, or the MCP `evo_add`/`evo_head` argument), so it
 * can collide with an inherited `Object.prototype` name (`toString`,
 * `constructor`, …) — bracket indexing would then return that inherited
 * value instead of "no entry yet" and crash on the (non-array) `.hashes`
 * access below.
 */
const addRevisionToCache = (hash: Hash, revision: Revision) => (cache: Cache): Cache => {
    const existing = at(revision.subject)(cache.bySubject) ?? emptySubjectState
    const state: SubjectState = {
        hashes: union(existing.hashes)([hash]),
        parents: union(existing.parents)(revision.parents.map(canonicalHash)),
    }
    return { bySubject: { ...cache.bySubject, [revision.subject]: state } }
}

/**
 * Decodes already-read bytes as a `vnd.fjs.revision`. Returns `null` for
 * anything that is not a valid revision — bytes that are not valid UTF-8, or
 * text that does not parse/validate as the dialect.
 */
export const decodeRevisionVec = (value: Vec): Revision | null => {
    const text = fromVec(value)
    if (text === null) { return null }
    const [decodeTag, revision] = decodeText(text)
    return decodeTag === 'error' ? null : revision
}

/**
 * Reads and decodes the blob at `hash` as a `vnd.fjs.revision`. Returns
 * `null` for anything that is not a valid revision — a missing hash, or (via
 * {@link decodeRevisionVec}) bytes that are not valid UTF-8 or do not
 * parse/validate as the dialect — so a store containing arbitrary other
 * content can be scanned without failing the whole cache build.
 */
export const decodeRevisionBlob = <O extends Operation>(cas: Cas<O>) => (hash: Vec): Effect<O, Revision | null> =>
    collectRead(cas.read(hash)).step(([tag, value]) => pure(tag === 'error' ? null : decodeRevisionVec(value)))

/**
 * Scans every hash in `cas` and builds a fresh {@link Cache} from the
 * `vnd.fjs.revision` blobs found among them. Non-revision blobs are ignored.
 */
export const buildCache = <O extends Operation>(cas: Cas<O>): Effect<O, Cache> =>
    cas.list().step(hashes =>
        foldStep((hash: Vec) => (cache: Cache): Effect<O, Cache> =>
            decodeRevisionBlob(cas)(hash).step(revision =>
                pure(revision === null ? cache : addRevisionToCache(vecToCBase32(hash), revision)(cache))))
        (emptyCache)(hashes))

/** Scans `cas` once and allocates a memory slot holding the resulting {@link Cache}. */
export const initEvo = <O extends Operation>(cas: Cas<O>): Effect<O | MemOp, Key<Cache>> =>
    buildCache(cas).step(cache => create(cache))

/** Reads, then rewrites, the cache at `cacheKey` with `revision` folded in at `hash`. */
const foldIntoCache = (cacheKey: Key<Cache>) => (hash: Hash) => (revision: Revision): Effect<MemOp, void> =>
    read(cacheKey).step(cache => write(cacheKey, addRevisionToCache(hash, revision)(cache)).step(() => pure(undefined)))

/**
 * Folds `value` — bytes already written to a `Cas` at `hash` by some other
 * caller — into the cache at `cacheKey` if it decodes as a `vnd.fjs.revision`
 * ({@link decodeRevisionVec}); a no-op otherwise. `cas_add`/`evo_add`
 * (`fs/cas/mcp`) are two ways to reach the same store — a plain `cas_add`
 * call can store a revision blob without going through {@link addRevision},
 * and this is what keeps the cache honest about it without rescanning the
 * whole store.
 */
export const syncRevision = (cacheKey: Key<Cache>) => (hash: Vec) => (value: Vec): Effect<MemOp, void> => {
    const revision = decodeRevisionVec(value)
    return revision === null ? pure(undefined) : foldIntoCache(cacheKey)(vecToCBase32(hash))(revision)
}

/**
 * Resolves and validates one `parents` entry: the hash must decode as
 * cBase32 and the blob it names must itself be a `vnd.fjs.revision`. Used
 * unconditionally for every parent — even when `subject` is given explicitly
 * — so `add` never stores a revision whose declared parent is missing or not
 * a revision.
 */
const resolveParent = <O extends Operation>(cas: Cas<O>) => (parentRef: Hash): Effect<O, Result<Revision, string>> => {
    const parentHash = cBase32ToVec(parentRef)
    if (parentHash === null) {
        return pure(error(`invalid parent hash: ${parentRef}`))
    }
    return decodeRevisionBlob(cas)(parentHash).step(parent =>
        pure(parent === null ? error(`parent is not a revision blob: ${parentRef}`) : ok(parent)))
}

/** Resolves and validates every entry of `parents`, in order, short-circuiting on the first failure. */
const resolveParents = <O extends Operation>(cas: Cas<O>) => (parents: readonly Hash[]): Effect<O, Result<readonly Revision[], string>> => {
    const init: Result<readonly Revision[], string> = ok([])
    return foldStep((parentRef: Hash) => (acc: Result<readonly Revision[], string>): Effect<O, Result<readonly Revision[], string>> => {
        if (acc[0] === 'error') { return pure(acc) }
        return resolveParent(cas)(parentRef).step((parentResult): Effect<never, Result<readonly Revision[], string>> =>
            pure(parentResult[0] === 'error' ? parentResult : ok([...acc[1], parentResult[1]])))
    })(init)(parents)
}

/**
 * Resolves the `subject` of a new revision from its already-resolved
 * `parents`: the caller's explicit `subject` when given, otherwise the
 * single parent's own `subject` (a revision does not carry its own
 * subject-inheritance rule the way `snapshot` does, so this is derived
 * explicitly). More or fewer than one parent without an explicit `subject`
 * cannot be resolved.
 */
const resolveSubject = (input: AddRevision) => (parents: readonly Revision[]): Result<Subject, string> => {
    if (input.subject !== undefined) { return ok(input.subject) }
    if (parents.length !== 1) {
        return error('subject is required unless there is exactly one parent to inherit it from')
    }
    return ok(parents[0].subject)
}

/**
 * Checks that every already-resolved parent belongs to `subject`. A revision
 * models one step in the evolution of a single mutable object, so a parent
 * from a different subject would silently graft the new revision (and any
 * inherited `snapshot`) onto an unrelated object's history; head demotion is
 * also scoped to `revision.subject` ({@link addRevisionToCache}), so a
 * cross-subject parent would never even leave its own subject's head set —
 * this must be rejected rather than merely producing a head mismatch later.
 */
const validateParentSubjects = (subject: Subject) => (parents: readonly Revision[]): Result<void, string> => {
    const mismatch = parents.find(p => p.subject !== subject)
    return mismatch === undefined
        ? ok(undefined)
        : error(`parent belongs to a different subject (${mismatch.subject}), expected ${subject}`)
}

/**
 * Resolves the `snapshot` of a new revision — the inference the
 * `vnd.fjs.revision` format used to carry, now run once at the write boundary
 * with the parents already resolved and written explicitly into the stored
 * blob (which requires `snapshot`; see `fs/media/revision`). The caller's
 * explicit `snapshot` is used as-is when given; otherwise zero parents fall
 * back to `subject` as the snapshot reference (which must then be a hash),
 * exactly one parent inherits that parent's stored `snapshot`, and more than
 * one parent without an explicit `snapshot` cannot be resolved — there is no
 * single parent snapshot to inherit, and falling back to `subject` would
 * silently lose the merge result.
 */
const resolveSnapshot = (input: AddRevision) => (subject: Subject) => (parents: readonly Revision[]): Result<Hash, string> => {
    if (input.snapshot !== undefined) { return ok(input.snapshot) }
    if (parents.length === 0) {
        return isHash(subject)
            ? ok(subject)
            : error(`subject must be a valid hash when snapshot is omitted and there are no parents: ${subject}`)
    }
    if (parents.length === 1) { return ok(parents[0].snapshot) }
    return error('snapshot is required when a revision has more than one parent')
}

/**
 * The authoritative `generation` of a new revision: `0` for a root
 * (`parents: []`), else `1 + max(parents' generations)`. Computed here from
 * the already-decoded parents, never taken from input — everything evo writes
 * follows the formula by construction (see the `generation` semantics in
 * [`fs/cas/evo/todo/evo-revision.md`](todo/evo-revision.md)).
 *
 * The max is a `reduce`, not `Math.max(...parents.map(...))`: `parents` is
 * caller-sized (the direct API or the `evo_add` MCP tool), and argument-spread
 * of a large array overflows the JS call stack with a `RangeError` before the
 * documented `Result` error path can run — a `reduce` has no such limit.
 */
const computeGeneration = (parents: readonly Revision[]): number =>
    parents.length === 0 ? 0 : 1 + parents.reduce((max, p) => Math.max(max, p.generation), 0)

/**
 * Adds a new revision to `cas` and folds it into the cache at `cacheKey`.
 *
 * Steps: resolve and validate every parent ({@link resolveParents}), resolve
 * `subject` from them ({@link resolveSubject}) and check every parent
 * actually belongs to it ({@link validateParentSubjects}), resolve `snapshot`
 * ({@link resolveSnapshot}) and compute `generation`
 * ({@link computeGeneration}), assemble a `Revision` and check its hash /
 * generation semantics (`fs/media/revision` `checkReferences` — the same rule
 * a reader applies; the shape itself is already guaranteed by this function's
 * own field types), encode and write it to `cas`, then fold the new revision
 * into the cache. Every failure — an invalid or missing parent, a
 * cross-subject parent, an unresolvable subject or snapshot, an invalid
 * revision, a blob too large to encode, or a store write failure — is
 * reported as `error(message)` rather than thrown, so a caller (e.g. an MCP
 * tool handler) can surface it without a `throw`/`catch`.
 */
export const addRevision =
    <O extends Operation>(cas: Cas<O>) =>
    (cacheKey: Key<Cache>) =>
    (input: AddRevision): Effect<O | MemOp, Result<Hash, string>> =>
    resolveParents(cas)(input.parents).step((parentsResult): Effect<O | MemOp, Result<Hash, string>> => {
        if (parentsResult[0] === 'error') { return pure(parentsResult) }
        const subjectResult = resolveSubject(input)(parentsResult[1])
        if (subjectResult[0] === 'error') { return pure(subjectResult) }
        const parentSubjectsResult = validateParentSubjects(subjectResult[1])(parentsResult[1])
        if (parentSubjectsResult[0] === 'error') { return pure(parentSubjectsResult) }
        const snapshotResult = resolveSnapshot(input)(subjectResult[1])(parentsResult[1])
        if (snapshotResult[0] === 'error') { return pure(snapshotResult) }
        const revision: Revision = {
            dialect,
            subject: subjectResult[1],
            parents: input.parents,
            snapshot: snapshotResult[1],
            generation: computeGeneration(parentsResult[1]),
            archived: input.archived,
        }
        const referencesResult = checkReferences(revision)
        if (referencesResult[0] === 'error') { return pure(referencesResult) }
        // Canonicalize parent/snapshot spellings now that checkReferences has
        // confirmed they decode (`unwrap` inside `canonicalHash` is safe):
        // two `add` calls describing the same logical revision but spelled
        // differently (case, `i`/`l`/`o` aliases) must serialize identically,
        // or they'd produce two distinct CAS blobs that both remain heads —
        // the point of `canonicalHash` (see the module doc) is defeated if
        // this module itself writes non-canonical spellings.
        const canonicalRevision: Revision = {
            ...revision,
            parents: revision.parents.map(canonicalHash),
            snapshot: canonicalHash(revision.snapshot),
        }
        const bytes = tryUtf8(toJson(canonicalRevision))
        if (bytes === null) {
            return pure(error('revision too large to encode'))
        }
        return cas.write(nonEmpty(ok(bytes), elEmpty<never, Ok<Vec>>()))
        .step((writeResult): Effect<MemOp, Result<Hash, string>> => {
            if (writeResult[0] === 'error') {
                return pure(error('failed to write revision to CAS'))
            }
            const hash = vecToCBase32(writeResult[1])
            return foldIntoCache(cacheKey)(hash)(canonicalRevision).step(() => pure(ok(hash)))
        })
    })

/** The Evo API described in `fs/cas/evo/README.md`, bound to a `Cas<O>` and its cache slot. */
export type Evo<O extends Operation> = {
    /** Returns every subject with at least one stored revision. */
    readonly list: () => Effect<MemOp, readonly Subject[]>
    /** Returns the current head hashes of `subject` (empty if unknown). */
    readonly head: (subject: Subject) => Effect<MemOp, readonly Hash[]>
    /** Adds a new head; see {@link addRevision}. */
    readonly add: (input: AddRevision) => Effect<O | MemOp, Result<Hash, string>>
}

/** Builds the {@link Evo} API over `cas`, backed by the cache at `cacheKey` (see {@link initEvo}). */
export const evo = <O extends Operation>(cas: Cas<O>) => (cacheKey: Key<Cache>): Evo<O> => ({
    list: () => read(cacheKey).step(cache => pure(definedEntries(cache.bySubject).map(([subject]) => subject))),
    head: subject => read(cacheKey).step(cache => {
        const state = at(subject)(cache.bySubject)
        return pure(state === null ? [] : headsOf(state))
    }),
    add: input => addRevision(cas)(cacheKey)(input),
})
