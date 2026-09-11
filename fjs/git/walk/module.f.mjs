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
 * accessor that refuses — `tryTree` of a commit, `tryObject` and `tryType`
 * of a tag — and answers `null` where the objects cannot take it further:
 * bytes that are no object of their type, a commit whose `tree` header is
 * no id of the width, a tag whose target is not the type it declared, a
 * name no entry has or two entries have, a path that runs into anything
 * but a subtree. A missing object and a file that hashes to another id
 * stay the channel's, as the store gives them, since those say the
 * repository is wrong rather than that the path names nothing.
 *
 * The walk reads only the objects it must. The last component's object is
 * never read — {@link tryEntry} answers the entry, and the caller reads
 * the blob with the same `Read` — so a path naming a submodule, a
 * `160000` entry whose commit lives in another repository, answers that
 * entry rather than failing to find its object here.
 *
 * @module
 *
 * @import { Effect, IoChannel, Operation } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Tag } from '../tag/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { TreeEntry } from '../tree/types.ts'
 * @import { Entry, Read, Step, Target } from './types.ts'
 */

import { pureOk, step } from '../../effects/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { tryRead as readCommit, tryTree } from '../commit/module.f.mjs'
import { tryObject, tryRead as readTag, tryType } from '../tag/module.f.mjs'
import { isSubtree, tryRead as readTree } from '../tree/module.f.mjs'

/**
 * The entries of the tree an id names, where it names a tree: read, and
 * `null` where the object is no tree or its bytes are no tree's. Both
 * {@link tryEntries} and {@link tryEntry} step from an id to a tree this
 * way, so they step it the same way.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(payload: Bytes) => Nullable<readonly TreeEntry[]>} entriesOf
 * @returns {Step<O, readonly TreeEntry[]>}
 */
const treeAt = (read, entriesOf) => id => step(read(id), e =>
    pureOk(e === null || e.type !== 'tree' ? null : entriesOf(e.payload)))

/**
 * Whether two names are the same bytes. A name is bytes the file system
 * gave, compared as they are: no case folding, no normalisation, since
 * Git compares them so and two names differing by either are two entries.
 *
 * @type {(a: readonly number[], b: readonly number[]) => boolean}
 */
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * One step of {@link peel}, module-scoped with what it reads through given
 * rather than captured: `seen` is the ids the chain has been through and
 * `want` the type the tag that named this id declared for it, `null` at
 * the chain's head, where nothing has declared one.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(t: Tag) => Nullable<Oid>} objectOf
 * @returns {(seen: readonly Oid[], want: Nullable<ObjectType>) => Step<O, Target>}
 */
const peelFrom = (read, objectOf) => (seen, want) => id =>
    // An id the chain has been through is a cycle, which no store that
    // checks what it reads can answer and a `Read` that does not check can.
    seen.includes(id) ? pureOk(null) : step(read(id), e => {
        if (e === null) { return pureOk(null) }
        if (want !== null && e.type !== want) { return pureOk(null) }
        if (e.type !== 'tag') { return pureOk({ id, envelope: e }) }
        const t = readTag(e.payload)
        if (t === null) { return pureOk(null) }
        const next = objectOf(t)
        const type = tryType(t)
        return next === null || type === null
            ? pureOk(null)
            : peelFrom(read, objectOf)([...seen, id], type)(next)
    })

/**
 * Follows a tag to what it names, and that tag to what it names: the first
 * object that is not a tag, with the id it was reached by. An id naming no
 * tag is itself, read.
 *
 * A tag says what type its target is, and the object reached must be of
 * it, since `git cat-file -t <tag>^{}` refuses a tag whose `type` header
 * and target disagree. `null` where they do, where an object read is no
 * object of its type, where a tag's `object` header is no id of the width
 * or its `type` header names none of the four, and where the chain comes
 * back to an id it has already been through.
 *
 * The chain's length is not bounded, since Git bounds it nowhere and
 * `git tag -a t9 t8` builds one of any depth. It needs no bound to end: a
 * store answers the objects it holds, they are finite, and a chain that
 * revisits one is the cycle refused above — a cycle a store that checks
 * what it reads cannot hold anyway, a tag naming itself having to spell
 * its own id. A `Read` that answers a tag for every id it is given is
 * answering objects no repository holds, and the walk follows it as far as
 * it goes.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Step<O, Target>}
 */
export const peel = (read, oidBytes) => peelFrom(read, tryObject(oidBytes))([], null)

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
    const at = treeAt(read, entriesOf)
    return id => step(peeled(id), t => {
        if (t === null) { return pureOk(null) }
        const { envelope } = t
        if (envelope.type === 'tree') { return pureOk(entriesOf(envelope.payload)) }
        if (envelope.type !== 'commit') { return pureOk(null) }
        const c = readCommit(envelope.payload)
        if (c === null) { return pureOk(null) }
        const treeId = treeOf(c)
        return treeId === null ? pureOk(null) : at(treeId)
    })
}

/**
 * The one entry of a tree a name has, or `null` where the tree has none or
 * more than one. A tree with a name twice is one `git fsck` refuses as
 * `duplicateEntries` and the reader here takes as it finds it, so the
 * lookup is where the ambiguity is answered: two entries of a name give no
 * entry rather than the first of them, which is a plausible wrong answer.
 *
 * @type {(entries: readonly TreeEntry[], want: readonly number[]) => Nullable<TreeEntry>}
 */
const only = (entries, want) => {
    const found = entries.filter(e => same(byteArray(e.name), want))
    return found.length === 1 ? found[0] : null
}

/**
 * One component of a path matched in the entries of the tree it sits in,
 * module-scoped with the reader and the path given rather than captured:
 * the entry where the component is the last, and the tree it names walked
 * where it is not.
 *
 * A component before the last descends only through mode `40000`, the one
 * mode a tree entry gives a subtree. An entry of another mode names a
 * file, a link or another repository's commit, so the path runs into it
 * whatever object its id turns out to hold — a `100644` entry whose id
 * happens to name a tree is a corrupt tree, not a directory.
 *
 * @template {Operation} O
 * @param {Step<O, readonly TreeEntry[]>} at
 * @param {readonly (readonly number[])[]} names
 * @returns {(i: number) => (entries: Nullable<readonly TreeEntry[]>) => Effect<O, Nullable<TreeEntry>, IoChannel>}
 */
const componentAt = (at, names) => i => entries => {
    if (entries === null) { return pureOk(null) }
    const found = only(entries, names[i])
    if (found === null) { return pureOk(null) }
    if (i === names.length - 1) { return pureOk(found) }
    return isSubtree(found) ? step(at(found.oid), componentAt(at, names)(i + 1)) : pureOk(null)
}

/**
 * The entry a path names, walking from the tree an id names: one
 * component at a time, each but the last the subtree it must be.
 * `null` where a component names no entry or names two, a component before
 * the last is no subtree, the objects cannot be read, or the path has no
 * components — a path of none names the tree itself, which no entry names,
 * and {@link tryEntries} is what reads that.
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
    const at = treeAt(read, readTree(oidBytes))
    return (id, path) => {
        const names = path.map(byteArray)
        return names.length === 0 ? pureOk(null) : step(rootOf(id), componentAt(at, names)(0))
    }
}
