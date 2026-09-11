/**
 * The walk: from an id to the object a path names, over a store's reader.
 * Three steps, which are the three
 * [git-name-resolution](../../../todo/git-name-resolution.md) takes — a
 * tag peeled to what it names, a commit to the entries of its tree, and a
 * tree to the entry a path names — each a function over the `Read` the
 * caller gives it, so the walk is separable from where the objects live
 * and provable against any store.
 *
 * Nothing here panics on what it read. An object the store gave back is
 * bytes from a file, so the walk reads a field of one only through an
 * accessor that refuses — `tryTree` of a commit, `tryObject` of a tag —
 * and answers `null` where the objects cannot take it further: bytes that
 * are no object of their type, a commit whose `tree` header is no id of
 * the width, a name no entry has, a path that runs into a blob. A missing
 * object and a file that hashes to another id stay the channel's, as the
 * store gives them, since those say the repository is wrong rather than
 * that the path names nothing.
 *
 * The walk reads only the objects it must. The last component's object is
 * never read — {@link tryEntry} answers the entry, and the caller reads
 * the blob with the same `Read` — so a path naming a submodule, a
 * `160000` entry whose commit lives in another repository, answers that
 * entry rather than failing to find its object here.
 *
 * @module
 *
 * @import { Operation } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { TreeEntry } from '../tree/types.ts'
 * @import { Entry, Read, Step, Target } from './types.ts'
 */

import { pureOk, step } from '../../effects/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { tryRead as readCommit, tryTree } from '../commit/module.f.mjs'
import { tryObject, tryRead as readTag } from '../tag/module.f.mjs'
import { tryRead as readTree } from '../tree/module.f.mjs'

/**
 * How many tags {@link peel} follows. A tag naming a tag is ordinary and
 * a chain of a few is not, and content addressing rules out a cycle — a
 * tag naming itself would have to hold its own id — so the bound is
 * against a repository holding a chain no tool of Git's writes, not
 * against looping forever.
 */
const maxDepth = /** @type {const} */ (8)

/**
 * Whether two names are the same bytes. A name is bytes the file system
 * gave, compared as they are: no case folding, no normalisation, since
 * Git compares them so and two names differing by either are two entries.
 *
 * @type {(a: readonly number[], b: readonly number[]) => boolean}
 */
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Follows a tag to what it names, and that tag to what it names, up to
 * {@link maxDepth} of them: the first object that is not a tag, with the
 * id it was reached by. An id naming no tag is itself, read. `null` where
 * an object read is no object of its type, a tag's `object` header is no
 * id of the width, or the chain is longer than the bound.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Step<O, Target>}
 */
export const peel = (read, oidBytes) => {
    const objectOf = tryObject(oidBytes)
    /** @type {(depth: number) => Step<O, Target>} */
    const go = depth => id => step(read(id), e => {
        if (e === null) { return pureOk(null) }
        if (e.type !== 'tag') { return pureOk({ id, envelope: e }) }
        if (depth === 0) { return pureOk(null) }
        const t = readTag(e.payload)
        if (t === null) { return pureOk(null) }
        const next = objectOf(t)
        return next === null ? pureOk(null) : go(depth - 1)(next)
    })
    return go(maxDepth)
}

/**
 * The entries of the tree an id names: the id {@link peel}ed, then a
 * commit's `tree` header read and that tree read, or the tree itself where
 * what the id names is one. `null` where the id names a blob, or the
 * objects read cannot be read as their type says.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Step<O, readonly TreeEntry[]>}
 */
export const tryEntries = (read, oidBytes) => {
    const peeled = peel(read, oidBytes)
    const treeOf = tryTree(oidBytes)
    const entriesOf = readTree(oidBytes)
    /** @type {Step<O, readonly TreeEntry[]>} */
    const treeAt = id => step(read(id), e =>
        pureOk(e === null || e.type !== 'tree' ? null : entriesOf(e.payload)))
    return id => step(peeled(id), t => {
        if (t === null) { return pureOk(null) }
        const { envelope } = t
        if (envelope.type === 'tree') { return pureOk(entriesOf(envelope.payload)) }
        if (envelope.type !== 'commit') { return pureOk(null) }
        const c = readCommit(envelope.payload)
        if (c === null) { return pureOk(null) }
        const treeId = treeOf(c)
        return treeId === null ? pureOk(null) : treeAt(treeId)
    })
}

/**
 * The entry a path names, walking from the tree an id names: one
 * component at a time, each but the last read as the tree it must be.
 * `null` where a component names no entry, a component before the last
 * names something that is no tree, the objects cannot be read, or the
 * path has no components — a path of none names the tree itself, which no
 * entry names, and {@link tryEntries} is what reads that.
 *
 * The entry's own object is not read, so the caller reads the blob with
 * the same `Read` and a submodule entry comes back rather than a missing
 * object.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Entry<O>}
 */
export const tryEntry = (read, oidBytes) => {
    const rootOf = tryEntries(read, oidBytes)
    const entriesOf = readTree(oidBytes)
    return (id, path) => {
        const names = path.map(byteArray)
        /** @type {(i: number) => (entries: Nullable<readonly TreeEntry[]>) => ReturnType<Entry<O>>} */
        const go = i => entries => {
            if (entries === null) { return pureOk(null) }
            const found = entries.find(e => same(byteArray(e.name), names[i]))
            if (found === undefined) { return pureOk(null) }
            if (i + 1 === names.length) { return pureOk(found) }
            return step(read(found.oid), e =>
                go(i + 1)(e === null || e.type !== 'tree' ? null : entriesOf(e.payload)))
        }
        return names.length === 0 ? pureOk(null) : step(rootOf(id), go(0))
    }
}
