/**
 * Store-index operations for revision blobs.
 *
 * This module works over a caller-supplied revision index: each entry carries the
 * CAS hash where the revision blob is stored plus the decoded revision format from
 * `fs/media/revision`. The shape keeps CAS hashing/addressing separate from the
 * pure media format while providing head resolution and materialization helpers.
 *
 * @module
 */
import type { Hash, Ref, Revision } from '../../media/revision/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'

/** A decoded revision paired with the CAS hash of the revision blob itself. */
export type Entry = {
    readonly hash: Hash
    readonly revision: Revision
}

/** A reverse index for all revision blobs known to a store. */
export type Index = readonly Entry[]

const sameSubject = (subject: Ref) => (entry: Entry): boolean =>
    entry.revision.subject === subject

const containsParent = (hash: Hash) => (entry: Entry): boolean =>
    entry.revision.parents.includes(hash)

const activeEntry = (entry: Entry): boolean =>
    entry.revision.archived !== true

/** Returns all active heads for `subject`, ignoring children from other subjects. */
export const heads = (subject: Ref) => (index: Index): readonly Entry[] => {
    const subjectEntries = index.filter(sameSubject(subject))
    return subjectEntries.filter(entry =>
        activeEntry(entry) && !subjectEntries.some(containsParent(entry.hash)))
}

const findEntry = (hash: Hash) => (index: Index): Entry | undefined =>
    index.find(entry => entry.hash === hash)

/** Materializes a revision to the referenced snapshot/base content ref. */
export const materialize = (index: Index) => (entry: Entry): Result<Ref, string> => {
    const { revision } = entry
    if (revision.snapshot !== undefined) { return ok(revision.snapshot) }
    const { parents, subject } = revision
    if (parents.length === 0) { return ok(subject) }
    if (parents.length > 1) { return error('multi-parent revisions must carry snapshot') }
    const [parent] = parents
    const parentEntry = findEntry(parent)(index)
    return parentEntry === undefined
        ? error(`missing parent revision: ${parent}`)
        : materialize(index)(parentEntry)
}

const parentGenerations = (index: Index) => (entry: Entry): readonly number[] =>
    entry.revision.parents.flatMap(parent => {
        const parentEntry = findEntry(parent)(index)
        return parentEntry?.revision.generation !== undefined
            ? [parentEntry.revision.generation]
            : []
    })

/** Computes the expected generation from cached parent generations when available. */
export const expectedGeneration = (index: Index) => (entry: Entry): number => {
    const generations = parentGenerations(index)(entry)
    return generations.length === 0 ? 0 : 1 + Math.max(...generations)
}

/** Verifies an entry's optional generation cache against the known parent chain. */
export const verifyGeneration = (index: Index) => (entry: Entry): Result<Entry, string> =>
    entry.revision.generation === undefined || entry.revision.generation === expectedGeneration(index)(entry)
        ? ok(entry)
        : error('generation cache mismatch')

/** Builds a merge revision over the supplied concurrent parent revision hashes. */
export const mergeRevision = (subject: Ref) => (parents: readonly Hash[]) => (snapshot: Ref): Revision => ({
    dialect: 'vnd.fjs.revision',
    subject,
    parents,
    snapshot,
})
