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

const alreadySeen = (hash: Hash) => (seen: readonly Hash[]): boolean =>
    seen.includes(hash)

const materializeSeen = (index: Index) => (seen: readonly Hash[]) => (entry: Entry): Result<Ref, string> => {
    if (alreadySeen(entry.hash)(seen)) { return error(`revision cycle: ${entry.hash}`) }
    const { revision } = entry
    if (revision.snapshot !== undefined) { return ok(revision.snapshot) }
    const { parents, subject } = revision
    if (parents.length === 0) { return ok(subject) }
    if (parents.length > 1) { return error('multi-parent revisions must carry snapshot') }
    const [parent] = parents
    const parentEntry = findEntry(parent)(index)
    return parentEntry === undefined
        ? error(`missing parent revision: ${parent}`)
        : materializeSeen(index)([...seen, entry.hash])(parentEntry)
}

/** Materializes a revision to the referenced snapshot/base content ref. */
export const materialize = (index: Index) => (entry: Entry): Result<Ref, string> =>
    materializeSeen(index)([])(entry)

const maxGeneration = (values: readonly number[]): number =>
    values.length === 0 ? 0 : Math.max(...values)

const sequenceNumbers = (values: readonly Result<number, string>[]): Result<readonly number[], string> => {
    const [firstError] = values.flatMap(value => value[0] === 'error' ? [value[1]] : [])
    return firstError === undefined
        ? ok(values.flatMap(value => value[0] === 'ok' ? [value[1]] : []))
        : error(firstError)
}

const expectedGenerationSeen = (index: Index) => (seen: readonly Hash[]) => (entry: Entry): Result<number, string> => {
    if (alreadySeen(entry.hash)(seen)) { return error(`revision cycle: ${entry.hash}`) }
    const { parents } = entry.revision
    if (parents.length === 0) { return ok(0) }
    const generations = sequenceNumbers(parents.map(parent => {
        const parentEntry = findEntry(parent)(index)
        return parentEntry === undefined
            ? error(`missing parent revision: ${parent}`)
            : expectedGenerationSeen(index)([...seen, entry.hash])(parentEntry)
    }))
    return generations[0] === 'error'
        ? generations
        : ok(1 + maxGeneration(generations[1]))
}

/** Computes the generation implied by the known parent chain. */
export const expectedGeneration = (index: Index) => (entry: Entry): Result<number, string> =>
    expectedGenerationSeen(index)([])(entry)

/** Verifies an entry's optional generation cache against the known parent chain. */
export const verifyGeneration = (index: Index) => (entry: Entry): Result<Entry, string> => {
    if (entry.revision.generation === undefined) { return ok(entry) }
    const expected = expectedGeneration(index)(entry)
    return expected[0] === 'error' ?
        error(expected[1]) :
    entry.revision.generation === expected[1] ?
        ok(entry) :
        error('generation cache mismatch')
}

/** Builds a merge revision over the supplied concurrent parent revision hashes. */
export const mergeRevision = (subject: Ref) => (parents: readonly Hash[]) => (snapshot: Ref): Revision => ({
    dialect: 'vnd.fjs.revision',
    subject,
    parents,
    snapshot,
})
