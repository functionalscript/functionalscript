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
 * accessor that refuses — `tryTreeAt` of a commit, `tryTarget` of a tag —
 * and answers `null` where the objects cannot take it further:
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
 * @import { TagTarget } from '../tag/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../types.ts'
 * @import { TreeEntry } from '../tree/types.ts'
 * @import { _PathItem, _PathState, _PeelItem, _PeelState } from './private.ts'
 * @import { Entry, Read, Step, Target } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { length } from '../../types/bit_vec/module.f.mjs'
import { foldStep, mapStep, pureOk, step, walkStep } from '../../effects/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { strictEqual } from '../../types/function/operator/module.f.mjs'
import { equal } from '../../types/list/module.f.mjs'
import { at, empty, setReplace } from '../../types/ordered_map/module.f.mjs'
import { tryTreeAt } from '../commit/module.f.mjs'
import { tryTargetAt } from '../tag/module.f.mjs'
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
const treeAt = (read, entriesOf) => id => mapStep(read(id), e =>
    e === null || e.type !== 'tree' ? null : entriesOf(e.payload))

/**
 * Whether two names are the same bytes: `fjs/types/list`'s `equal` over
 * `strictEqual`, which is byte-for-byte equality and nothing more. A name
 * is bytes the file system gave, compared as they are — no case folding, no
 * normalisation, since Git compares them so and two names differing by
 * either are two entries.
 *
 * @type {(a: readonly number[]) => (b: readonly number[]) => boolean}
 */
const same = equal(strictEqual)

/** The peel before it has read anything, and what a refused one answers. */
const noTarget = /** @type {_PeelState} */ ({ seen: empty, target: null })

/**
 * The id as the `seen` map keys one. A `Vec` is a whole number carrying its
 * own length, so its decimal digits name it and nothing else, which is all
 * a key has to do.
 *
 * @type {(id: Oid) => string}
 */
const seenKey = id => String(id)

/**
 * One link of {@link peel}'s chain, as {@link walkStep} walks it: the state
 * after this id is read, and the id the tag it holds names, which the walk
 * takes next. A link that refuses names none, so the walk runs out of
 * items and ends.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(payload: Bytes) => Nullable<TagTarget>} targetAt
 * @param {(payload: Bytes) => Nullable<Oid>} treeAt
 * @returns {(item: _PeelItem) => (state: _PeelState) => Effect<O, readonly [_PeelState, readonly _PeelItem[]], IoChannel>}
 */
const peelStep = (read, targetAt, treeAt) => ({ id, want }) => state => {
    const key = seenKey(id)
    // An id the chain has been through is a cycle, which no store that
    // checks what it reads can answer and a `Read` that does not check can.
    if (at(key)(state.seen) !== null) { return pureOk([state, []]) }
    return mapStep(read(id), e => {
        const seen = setReplace(key)(/** @type {const} */ (true))(state.seen)
        const stop = /** @type {readonly [_PeelState, readonly _PeelItem[]]} */ ([{ seen, target: null }, []])
        if (e === null) { return stop }
        if (want !== null && e.type !== want) { return stop }
        // A commit is parsed where the chain stops at one, since Git parses
        // it there too and refuses a tag whose target is no commit — where
        // it leaves a tree's entries and a blob's bytes unread.
        if (e.type !== 'tag') {
            return e.type === 'commit' && treeAt(e.payload) === null
                ? stop
                : [{ seen, target: { id, envelope: e } }, []]
        }
        const next = targetAt(e.payload)
        return next === null
            ? stop
            : /** @type {readonly [_PeelState, readonly _PeelItem[]]} */([
                { seen, target: null },
                [{ id: next.id, want: next.type }],
            ])
    })
}

/**
 * Follows a tag to what it names, and that tag to what it names: the first
 * object that is not a tag, with the id it was reached by. An id naming no
 * tag is itself, read.
 *
 * A tag says what type its target is, and the object reached must be of
 * it, since `git cat-file -t <tag>^{}` refuses a tag whose `type` header
 * and target disagree. `null` where they do, where the tag is one Git's own
 * parse refuses — `tryTarget` reads those three headers — and where the
 * chain comes back to an id it has already been through.
 *
 * A commit the chain stops at is read too, and `null` where Git's parse
 * refuses it: `tryTreeAt` is that parse, and `git cat-file -t <tag>^{}`
 * answers `error: bogus commit object` or `error: bad parents in commit`
 * rather than the type. It parses neither a tree's entries nor a blob's
 * bytes, and nor does this — a tree or a blob of any bytes peels, as it
 * does for Git, and reading what such a tree holds is {@link tryEntries}.
 *
 * The id it starts from is the caller's, and an id that is not
 * `oidBytes` wide is a caller's bug rather than an object that is not
 * there — `fjs/git/store`'s `tryRead` says the same of one it is handed,
 * and a `Read` that answers anything would otherwise give a SHA-256 id a
 * plausible answer from a SHA-1 walk. The ids read out of a tag or a
 * commit are the format's rather than the caller's, so those are refused
 * with `null` where the width is wrong.
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
 * @throws On an id that is not `oidBytes` wide: a caller that mixes the
 * widths has a bug, not a missing object.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Step<O, Target>}
 */
export const peel = (read, oidBytes) => {
    const f = peelStep(read, tryTargetAt(oidBytes), tryTreeAt(oidBytes))
    const bits = BigInt(oidBytes) * 8n
    return id => {
        assert(length(id) === bits, ['not an id of the width', id])
        return mapStep(walkStep(pureOk([{ id, want: null }]), noTarget, f), s => s.target)
    }
}

/**
 * The entries of the tree an id names: the id {@link peel}ed, then the tree
 * a commit names read, or the tree itself where what the id names is one.
 * `null` where the id names a blob, or the objects read cannot be read as
 * their type says. A commit {@link peel} answered has a tree already, since
 * it refuses one without, so this reads that tree and does not judge the
 * commit again.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {Step<O, readonly TreeEntry[]>}
 */
export const tryEntries = (read, oidBytes) => {
    const peeled = peel(read, oidBytes)
    const treeOf = tryTreeAt(oidBytes)
    const entriesOf = readTree(oidBytes)
    const at = treeAt(read, entriesOf)
    return id => step(peeled(id), t => {
        if (t === null) { return pureOk(null) }
        const { envelope } = t
        if (envelope.type === 'tree') { return pureOk(entriesOf(envelope.payload)) }
        // A commit peeled to has a tree, since `peel` refuses one without,
        // so what answers `null` here is an object that is no commit: a blob.
        const treeId = envelope.type === 'commit' ? treeOf(envelope.payload) : null
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
    const found = entries.filter(e => same(byteArray(e.name))(want))
    return found.length === 1 ? found[0] : null
}

/** What a path that has run out of tree carries, and answers. */
const lost = /** @type {_PathState} */ ({ entries: null, found: null })

/**
 * One component of a path matched in the entries of the tree it sits in,
 * as {@link foldStep} folds the components: the entry where the component
 * is the last, and the tree it names read for the component after it where
 * it is not.
 *
 * A component before the last descends only through mode `40000`, the one
 * mode a tree entry gives a subtree. An entry of another mode names a
 * file, a link or another repository's commit, so the path runs into it
 * whatever object its id turns out to hold — a `100644` entry whose id
 * happens to name a tree is a corrupt tree, not a directory.
 *
 * A path that has run out of tree carries {@link lost} through the
 * components that remain, reading nothing, so the fold answers `null`
 * without the early exit a fold has not got.
 *
 * @template {Operation} O
 * @param {Step<O, readonly TreeEntry[]>} at
 * @returns {(item: _PathItem) => (state: _PathState) => Effect<O, _PathState, IoChannel>}
 */
const componentStep = at => ({ name, last }) => ({ entries }) => {
    if (entries === null) { return pureOk(lost) }
    const found = only(entries, name)
    if (found === null) { return pureOk(lost) }
    if (last) { return pureOk({ entries: null, found }) }
    return isSubtree(found) ? mapStep(at(found.oid), next => ({ entries: next, found })) : pureOk(lost)
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
    const f = componentStep(treeAt(read, readTree(oidBytes)))
    return (id, path) => {
        const last = path.length - 1
        const items = path.map((p, i) => ({ name: byteArray(p), last: i === last }))
        if (items.length === 0) { return pureOk(null) }
        const walked = step(rootOf(id), entries => foldStep(pureOk(items), { entries, found: null }, f))
        return mapStep(walked, s => s.found)
    }
}
