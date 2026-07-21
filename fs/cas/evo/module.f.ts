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
 * through it.
 *
 * A **head** of a subject is any stored revision of that subject whose hash
 * is not referenced as a `parents` entry by another revision of the same
 * subject (see [`fs/media/revision/README.md`](../../media/revision/README.md)).
 * Because revisions form a DAG (no cycles), that definition is order
 * independent: folding "add this hash as a head, then drop its parents from
 * the head set" over every stored revision, in any order, converges to the
 * same result — which is what {@link buildCache} and {@link addRevision} both
 * do, the former over the whole store at once, the latter incrementally for
 * one new revision.
 *
 * @module
 */
import { pure, foldStep, type Effect, type Operation } from '../../effects/module.f.ts'
import { create, read, write, type Key, type MemOp } from '../../effects/memory/module.f.ts'
import { collectRead, type Cas } from '../module.f.ts'
import { cBase32ToVec, vecToCBase32 } from '../../basen/cbase32/module.f.ts'
import { fromVec } from '../../text/utf8/module.f.ts'
import { tryUtf8 } from '../../text/module.f.ts'
import { decodeText, dialect, checkReferences, type Revision } from '../../media/revision/module.f.ts'
import { stringify } from '../../media/json/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { ok, error, type Ok, type Result } from '../../types/result/module.f.ts'
import { nonEmpty, empty as elEmpty } from '../../effects/list/module.f.ts'
import { definedEntries, type StringMap } from '../../types/object/module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'

/** A cBase32 content hash, as accepted/returned by `Cas<O>`. */
export type Hash = string

/** The identity of a mutable object whose revisions are being evolved. */
export type Subject = string

/**
 * Input to {@link addRevision}: everything the caller supplies for a new
 * revision. `subject` is optional — omitted, it is inherited from the single
 * parent's own `subject` (see {@link resolveSubject}); `snapshot`, when
 * omitted, follows the inheritance/fallback rules of the `vnd.fjs.revision`
 * format itself (`fs/media/revision`), so this module does not need to
 * resolve it.
 */
export type AddRevision = {
    readonly parents: readonly Hash[]
    readonly snapshot?: Hash | undefined
    readonly subject?: Subject | undefined
    readonly archived?: true | undefined
}

/** In-memory index: subject → its current head hashes. */
export type Cache = {
    readonly heads: StringMap<string, readonly Hash[]>
}

/** A cache with no known subjects yet — the starting point for {@link buildCache}. */
export const emptyCache: Cache = { heads: {} }

/** Canonical JSON encoder for a `Revision` — key order carries no meaning for detection. */
const toJson = stringify(identity)

/**
 * Folds one more stored revision into `cache`: the revision's own `hash`
 * becomes a head of its `subject` (unless already present), and every one of
 * its `parents` is dropped from that subject's head set. Order independent
 * (see the module doc) — used both for a full-store scan and for a single
 * incremental `add`.
 */
const addRevisionToCache = (hash: Hash, revision: Revision) => (cache: Cache): Cache => {
    const existing = cache.heads[revision.subject] ?? []
    const withoutParents = existing.filter(h => !revision.parents.includes(h))
    const heads = withoutParents.includes(hash) ? withoutParents : [...withoutParents, hash]
    return { heads: { ...cache.heads, [revision.subject]: heads } }
}

/**
 * Reads and decodes the blob at `hash` as a `vnd.fjs.revision`. Returns
 * `null` for anything that is not a valid revision — a missing hash, bytes
 * that are not valid UTF-8, or text that does not parse/validate as the
 * dialect — so a store containing arbitrary other content can be scanned
 * without failing the whole cache build.
 */
export const decodeRevisionBlob = <O extends Operation>(cas: Cas<O>) => (hash: Vec): Effect<O, Revision | null> =>
    collectRead(cas.read(hash)).step(([tag, value]) => {
        if (tag === 'error') { return pure(null) }
        const text = fromVec(value)
        if (text === null) { return pure(null) }
        const [decodeTag, revision] = decodeText(text)
        return pure(decodeTag === 'error' ? null : revision)
    })

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

/**
 * Resolves the `subject` of a new revision: the caller's explicit `subject`
 * when given, otherwise the single parent's own `subject` (a revision does
 * not carry its own subject-inheritance rule the way `snapshot` does, so this
 * module derives it explicitly by looking the parent up). More or fewer than
 * one parent without an explicit `subject` cannot be resolved.
 */
const resolveSubject = <O extends Operation>(cas: Cas<O>) => (input: AddRevision): Effect<O, Result<Subject, string>> => {
    if (input.subject !== undefined) { return pure(ok(input.subject)) }
    if (input.parents.length !== 1) {
        return pure(error('subject is required unless there is exactly one parent to inherit it from'))
    }
    const [parentRef] = input.parents
    const parentHash = cBase32ToVec(parentRef)
    if (parentHash === null) {
        return pure(error(`invalid parent hash: ${parentRef}`))
    }
    return decodeRevisionBlob(cas)(parentHash).step(parent =>
        pure(parent === null
            ? error(`parent is not a revision blob: ${parentRef}`)
            : ok(parent.subject)))
}

/**
 * Adds a new revision to `cas` and folds it into the cache at `cacheKey`.
 *
 * Steps: resolve `subject` ({@link resolveSubject}), assemble a `Revision` and
 * check its snapshot-reference semantics (`fs/media/revision`
 * `checkReferences` — the same rule a reader applies; the shape itself is
 * already guaranteed by this function's own field types), encode and write it
 * to `cas`, then fold the new revision into the cache. Every
 * failure — unresolvable subject, an invalid revision, a blob too large to
 * encode, or a store write failure — is reported as `error(message)` rather
 * than thrown, so a caller (e.g. an MCP tool handler) can surface it without
 * a `throw`/`catch`.
 */
export const addRevision =
    <O extends Operation>(cas: Cas<O>) =>
    (cacheKey: Key<Cache>) =>
    (input: AddRevision): Effect<O | MemOp, Result<Hash, string>> =>
    resolveSubject(cas)(input).step((subjectResult): Effect<O | MemOp, Result<Hash, string>> => {
        if (subjectResult[0] === 'error') { return pure(subjectResult) }
        const revision: Revision = {
            dialect,
            subject: subjectResult[1],
            parents: input.parents,
            snapshot: input.snapshot,
            archived: input.archived,
        }
        const referencesResult = checkReferences(revision)
        if (referencesResult[0] === 'error') { return pure(referencesResult) }
        const bytes = tryUtf8(toJson(revision))
        if (bytes === null) {
            return pure(error('revision too large to encode'))
        }
        return cas.write(nonEmpty(ok(bytes), elEmpty<never, Ok<Vec>>()))
        .step((writeResult): Effect<MemOp, Result<Hash, string>> => {
            if (writeResult[0] === 'error') {
                return pure(error('failed to write revision to CAS'))
            }
            const hash = vecToCBase32(writeResult[1])
            return read(cacheKey).step(cache =>
                write(cacheKey, addRevisionToCache(hash, revision)(cache)).step(() => pure(ok(hash))))
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
    list: () => read(cacheKey).step(cache => pure(definedEntries(cache.heads).map(([subject]) => subject))),
    head: subject => read(cacheKey).step(cache => pure(cache.heads[subject] ?? [])),
    add: input => addRevision(cas)(cacheKey)(input),
})
