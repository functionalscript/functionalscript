/**
 * Evo API: subjects and revision heads, cached in memory over an immutable
 * content-addressable store.
 *
 * A `Cas<O>` stores `vnd.fjs.revision` blobs ([`fjs/media/revision`](../../media/revision/module.f.mjs))
 * like any other content: as immutable bytes under a hash. Resolving "what
 * are the current heads of subject X" from that store means walking every
 * stored revision and reversing the parent links — too expensive to redo on
 * every query. This module scans the store once into an in-memory `Cache`
 * ([`fjs/effects/memory`](../../effects/memory/module.f.mjs)) mapping subject →
 * head hashes, then keeps the cache current as new revisions are `add`ed
 * through it — or, for a revision stored some other way (e.g. the generic
 * `cas_add` MCP tool), via {@link syncRevision}.
 *
 * A **head** of a subject is any stored revision of that subject whose hash
 * is not referenced as a `parents` entry by another revision of the same
 * subject (see [`fjs/media/revision/README.md`](../../media/revision/README.md)).
 * `Cache` therefore tracks, per subject, every revision hash seen and every
 * hash referenced as somebody's parent; heads are the set difference between
 * the two, computed at read time ({@link headsOf}). Alongside them it records
 * which of the seen revisions are `archived`, so {@link Evo.list} can classify
 * a subject as active or archived from its heads' flags
 * ({@link subjectListed}) without touching the store. Storing both sets rather
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
 * Not everything here is cache-backed: {@link readRevision} answers "what is
 * the revision at this hash" straight from the store, decoded, validated, and
 * with every hash canonicalized ({@link toRevisionData}). It is the typed
 * counterpart of a raw blob read — {@link addRevision} validates on the way
 * in, {@link readRevision} on the way out — and both speak the same
 * {@link RevisionData} vocabulary.
 *
 * @module
 *
 * @import { Effect, Operation } from '../../effects/types.ts'
 * @import { Key, MemOp } from '../../effects/memory/types.ts'
 * @import { Cas } from '../types.ts'
 * @import { Ok, Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { IoResult } from '../../effects/node/types.ts'
 * @import { List } from '../../effects/list/types.ts'
 * @import { LockMap, Revision } from '../../media/revision/types.ts'
 * @import { Hash, Subject, RevisionData, SubjectState, Cache, Evo } from './types.ts'
 */

import { pure, foldStep } from '../../effects/module.f.mjs'
import { eff } from '../../effects/eff/module.f.mjs'
import { create, read, write } from '../../effects/memory/module.f.mjs'
import { collectRead } from '../module.f.mjs'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { fromVec } from '../../text/utf8/module.f.mjs'
import { tryUtf8 } from '../../text/module.f.mjs'
import { ok, error } from '../../types/result/module.f.mjs'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.mjs'
import { at, definedEntries } from '../../types/object/module.f.mjs'
import { unwrap } from '../../types/nullable/module.f.mjs'
import { isNotFound } from '../../effects/node/module.f.mjs'
import { decodeText, encodeText, dialect, checkReferences, isHash } from '../../media/revision/module.f.mjs'

/** A cache with no known subjects yet — the starting point for {@link buildCache}. */
export const emptyCache = /** @type {Cache} */ ({ bySubject: {} })

/** @type {SubjectState} */
const emptySubjectState = { hashes: [], parents: [], archived: [] }

/** Adds every item of `items` to `set` that isn't already there, preserving `set`'s existing order.
 * @type {(set: readonly Hash[]) => (items: readonly Hash[]) => readonly Hash[]}
 */
const union = set => items =>
    items.reduce((/** @type {readonly Hash[]} */ acc, h) => acc.includes(h) ? acc : [...acc, h], set)

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
 * (`fjs/media/revision` `checkReferences`), so decoding here cannot fail.
 * @type {(h: Hash) => Hash}
 */
const canonicalHash = h => vecToCBase32(unwrap(cBase32ToVec(h)))

/** Canonicalizes every direct hash in a structurally validated flat lock map.
 * @type {(lock: LockMap) => LockMap}
 */
const canonicalLock = lock =>
    Object.fromEntries(definedEntries(lock).map(([subject, hash]) => [subject, canonicalHash(hash)]))

/** A subject's current heads: revision hashes seen that no other revision of the same subject names as a parent.
 * @type {(state: SubjectState) => readonly Hash[]}
 */
const headsOf = state =>
    state.hashes.filter(h => !state.parents.includes(h))

/**
 * Whether a subject in `state` belongs in {@link Evo.list}'s result for the
 * given `archived` filter — the subject-level status derived from its
 * revision-level `archived` flags:
 *
 * - **active** — at least one current head is not archived. This is the
 *   default result set (`archived` omitted).
 * - **archived** — the subject has at least one current head and every one of
 *   them is archived (`archived: true`).
 *
 * Concurrent heads can disagree, and the two rules resolve that the same way:
 * one unarchived head keeps the whole subject active, because a subject is
 * only done evolving when nothing left to build on remains. A subject with no
 * current heads is neither active nor archived and appears in no result — the
 * status is a statement about heads, and there is nothing to state. That case
 * needs the explicit `heads.length` test only in the archived branch, since
 * "every head is archived" is vacuously true of no heads at all.
 * @type {(archived: true | undefined) => (state: SubjectState) => boolean}
 */
const subjectListed = archived => state => {
    const heads = headsOf(state)
    const unarchived = heads.filter(h => !state.archived.includes(h))
    return archived === undefined
        ? unarchived.length !== 0
        : heads.length !== 0 && unarchived.length === 0
}

/**
 * Folds one more stored revision into `cache`: `hash` joins its subject's
 * `hashes` set, `revision.parents` (canonicalized, see {@link canonicalHash})
 * join its `parents` set, and `hash` also joins the `archived` set when the
 * revision carries `archived: true`. Order independent (see the module doc) —
 * used both for a full-store scan and for a single incremental `add`.
 *
 * Looks `revision.subject` up via {@link at} (own-property only), not plain
 * bracket indexing: a subject is an arbitrary caller-supplied string
 * (`RevisionData.subject`, or the MCP `evo_add`/`evo_head` argument), so it
 * can collide with an inherited `Object.prototype` name (`toString`,
 * `constructor`, …) — bracket indexing would then return that inherited
 * value instead of "no entry yet" and crash on the (non-array) `.hashes`
 * access below.
 * @type {(hash: Hash, revision: Revision) => (cache: Cache) => Cache}
 */
const addRevisionToCache = (hash, revision) => cache => {
    const existing = at(revision.subject)(cache.bySubject) ?? emptySubjectState
    /** @type {SubjectState} */
    const state = {
        hashes: union(existing.hashes)([hash]),
        parents: union(existing.parents)(revision.parents.map(canonicalHash)),
        archived: union(existing.archived)(revision.archived === undefined ? [] : [hash]),
    }
    return { bySubject: { ...cache.bySubject, [revision.subject]: state } }
}

/**
 * Decodes already-read bytes as a `vnd.fjs.revision`. Returns `null` for
 * anything that is not a valid revision — bytes that are not valid UTF-8, or
 * text that does not parse/validate as the dialect.
 * @type {(value: Vec) => Revision | null}
 */
export const decodeRevisionVec = value => {
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
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(hash: Vec) => Effect<O, Revision | null>}
 */
export const decodeRevisionBlob = cas => hash =>
    eff(collectRead(cas.read(hash)))
        .map(([tag, value]) => tag === 'error' ? null : decodeRevisionVec(value))
        .value

/**
 * Scans every hash in `cas` and builds a fresh {@link Cache} from the
 * `vnd.fjs.revision` blobs found among them. Non-revision blobs are ignored.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {Effect<O, Cache>}
 */
export const buildCache = cas =>
    foldStep(
        cas.list(),
        emptyCache,
        hash => cache =>
            eff(decodeRevisionBlob(cas)(hash))
                .step(revision =>
                    pure(revision === null ? cache : addRevisionToCache(vecToCBase32(hash), revision)(cache))
                )
                .value)

/**
 * Scans `cas` once and allocates a memory slot holding the resulting {@link Cache}.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {Effect<O | MemOp, Key<Cache>>}
 */
export const initEvo = cas =>
    eff(buildCache(cas))
        .step(cache => create(cache))
        .value

/** Reads, then rewrites, the cache at `cacheKey` with `revision` folded in at `hash`.
 * @type {(cacheKey: Key<Cache>) => (hash: Hash) => (revision: Revision) => Effect<MemOp, void>}
 */
const foldIntoCache = cacheKey => hash => revision =>
    eff(read(cacheKey))
        .step(cache => write(cacheKey, addRevisionToCache(hash, revision)(cache)))
        .value

/**
 * Folds `value` — bytes already written to a `Cas` at `hash` by some other
 * caller — into the cache at `cacheKey` if it decodes as a `vnd.fjs.revision`
 * ({@link decodeRevisionVec}); a no-op otherwise. `cas_add`/`evo_add`
 * (`fjs/mcp`) are two ways to reach the same store — a plain `cas_add`
 * call can store a revision blob without going through {@link addRevision},
 * and this is what keeps the cache honest about it without rescanning the
 * whole store.
 * @type {(cacheKey: Key<Cache>) => (hash: Vec) => (value: Vec) => Effect<MemOp, void>}
 */
export const syncRevision = cacheKey => hash => value => {
    const revision = decodeRevisionVec(value)
    return revision === null ? pure(undefined) : foldIntoCache(cacheKey)(vecToCBase32(hash))(revision)
}

/**
 * Resolves and validates one `parents` entry: the hash must decode as
 * cBase32 and the blob it names must itself be a `vnd.fjs.revision`. Used
 * unconditionally for every parent — even when `subject` is given explicitly
 * — so `add` never stores a revision whose declared parent is missing or not
 * a revision.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(parentRef: Hash) => Effect<O, Result<Revision, string>>}
 */
const resolveParent = cas => parentRef => {
    const parentHash = cBase32ToVec(parentRef)
    if (parentHash === null) {
        return pure(error(`invalid parent hash: ${parentRef}`))
    }
    return eff(decodeRevisionBlob(cas)(parentHash))
        .step(parent =>
            pure(parent === null ? error(`parent is not a revision blob: ${parentRef}`) : ok(parent))
        )
        .value
}

/**
 * Resolves and validates every entry of `parents`, in order, short-circuiting on the first failure.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(parents: readonly Hash[]) => Effect<O, Result<readonly Revision[], string>>}
 */
const resolveParents = cas => parents => {
    /** @type {Result<readonly Revision[], string>} */
    const init = ok([])
    return foldStep(
        pure(parents),
        init,
        parentRef => (/** @type {Result<readonly Revision[], string>} */ acc) => {
            if (acc[0] === 'error') { return pure(acc) }
            return eff(resolveParent(cas)(parentRef))
                .step((/** @type {Result<Revision, string>} */ parentResult) =>
                    /** @type {Effect<never, Result<readonly Revision[], string>>} */
                    (pure(parentResult[0] === 'error' ? parentResult : ok([...acc[1], parentResult[1]])))
                )
                .value
        })
}

/**
 * Resolves the `subject` of a new revision from its already-resolved
 * `parents`: the caller's explicit `subject` when given, otherwise the
 * single parent's own `subject` (a revision does not carry its own
 * subject-inheritance rule the way `snapshot` does, so this is derived
 * explicitly). More or fewer than one parent without an explicit `subject`
 * cannot be resolved.
 * @type {(input: RevisionData) => (parents: readonly Revision[]) => Result<Subject, string>}
 */
const resolveSubject = input => parents => {
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
 * @type {(subject: Subject) => (parents: readonly Revision[]) => Result<void, string>}
 */
const validateParentSubjects = subject => parents => {
    const mismatch = parents.find(p => p.subject !== subject)
    return mismatch === undefined
        ? ok(undefined)
        : error(`parent belongs to a different subject (${mismatch.subject}), expected ${subject}`)
}

/**
 * Resolves the `snapshot` of a new revision — the inference the
 * `vnd.fjs.revision` format used to carry, now run once at the write boundary
 * with the parents already resolved and written explicitly into the stored
 * blob (which requires `snapshot`; see `fjs/media/revision`). The caller's
 * explicit `snapshot` is used as-is when given; otherwise zero parents fall
 * back to `subject` as the snapshot reference (which must then be a hash),
 * exactly one parent inherits that parent's stored `snapshot`, and more than
 * one parent without an explicit `snapshot` cannot be resolved — there is no
 * single parent snapshot to inherit, and falling back to `subject` would
 * silently lose the merge result.
 * @type {(input: RevisionData) => (subject: Subject) => (parents: readonly Revision[]) => Result<Hash, string>}
 */
const resolveSnapshot = input => subject => parents => {
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
 * [`fjs/media/revision/README.md`](../../media/revision/README.md), where a
 * deviation is a readable epoch-reset signal rather than an invalid blob).
 *
 * The max is a `reduce`, not `Math.max(...parents.map(...))`: `parents` is
 * caller-sized (the direct API or the `evo_add` MCP tool), and argument-spread
 * of a large array overflows the JS call stack with a `RangeError` before the
 * documented `Result` error path can run — a `reduce` has no such limit.
 * @type {(parents: readonly Revision[]) => number}
 */
const computeGeneration = parents =>
    parents.length === 0 ? 0 : 1 + parents.reduce((max, p) => Math.max(max, p.generation), 0)

/**
 * Adds a new revision to `cas` and folds it into the cache at `cacheKey`.
 *
 * Steps: resolve and validate every parent ({@link resolveParents}), resolve
 * `subject` from them ({@link resolveSubject}) and check every parent
 * actually belongs to it ({@link validateParentSubjects}), resolve `snapshot`
 * ({@link resolveSnapshot}) and compute `generation`
 * ({@link computeGeneration}), assemble a `Revision` and check its hash /
 * generation semantics (`fjs/media/revision` `checkReferences` — the same rule
 * a reader applies; the shape itself is already guaranteed by this function's
 * own field types), encode and write it to `cas`, then fold the new revision
 * into the cache. Every failure — an invalid or missing parent, a
 * cross-subject parent, an unresolvable subject or snapshot, an invalid
 * revision, a blob too large to encode, or a store write failure — is
 * reported as `error(message)` rather than thrown, so a caller (e.g. an MCP
 * tool handler) can surface it without a `throw`/`catch`.
 *
 * `input.generation` is ignored: it exists on {@link RevisionData} only so a
 * value read back by {@link readRevision} round-trips into `add` unchanged,
 * and {@link computeGeneration} always derives the stored value from the
 * resolved parents.
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(cacheKey: Key<Cache>) => (input: RevisionData) => Effect<O | MemOp, Result<Hash, string>>}
 */
export const addRevision = cas => cacheKey => input =>
    eff(resolveParents(cas)(input.parents))
        .step((/** @type {Result<readonly Revision[], string>} */ parentsResult) => {
            if (parentsResult[0] === 'error') { return pure(parentsResult) }
            const subjectResult = resolveSubject(input)(parentsResult[1])
            if (subjectResult[0] === 'error') { return pure(subjectResult) }
            const parentSubjectsResult = validateParentSubjects(subjectResult[1])(parentsResult[1])
            if (parentSubjectsResult[0] === 'error') { return pure(parentSubjectsResult) }
            const snapshotResult = resolveSnapshot(input)(subjectResult[1])(parentsResult[1])
            if (snapshotResult[0] === 'error') { return pure(snapshotResult) }
            /** @type {Revision} */
            const revision = {
                dialect,
                subject: subjectResult[1],
                parents: input.parents,
                snapshot: snapshotResult[1],
                generation: computeGeneration(parentsResult[1]),
                archived: input.archived,
                lock: input.lock,
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
            /** @type {Revision} */
            const canonicalRevision = {
                ...revision,
                parents: revision.parents.map(canonicalHash),
                snapshot: canonicalHash(revision.snapshot),
                lock: revision.lock === undefined ? undefined : canonicalLock(revision.lock),
            }
            const bytes = tryUtf8(encodeText(canonicalRevision))
            if (bytes === null) {
                return pure(error('revision too large to encode'))
            }
            return eff(cas.write(nonEmpty(ok(bytes), /** @type {List<never, Ok<Vec>>} */ (elEmpty()))))
                .step((/** @type {IoResult<Vec>} */ writeResult) => {
                    if (writeResult[0] === 'error') {
                        return /** @type {Effect<MemOp, Result<Hash, string>>} */ (pure(error('failed to write revision to CAS')))
                    }
                    const hash = vecToCBase32(writeResult[1])
                    return eff(foldIntoCache(cacheKey)(hash)(canonicalRevision))
                        .step(() => pure(ok(hash)))
                        .value
                })
                .value
        })
        .value

/**
 * Projects a decoded `Revision` into the shared {@link RevisionData}
 * vocabulary: `dialect` is dropped (a serialization tag with no information
 * left once decoding has validated it), and every hash is re-spelled
 * canonically ({@link canonicalHash}) so a read compares directly against
 * {@link Evo.head}'s output instead of against whatever spelling the blob's
 * writer happened to use. `checkReferences` ran as part of decoding, so every
 * `parents` entry and the `snapshot` are known to decode and the `unwrap`
 * inside `canonicalHash` is safe. Field order follows the stored blob's
 * (minus `dialect`), which is what a JSON encoding of the result shows.
 * @type {(revision: Revision) => RevisionData}
 */
const toRevisionData = ({ subject, parents, snapshot, generation, archived, lock }) => ({
    subject,
    parents: parents.map(canonicalHash),
    snapshot: canonicalHash(snapshot),
    generation,
    archived,
    lock: lock === undefined ? undefined : canonicalLock(lock),
})

/**
 * Second stage of {@link readRevision}: interprets an already-performed read
 * of `hash`. Kept apart from the read itself so the failures stay
 * distinguishable — "not present in the store" and "present but not a
 * revision" are different answers to a client, and
 * {@link decodeRevisionBlob}, which composes the same two stages internally,
 * deliberately collapses both into `null` for store scanning.
 *
 * A failed read is only reported as *not found* when it is a genuine miss —
 * `isNotFound`, the same ENOENT test `fjs/cas`'s `list` uses to tell an
 * unwritten store from an unreadable one. A `Cas` read can also fail on a
 * blob that exists: a permission or mid-stream I/O error, or content too
 * large to buffer into one `Vec` (`collectRead`). Calling any of those "not
 * found" would deny a stored revision exists, so they are their own message.
 *
 * A blob deleted *during* the read lands here as a miss too, and that is the
 * honest answer rather than a gap in the split. `fileCas` streams in chunks,
 * so a delete between two of them fails a later chunk with ENOENT after
 * earlier ones succeeded — but by the time this result is produced the store
 * genuinely no longer has the blob, and the very next read says "not found"
 * with no race left to observe. `collectRead` reports how a read ended, not
 * how far it got; recovering that difference would mean folding the chunk
 * stream here instead of reusing `collectRead`, for a distinction no client
 * can act on differently.
 * @type {(hash: Hash) => (result: IoResult<Vec>) => Result<RevisionData, string>}
 */
const decodeReadRevision = hash => ([tag, value]) => {
    if (tag === 'error') {
        return error(isNotFound(value)
            ? `revision not found: ${hash}`
            : `failed to read revision: ${hash}`)
    }
    const revision = decodeRevisionVec(value)
    return revision === null
        ? error(`not a revision blob: ${hash}`)
        : ok(toRevisionData(revision))
}

/**
 * Reads the revision at `hash`: decoded, validated, and canonicalized
 * ({@link toRevisionData}). The typed counterpart of a raw `cas.read` — the
 * store's generic "bytes by hash" read stays available for arbitrary content
 * (snapshots and everything else that is not a revision), while this is the
 * view for revisions specifically: `add` validates on the way in, this
 * validates on the way out, so no caller re-implements JSON parsing, schema
 * validation, the `dialect` check, or hash canonicalization.
 *
 * Every way to fail is its own message: `hash` is not cBase32, the store has
 * nothing under it, the store has it but could not deliver it, or what it
 * holds is not a `vnd.fjs.revision` (see {@link decodeReadRevision}).
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(hash: Hash) => Effect<O, Result<RevisionData, string>>}
 */
export const readRevision = cas => hash => {
    const hashVec = cBase32ToVec(hash)
    return hashVec === null
        ? pure(error(`invalid hash: ${hash}`))
        : eff(collectRead(cas.read(hashVec)))
            .map(decodeReadRevision(hash))
            .value
}

/**
 * Builds the {@link Evo} API over `cas`, backed by the cache at `cacheKey` (see {@link initEvo}).
 *
 * @template {Operation} O
 * @param {Cas<O>} cas
 * @returns {(cacheKey: Key<Cache>) => Evo<O>}
 */
export const evo = cas => cacheKey => ({
    list: archived => {
        const listed = subjectListed(archived)
        return eff(read(cacheKey))
            .step(cache => pure(definedEntries(cache.bySubject)
                .flatMap(([subject, state]) => listed(state) ? [subject] : [])))
            .value
    },
    head: subject => eff(read(cacheKey))
        .step(cache => {
            const state = at(subject)(cache.bySubject)
            return pure(state === null ? [] : headsOf(state))
        })
        .value,
    add: input => addRevision(cas)(cacheKey)(input),
    revision: readRevision(cas),
})
