/**
 * CAS content in a Git branch: the published snapshot of a branch, read as
 * the CAS map its tree holds.
 *
 * A branch's tree is a map from canonical CAS paths to immutable content —
 * `.cas/ab/cd/<rest>` for a key, the layout [`fjs/cas`](../module.f.mjs)'s
 * `toPath` spells and `unshard` reads back — so a commit of the branch *is*
 * a CAS snapshot, and {@link snapshot} is one read through the existing
 * `Cas<O>` surface: `read` streams the blob a key's path names and `list`
 * walks the `.cas` tree for every key. Both read the commit the snapshot ref
 * is at and nothing else: content in another branch, in Git history, in the
 * local object database or in an unpublished proposal is not in the
 * snapshot, which is what lets a consumer take a hit as a published fact
 * ([`todo/git-branch-storage.md`](../todo/git-branch-storage.md)).
 *
 * Everything here is native over [`fjs/git`](../../git/README.md): the
 * repository's id width from its `config`, the ref through the ref store,
 * the objects through the object store and the walk. No `git` runs for a
 * read.
 *
 * What a snapshot refuses rather than answers, each a repository that is not
 * what this backend writes: a `config` Git does not open, a snapshot ref
 * naming anything but a commit, and at a CAS path an entry that is no
 * regular file or an object that is no blob, and an object the snapshot names
 * that the repository does not hold — {@link casEntryCode}. A key the
 * snapshot does not hold is the ordinary miss, `ENOENT` as `fileCas` reports
 * one, and a branch no snapshot has been fetched of is the empty map.
 *
 * @module
 *
 * @import { Effect, IoChannel, Operation } from '../../effects/types.ts'
 * @import { EffectList } from '../../effects/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Oid, OidBytes } from '../../git/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { Branch, CasReader, SnapshotOperation } from './types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { errorMessage, foldStep, history, historyStep, ioError, mapStep, pureError, pureOk, refuse, resultMapStep, step, walkStep } from '../../effects/module.f.mjs'
import { fromList } from '../../effects/list/module.f.mjs'
import { isNotFound } from '../../effects/node/module.f.mjs'
import { tryTreeAt } from '../../git/commit/module.f.mjs'
import { oidBytes as widthOf } from '../../git/format/module.f.mjs'
import { hexText } from '../../git/oid/module.f.mjs'
import { isWholeName } from '../../git/refname/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { compare, tryRead as readTree } from '../../git/tree/module.f.mjs'
import { join } from '../../path/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { maxLengthBytes, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { toOption } from '../../types/nullable/module.f.js'
import { error } from '../../types/result/module.f.js'
import { prefix, toPath, unshard } from '../module.f.mjs'

/**
 * The ref the published snapshot of a branch is read at: the remote-tracking
 * ref `git fetch <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>`
 * updates, whatever refspec the repository was cloned with. A checkout of
 * the branch is never consulted, and need not exist.
 *
 * @type {(branch: Branch) => string}
 */
export const snapshotRef = ({ remote, branch }) => `refs/remotes/${remote}/${branch}`

/**
 * The code a snapshot is refused with when its repository's `config` is one
 * Git does not open: no id width can be read off it, so no object can be.
 */
export const repositoryFormatCode = /** @type {const} */ ('ERR_REPOSITORY_FORMAT')

/**
 * The code a snapshot is refused with when its ref names an object that is
 * no commit, or a commit whose `tree` header is no id. A branch ref Git
 * wrote names a commit, so this is a repository that is not what this
 * backend writes, and the map it holds is not a CAS.
 */
export const snapshotHeadCode = /** @type {const} */ ('ERR_SNAPSHOT_HEAD')

/**
 * The code a read is refused with when a CAS path holds what no CAS writes
 * there: an entry whose mode is not a regular, non-executable file, a
 * `.cas` that is no subtree, an object below it that is no tree, or an
 * object at a key's path that is no blob. Refused rather than read, because
 * a symbolic link's target text or a submodule's commit id would otherwise
 * read as the content the key names — the plausible wrong value
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * forbids.
 */
export const casEntryCode = /** @type {const} */ ('ERR_CAS_ENTRY')

/** Refuses with {@link casEntryCode}. */
const refuseEntry = refuse(casEntryCode)

/**
 * An object read from the store, with a store that has no such object
 * refused as {@link casEntryCode} rather than passed on. The store reports
 * a missing object as the host's `ENOENT`, which is the code a key the
 * snapshot does not hold is reported with too, and the two must not read
 * alike: a repository missing an object its snapshot names — a partial
 * clone, a corrupt store — would otherwise answer "not in the snapshot" for
 * a key that is. The walk itself never answers `ENOENT`; a path the tree
 * does not take is `null`.
 *
 * @template {Operation} O
 * @template T
 * @param {Effect<O, T, IoChannel>} e
 * @returns {Effect<O, T, IoChannel>}
 */
const present = e => resultMapStep(e, r => r[0] === 'error' && isNotFound(r[1])
    ? error(ioError({ code: casEntryCode, message: `an object of the snapshot is missing from the repository: ${errorMessage(r[1])}` }))
    : r)

/**
 * The one mode a CAS entry has, as Git spells it: `100644`, a regular file
 * that is not executable. `100755` is refused along with a link and a
 * submodule, since identical concurrent additions agree on this mode and a
 * writer never writes another. The spelling is the mode: `0100644` names
 * the same bits and is a tree Git refuses, so the bytes are compared and
 * not the number they parse to.
 */
const regularFile = '100644'

/** Whether an entry's mode is {@link regularFile}, spelled as it is. @type {(e: TreeEntry) => boolean} */
const isRegularFile = e => nameText(e.mode) === regularFile

/**
 * The one mode a subtree has, as Git spells it: `40000`, and the spelling
 * is the mode as it is for a file — `040000` and `40755` name the same
 * kind and are trees Git refuses, so `fjs/git/tree`'s `isSubtree`, which
 * reads the kind off the number, is not what the layout asks.
 */
const subtreeDir = '40000'

/** Whether an entry's mode is {@link subtreeDir}, spelled as it is. @type {(e: TreeEntry) => boolean} */
const isDirectory = e => nameText(e.mode) === subtreeDir

/**
 * A key the snapshot does not hold, reported as `fileCas` reports a missing
 * shard: a host `ENOENT`, so `isNotFound` tells a miss from a refusal for
 * either store.
 *
 * @type {(key: Vec) => Effect<never, never, IoChannel>}
 */
const notFound = key => pureError(ioError({ code: 'ENOENT', message: `${vecToCBase32(key)} is not in the snapshot` }))

/**
 * A key's path in the tree as the walk takes one: its components, each as
 * bytes. `toPath` spells it and the separator is the walk's.
 *
 * @type {(key: Vec) => readonly (readonly number[])[]}
 */
const components = key => toPath(key).split('/').map(ascii)

/** The path of the `.cas` directory itself: where a listing starts. */
const casDir = [ascii(prefix)]

/**
 * A blob's bytes as the chunks `Cas<O>.read` streams, at most a `Vec` each.
 */
const chunksOf = u8ListToVecChunksMsb(Number(maxLengthBytes))

/**
 * An entry's name as text, byte for code point: a cBase32 name is ASCII and
 * reads as itself, and a byte above `0x7F` spells a code point no cBase32
 * digit is, so a name holding one decodes to no key and the listing skips
 * it as `fileCas` skips a file that is no shard.
 *
 * @type {(name: TreeEntry['name']) => string}
 */
const nameText = name => codePointListToString(toArray(name))

/**
 * The key a file below `.cas` spells, or none: `unshard` over its path
 * relative to `.cas`, with the leading separator `fileCas`'s listing hands it
 * too. A subtree is no key; it is walked.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly Vec[]}
 */
const keyOf = rel => e => isDirectory(e) ? [] : toOption(unshard(join(rel, nameText(e.name))))

/**
 * What is wrong with a tree as a tree, in a few words, or nothing: the
 * three shapes `git fsck` refuses in any tree, which a walk cannot take as
 * the tree means them, so every walk here refuses a tree holding any
 * wherever it meets one.
 *
 * - A name the tree holds twice, `duplicateEntries`: the tree answers no
 *   one entry for it. Found by sorting the names, so a tree of many names
 *   costs what sorting them does and not a scan per name.
 * - A name holding a `/`, `fullPathname`: it spells a path, and is no
 *   entry a walk reaches.
 * - Entries out of the order Git writes, `treeNotSorted`: a writer
 *   rebuilding the tree around one entry would keep the order and write a
 *   tree Git refuses.
 *
 * @type {(es: readonly TreeEntry[]) => readonly string[]}
 */
const illFormed = es => {
    const sorted = es.map(e => nameText(e.name)).toSorted()
    const twice = sorted.filter((n, i) => i !== 0 && sorted[i - 1] === n)
    if (twice.length !== 0) { return [`names ${twice[0]} twice`] }
    const slashed = sorted.filter(n => n.includes('/'))
    if (slashed.length !== 0) { return [`names ${slashed[0]}, which holds a /`] }
    const unsorted = es.filter((e, i) => i !== 0 && compare(es[i - 1], e) > 0)
    return unsorted.length === 0 ? [] : [`is not in Git's order at ${nameText(unsorted[0].name)}`]
}

/**
 * What is wrong with one tree below `.cas` for the layout, in the
 * listing's words, or nothing: every way a tree this backend did not write
 * can name a key the same snapshot cannot read, so that a walk refuses the
 * layout rather than naming the key or answering its content.
 *
 * - A tree that is {@link illFormed}.
 * - An entry whose mode is neither {@link regularFile} nor
 *   {@link subtreeDir} as spelled: an executable, a link, a submodule, and
 *   `0100644` or `040000`, which name the same kinds in spellings Git
 *   refuses.
 * - A file that spells a key `toPath` files elsewhere — `.cas/a/b/<rest>`,
 *   or `.cas/<whole>`, for a key filed at `.cas/ab/cd/<rest>`: `unshard`
 *   reads the key off any split of its digits, and a read walks the one
 *   path `toPath` spells.
 *
 * @type {(rel: string) => (es: readonly TreeEntry[]) => readonly string[]}
 */
const malformed = rel => es => {
    const dir = `${prefix}${rel}`
    const wrong = illFormed(es)
    if (wrong.length !== 0) { return [`${dir} ${wrong[0]}`] }
    return es.flatMap(e => {
        const name = nameText(e.name)
        const path = `${prefix}${join(rel, name)}`
        if (isDirectory(e)) { return [] }
        if (!isRegularFile(e)) { return [`${path} has mode ${nameText(e.mode)}`] }
        const key = unshard(join(rel, name))
        return key === null || toPath(key) === path ? [] : [`${path} is no path of the layout`]
    })
}

/**
 * The subtree an entry names, as the next item of the listing's walk, or
 * none where the entry is a file.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly { readonly id: Oid, readonly rel: string }[]}
 */
const subtreeOf = rel => e => isDirectory(e) ? [{ id: e.oid, rel: join(rel, nameText(e.name)) }] : []

/**
 * The entries of the tree an id names, read through `read`, or refused where
 * the id names no tree or an object the repository does not hold. The id
 * must name a tree itself: a commit or a tag, which `fjs/git/walk`'s
 * `tryEntries` peels to a tree, is refused here, since the layout names
 * trees and a `40000` entry naming anything else is a tree Git refuses.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {(id: Oid) => Effect<O, readonly TreeEntry[], IoChannel>}
 */
const treeEntries = (read, oidBytes) => {
    const parse = readTree(oidBytes)
    return id => step(present(read(id)), o => {
        const es = o === null || o.type !== 'tree' ? null : parse(o.payload)
        return es === null ? refuseEntry(`${hexText(id)} is no tree`) : pureOk(es)
    })
}

/**
 * Where a walk down a path stands: the tree to read next, or none where
 * the path has run out of tree; the path below `.cas` of that tree, or
 * `null` above `.cas`, which is the root the layout shares with whatever
 * else the branch holds; and the entry the path named, once it has.
 */
const lost = /** @type {{ readonly at: Nullable<Oid>, readonly rel: Nullable<string>, readonly found: Nullable<TreeEntry> }} */ ({ at: null, rel: null, found: null })

/**
 * The entry a path names below a tree, or `null` where the tree does not
 * hold the path — a component no tree has, or a path through a file. Every
 * tree on the way is read as a tree and checked before it is walked: the
 * root for being {@link illFormed}, since the layout shares it with the
 * rest of the branch, and every tree below `.cas` for the layout
 * ({@link malformed}), so a key's content is answered only out of a tree
 * the listing would name it from. A `.cas` that is no subtree is refused
 * as the listing refuses it, and a `40000` entry naming no tree is refused
 * as no tree, rather than either reading as a key that is not there.
 *
 * @template {Operation} O
 * @param {(id: Oid) => Effect<O, readonly TreeEntry[], IoChannel>} entriesOf
 * @returns {(tree: Oid, path: readonly (readonly number[])[]) => Effect<O, Nullable<TreeEntry>, IoChannel>}
 */
const walkTo = entriesOf => {
    /** @type {(item: { readonly name: readonly number[], readonly last: boolean }) => (state: typeof lost) => Effect<O, typeof lost, IoChannel>} */
    const component = ({ name, last }) => state => {
        if (state.at === null) { return pureOk(lost) }
        const { rel } = state
        return step(entriesOf(state.at), es => {
            const wrong = rel === null ? illFormed(es) : malformed(rel)(es)
            if (wrong.length !== 0) { return refuseEntry(rel === null ? `the root tree ${wrong[0]}` : wrong[0]) }
            const text = nameText(name)
            const found = es.find(e => nameText(e.name) === text)
            if (found === undefined) { return pureOk(lost) }
            if (last) { return pureOk({ ...lost, found }) }
            // Below `.cas`, `malformed` has refused every file the path could
            // run into before this, since a file at a subtree's depth is
            // filed where the layout files no key; at the root this is
            // `.cas` itself, a file where the listing refuses it too.
            const below = rel === null ? '' : join(rel, text)
            if (!isDirectory(found)) { return refuseEntry(`${prefix}${below} has mode ${nameText(found.mode)}`) }
            return pureOk({ at: found.oid, rel: below, found: null })
        })
    }
    return (tree, path) => {
        const items = path.map((name, i) => ({ name, last: i === path.length - 1 }))
        return mapStep(foldStep(pureOk(items), { ...lost, at: tree }, component), s => s.found)
    }
}

/**
 * The CAS map the tree `tree` holds, read through `read`, a store's reader
 * at the repository's id width; `null` is the empty map, which is what a
 * branch nobody has published has.
 *
 * `read` of a key walks `.cas/ab/cd/<rest>` to the entry ({@link walkTo})
 * and streams the blob it names; a path the tree does not take it down is
 * the ordinary miss. `list` walks the `.cas` subtree, every file below it a
 * key and every subtree walked in turn, flat in the tree's size as
 * `walkStep` keeps a walk. Neither reads an object it need not: a listing
 * reads trees and no blob. Both check every tree they read for the layout
 * before taking it, so what one answers the other would answer too, and a
 * tree this backend did not write is refused rather than read as a map it
 * is not.
 *
 * Parameterized by the reader rather than a directory so that one reader
 * serves every read of a snapshot — `readIn` resolves a repository's
 * borrowings once — and so that the map is provable against any store.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {(tree: Nullable<Oid>) => CasReader<O>}
 */
export const casAt = (read, oidBytes) => {
    const entriesOf = treeEntries(read, oidBytes)
    const entryAt = walkTo(entriesOf)
    /**
     * The blob a key's entry names, streamed: refused where its object is no
     * blob, which holds something that is not the key's content. The
     * entry's mode was the walk's to check, in the tree it came from.
     *
     * @type {(e: TreeEntry) => EffectList<O, Vec, IoChannel>}
     */
    const blobOf = e => step(present(read(e.oid)), o => o === null || o.type !== 'blob'
        ? refuseEntry(`${hexText(e.oid)} is no blob`)
        : fromList(chunksOf(o.payload)))
    /**
     * One subtree of the listing's walk: its files' keys added, its subtrees
     * walked next. An object below `.cas` that is no tree refuses the listing
     * rather than shortening it, and so does a tree that is {@link malformed}
     * for the layout. The keys gather as a list whose
     * `concat` is one node per tree, flattened once at the end, so a walk
     * over many trees copies nothing it gathered before.
     *
     * @type {(item: { readonly id: Oid, readonly rel: string }) => (keys: List<Vec>) => Effect<O, readonly [List<Vec>, readonly { readonly id: Oid, readonly rel: string }[]], IoChannel>}
     */
    const listStep = ({ id, rel }) => keys => step(entriesOf(id), es => {
        const wrong = malformed(rel)(es)
        return wrong.length !== 0
            ? refuseEntry(wrong[0])
            : pureOk([concat(keys)(es.flatMap(keyOf(rel))), es.flatMap(subtreeOf(rel))])
    })
    return tree => ({
        read: key => tree === null
            ? notFound(key)
            : step(entryAt(tree, components(key)), e => e === null ? notFound(key) : blobOf(e)),
        list: () => {
            if (tree === null) { return pureOk([]) }
            // Three links: the `.cas` entry, the walk below it, the list
            // flattened. No `.cas` is the empty map; one that is no subtree
            // is refused; and `toArray` of the empty list is `[]`.
            const cas = step(entryAt(tree, casDir), e => {
                if (e === null) { return pureOk(null) }
                return isDirectory(e) ? pureOk(e.oid) : refuseEntry(`${prefix} has mode ${nameText(e.mode)}`)
            })
            const keys = step(cas, id => id === null
                ? pureOk(/** @type {List<Vec>} */ (null))
                : walkStep(pureOk([{ id, rel: '' }]), /** @type {List<Vec>} */ (null), listStep))
            return mapStep(keys, toArray)
        },
    })
}

/**
 * The published snapshot of `branch`: the CAS map at the commit its
 * {@link snapshotRef} names, or the empty map where the ref is not there —
 * a branch never fetched, or one the remote does not have yet.
 *
 * Four reads before any key is asked for, each once per snapshot rather than
 * once per key: the repository's id width from its `config`, its object
 * directories, the ref, and the commit the ref names, read to the tree it
 * holds. A `config` Git does not open is {@link repositoryFormatCode}; a ref
 * naming what is no commit, or a commit with no tree to read, is
 * {@link snapshotHeadCode}. A branch whose name is no ref name is a question
 * nothing stores an answer to, and is refused as {@link snapshotHeadCode}
 * before any file is opened rather than read as an empty map. A ref that
 * is there but malformed — a loose file holding no id, a dangling symbolic
 * ref, a `packed-refs` Git refuses — is `null` to `tryResolve` as an absent
 * ref is, and so opens the empty map here;
 * [`todo/absent-or-malformed.md`](./todo/absent-or-malformed.md) tracks
 * telling the two apart.
 *
 * @type {(branch: Branch) => Effect<SnapshotOperation, CasReader<SnapshotOperation>, IoChannel>}
 */
export const snapshot = branch => {
    const { dir } = branch
    const name = stringToU8List(snapshotRef(branch))
    if (!isWholeName(name)) {
        return refuse(snapshotHeadCode)(`${snapshotRef(branch)} is not a ref name`)
    }
    const width = step(widthOf(dir), w => w === null
        ? refuse(repositoryFormatCode)(`${dir} is not a repository Git opens`)
        : pureOk(w))
    const dirs = historyStep(history(width), () => objectsDirs(dir))
    const reader = historyStep(dirs, (ods, w) => pureOk(readIn(ods, w)))
    const head = historyStep(reader, (_read, _ods, w) => tryResolve({ gitdir: dir, common: dir }, w)(name))
    const object = historyStep(head, (commit, read) => commit === null ? pureOk(null) : present(read(commit)))
    return step(object, ([o, commit, read, , w]) => {
        const at = casAt(read, w)
        if (commit === null) { return pureOk(at(null)) }
        const tree = o === null || o.type !== 'commit' ? null : tryTreeAt(w)(o.payload)
        return tree === null
            ? refuse(snapshotHeadCode)(`${snapshotRef(branch)} names ${hexText(commit)}, which is no commit`)
            : pureOk(at(tree))
    })
}
