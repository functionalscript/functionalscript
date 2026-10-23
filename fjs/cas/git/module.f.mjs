/**
 * CAS content in a Git branch: the published snapshot of a branch, read as
 * the CAS map its tree holds, and the proposal a writer adds to before it
 * is published.
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
 * {@link proposal} is the branch as a writer sees it, a whole `Cas<O>`: its
 * `read` and `list` see the proposal's tree, the published snapshot plus
 * what this repository has added, and its `write` adds content as Git adds
 * a file — the blob as a loose object in the repository's own `objects/`,
 * the `.cas` trees above it rebuilt, and one commit on the proposal ref,
 * {@link proposalRef}, with the proposal so far as its parent. The source
 * checkout is never touched: no `HEAD`, no index, no file of the worktree,
 * only objects and a ref of this backend's own. Publishing the proposal to
 * the remote is the next step of the todo, not this module's yet.
 *
 * Everything here is native over [`fjs/git`](../../git/README.md): the
 * repository's id width from its `config`, the refs through the ref store
 * and its writer, the objects through the object store and the walk, the
 * trees and commits through their writers, the loose file through
 * [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs). No `git` runs.
 *
 * What a snapshot refuses rather than answers, each a repository that is not
 * what this backend writes: a `config` Git does not open, a snapshot ref
 * naming anything but a commit, and at a CAS path an entry that is no
 * regular file or an object that is no blob, and an object the snapshot names
 * that the repository does not hold — {@link casEntryCode}. A key the
 * snapshot does not hold is the ordinary miss, `ENOENT` as `fileCas` reports
 * one, and a branch no snapshot has been fetched of is the empty map. A
 * write refuses the same shapes where it meets them, and one more: a key
 * already in the tree over other bytes, which is a hash collision or a
 * corrupt store and never a write to make.
 *
 * Two limits, each recorded as a todo beside this module: a payload is held
 * in memory while its object is written, since a loose object's envelope
 * states the size before the bytes
 * ([`todo/streaming-writes.md`](./todo/streaming-writes.md)); and two
 * writers of one repository advancing the proposal ref at once can lose one
 * another's commit, since the ref store's writer locks a file and compares
 * nothing ([`todo/concurrent-local-writers.md`](./todo/concurrent-local-writers.md)).
 *
 * @module
 *
 * @import { Effect, IoChannel, Operation } from '../../effects/types.ts'
 * @import { EffectList } from '../../effects/list/types.ts'
 * @import { Sha2, State as Sha2State } from '../../crypto/sha2/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Dirs } from '../../git/refstore/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { Cas } from '../types.ts'
 * @import { Author, Branch, CasReader, ProposalOperation, SnapshotOperation } from './types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import {
    catchStep, errorMessage, history, historyStep, ioError, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep,
    step, walkStep,
} from '../../effects/module.f.mjs'
import { fromList } from '../../effects/list/module.f.mjs'
import { isNotFound, mkdir, now, rename, rm, writeExclusive } from '../../effects/node/module.f.mjs'
import { tryTreeAt } from '../../git/commit/module.f.mjs'
import { oidBytes as widthOf } from '../../git/format/module.f.mjs'
import { write as writePayload } from '../../git/header/module.f.mjs'
import { write as writeIdent } from '../../git/ident/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of, toHex } from '../../git/oid/module.f.mjs'
import { isWholeName } from '../../git/refname/module.f.mjs'
import { tryRead as readLoose } from '../../git/loose/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { tryWrite } from '../../git/refstore/write/module.f.mjs'
import { objectPath, objectsDir, objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { compare, isSubtree, tryRead as readTree, write as writeTree } from '../../git/tree/module.f.mjs'
import { tryEntry } from '../../git/walk/module.f.mjs'
import { join, parent } from '../../path/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { isWholeBytes, maxLengthBytes, u8ListMsb, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { concat, flat, map, sameItems, toArray } from '../../types/list/module.f.mjs'
import { toOption } from '../../types/nullable/module.f.js'
import { error } from '../../types/result/module.f.js'
import { stored } from '../../zlib/stored/module.f.mjs'
import { prefix, random256, toPath, unshard } from '../module.f.mjs'

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
 * The ref a repository's proposal for a branch is kept at: below `refs/cas/`,
 * a namespace of this backend's own that `git branch` does not list and no
 * worktree can have checked out, so advancing it moves nothing a person is
 * looking at. One per remote and branch, as the snapshot ref is.
 *
 * @type {(branch: Branch) => string}
 */
export const proposalRef = ({ remote, branch }) => `refs/cas/${remote}/${branch}`

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
 * forbids. A write meeting the same shapes refuses too, and refuses a key's
 * path that already holds another blob: the same key names the same bytes,
 * so another blob there is a collision or a corrupt store.
 */
export const casEntryCode = /** @type {const} */ ('ERR_CAS_ENTRY')

/** Refuses with {@link casEntryCode}. */
const refuseEntry = refuse(casEntryCode)

/** Refuses with {@link snapshotHeadCode}. */
const refuseHead = refuse(snapshotHeadCode)

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

/** The two modes a writer spells, as the digits a tree entry holds. */
const fileMode = ascii('100644')

const subtreeMode = ascii('40000')

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
 * @type {(name: Bytes) => string}
 */
const nameText = name => codePointListToString(toArray(name))

/**
 * The key a file below `.cas` spells, or none: `unshard` over its path
 * relative to `.cas`, with the leading separator `fileCas`'s listing hands it
 * too. A subtree is no key; it is walked.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly Vec[]}
 */
const keyOf = rel => e => isSubtree(e) ? [] : toOption(unshard(join(rel, nameText(e.name))))

/**
 * What is wrong with one tree below `.cas`, in the listing's words, or
 * nothing: every way a tree this backend did not write can name a key the
 * same snapshot cannot read, so that the listing refuses the layout rather
 * than naming the key.
 *
 * - A name the tree holds twice, which `git fsck` refuses as
 *   `duplicateEntries`; a read of the path answers no entry for it.
 * - A name holding a `/`, which `git fsck` refuses as `fullPathname`: it
 *   spells a path, and is no entry the walk reaches.
 * - A file whose mode is not {@link regularFile} as spelled: a read refuses
 *   its blob, and `0100644` is a tree Git refuses.
 * - A file that spells a key `toPath` files elsewhere — `.cas/a/b/<rest>`,
 *   or `.cas/<whole>`, for a key filed at `.cas/ab/cd/<rest>`: `unshard`
 *   reads the key off any split of its digits, and a read walks the one
 *   path `toPath` spells.
 *
 * @type {(rel: string) => (es: readonly TreeEntry[]) => readonly string[]}
 */
const malformed = rel => es => {
    const dir = `${prefix}${rel}`
    const names = es.map(e => nameText(e.name))
    const twice = names.filter((n, i) => names.indexOf(n) !== i)
    if (twice.length !== 0) { return [`${dir} names ${twice[0]} twice`] }
    return es.flatMap(e => {
        const name = nameText(e.name)
        const path = `${prefix}${join(rel, name)}`
        if (name.includes('/')) { return [`${path} is no path of the layout`] }
        if (isSubtree(e)) { return [] }
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
const subtreeOf = rel => e => isSubtree(e) ? [{ id: e.oid, rel: join(rel, nameText(e.name)) }] : []

/**
 * The entries of the tree an id names, read through `read`, or refused where
 * the id names no tree or an object the repository does not hold. The id
 * must name a tree itself: a commit or a tag, which the walk's `tryEntries`
 * peels to a tree, is refused here, since a read of a key does not peel
 * below the root and would miss what a write through it had placed. One
 * answer for the listing and the writer, so that both read a tree the same
 * way.
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
 * The entry of `name` among a tree's entries, or `null`, beside the
 * entries: refused where the tree names it twice, which `git fsck` refuses
 * as `duplicateEntries` and the walk answers no entry for, so a write that
 * took the first of them would report stored what a read cannot find.
 *
 * @type {(name: readonly number[]) => (es: readonly TreeEntry[]) => Effect<never, { readonly es: readonly TreeEntry[], readonly found: Nullable<TreeEntry> }, IoChannel>}
 */
const onlyNamed = name => es => {
    const found = es.filter(x => sameItems(x.name)(name))
    return found.length > 1
        ? refuseEntry(`a tree names ${nameText(name)} twice`)
        : pureOk({ es, found: found.length === 0 ? null : found[0] })
}

/**
 * The tree the commit an id names holds, read through `read`, or refused as
 * {@link snapshotHeadCode} where the id names no commit, or a commit whose
 * `tree` header is no id. What a ref of this backend's is read to, before
 * the map below it is.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @param {string} ref
 * @returns {(commit: Oid) => Effect<O, Oid, IoChannel>}
 */
const treeOfCommit = (read, oidBytes, ref) => {
    const treeAt = tryTreeAt(oidBytes)
    return commit => step(present(read(commit)), o => {
        const tree = o === null || o.type !== 'commit' ? null : treeAt(o.payload)
        return tree === null
            ? refuseHead(`${ref} names ${hexText(commit)}, which is no commit`)
            : pureOk(tree)
    })
}

/**
 * The CAS map the tree `tree` holds, read through `read`, a store's reader
 * at the repository's id width; `null` is the empty map, which is what a
 * branch nobody has published has.
 *
 * `read` of a key walks `.cas/ab/cd/<rest>` to the entry and streams the
 * blob it names; a path the tree does not take it down is the ordinary
 * miss. `list` walks the `.cas` subtree, every file below it a key and every
 * subtree walked in turn, flat in the tree's size as `walkStep` keeps a walk.
 * Neither reads an object it need not: a listing reads trees and no blob.
 *
 * A path the walk cannot take because the tree is malformed — a `40000`
 * entry naming a blob, a root that is no tree — is `null` to `tryEntry` as
 * a path the tree does not have is, and so reads as the miss here; telling
 * the two apart is the primitive's to do, and
 * [`todo/absent-or-malformed.md`](./todo/absent-or-malformed.md) tracks it.
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
    const entryAt = tryEntry(read, oidBytes)
    const entriesOf = treeEntries(read, oidBytes)
    /**
     * The blob a key's entry names, streamed: refused where the entry is no
     * regular file or its object no blob, since either holds something that is
     * not the key's content.
     *
     * @type {(e: TreeEntry) => EffectList<O, Vec, IoChannel>}
     */
    const blobOf = e => {
        if (!isRegularFile(e)) {
            return refuseEntry(`${nameText(e.name)} has mode ${nameText(e.mode)}`)
        }
        return step(present(read(e.oid)), o => o === null || o.type !== 'blob'
            ? refuseEntry(`${hexText(e.oid)} is no blob`)
            : fromList(chunksOf(o.payload)))
    }
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
            : step(present(entryAt(tree, components(key))), e => e === null ? notFound(key) : blobOf(e)),
        list: () => {
            if (tree === null) { return pureOk([]) }
            // Three links: the `.cas` entry, the walk below it, the list
            // flattened. No `.cas` is the empty map; one that is no subtree
            // is refused; and `toArray` of the empty list is `[]`.
            const cas = step(present(entryAt(tree, casDir)), e => {
                if (e === null) { return pureOk(null) }
                return isSubtree(e) ? pureOk(e.oid) : refuseEntry(`${prefix} has mode ${nameText(e.mode)}`)
            })
            const keys = step(cas, id => id === null
                ? pureOk(/** @type {List<Vec>} */ (null))
                : walkStep(pureOk([{ id, rel: '' }]), /** @type {List<Vec>} */ (null), listStep))
            return mapStep(keys, toArray)
        },
    })
}

/**
 * What every operation on a branch resolves first, once rather than per
 * key: the repository's id width, its object directories and a reader over
 * them, and the two directories its refs live in — one directory twice,
 * since the backend's refs are shared refs and no worktree's own.
 *
 * @type {(dir: string) => Effect<SnapshotOperation, { readonly oidBytes: OidBytes, readonly read: Read<SnapshotOperation>, readonly dirs: Dirs }, IoChannel>}
 */
const opened = dir => {
    const width = step(widthOf(dir), w => w === null
        ? refuse(repositoryFormatCode)(`${dir} is not a repository Git opens`)
        : pureOk(w))
    const dirs = historyStep(history(width), () => objectsDirs(dir))
    return mapStep(dirs, ([ods, oidBytes]) => ({ oidBytes, read: readIn(ods, oidBytes), dirs: { gitdir: dir, common: dir } }))
}

/**
 * A ref name of this backend's as the ref store takes one, or refused as
 * {@link snapshotHeadCode} where the branch's name makes it no ref name: a
 * question nothing stores an answer to, refused before any file is opened
 * rather than read as an empty map.
 *
 * @type {(ref: string) => Effect<never, Bytes, IoChannel>}
 */
const refName = ref => {
    const name = stringToU8List(ref)
    return isWholeName(name) ? pureOk(name) : refuseHead(`${ref} is not a ref name`)
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
 * {@link snapshotHeadCode}, and so is a branch whose name is no ref name. A
 * ref that is there but malformed — a loose file holding no id, a dangling
 * symbolic ref, a `packed-refs` Git refuses — is `null` to `tryResolve` as
 * an absent ref is, and so opens the empty map here;
 * [`todo/absent-or-malformed.md`](./todo/absent-or-malformed.md) tracks
 * telling the two apart.
 *
 * @type {(branch: Branch) => Effect<SnapshotOperation, CasReader<SnapshotOperation>, IoChannel>}
 */
export const snapshot = branch => {
    const ref = snapshotRef(branch)
    const named = history(refName(ref))
    const o = historyStep(named, () => opened(branch.dir))
    const head = historyStep(o, ({ oidBytes, dirs }, name) => tryResolve(dirs, oidBytes)(name))
    const tree = historyStep(head, (commit, { oidBytes, read }) => commit === null ? pureOk(null) : treeOfCommit(read, oidBytes, ref)(commit))
    return mapStep(tree, ([t, , { oidBytes, read }]) => casAt(read, oidBytes)(t))
}

/**
 * Writes an object into the repository's own `objects/`, as the loose file
 * Git stores one in — `<type> SP <size> NUL <payload>`, one zlib stream, at
 * `objects/ab/<rest>` of its id — and answers the id. An object already
 * there is read as the loose file it is and left as it is where it is the
 * object: the id names its bytes, so nothing is to be written. A file at
 * the path that is not the object — truncated, no zlib stream, another
 * object's bytes — is replaced, since a `stat` alone would have taken it
 * for the object and a later read would refuse what this write had
 * reported stored. The file itself is read, not the store: the store's
 * reader answers from a pack or a borrowed directory too, and the object
 * being there would leave a corrupt loose file in place for Git to refuse
 * later. Otherwise the stream goes to a temporary name
 * below `objects/`, as Git's own `tmp_obj_*` does, and is renamed into place
 * once whole, so no reader meets a loose file that is not an object; a
 * rename that fails takes the temporary file with it.
 *
 * The payload is held whole: the envelope states the size before the
 * bytes, which is the limit
 * [`todo/streaming-writes.md`](./todo/streaming-writes.md) records.
 *
 * @throws If an item of `payload` is not a byte, as the envelope's writer throws.
 *
 * @type {(dir: string, oidBytes: OidBytes) => (type: ObjectType, payload: Bytes) => Effect<ProposalOperation, Oid, IoChannel>}
 */
export const writeObject = (dir, oidBytes) => {
    const idOf = of(oidBytes)
    const at = objectPath(dir)
    const od = objectsDir(dir)
    return (type, payload) => {
        const id = idOf(type, payload)
        const path = at(id)
        // Anything but the object at the path — no file, a stream that is no
        // zlib stream, no object, bytes hashing to another id — is an object
        // to write.
        const there = catchStep(mapStep(readLoose(path), o => o !== null && idOf(o.type, o.payload) === id), () => pureOk(false))
        return step(there, found => {
            if (found) { return pureOk(id) }
            const named = history(mapStep(random256, rnd => join(od, `tmp_obj_${vecToCBase32(rnd)}`)))
            const made = historyStep(named, () => mkdir(parent(path), { recursive: true }))
            const filled = historyStep(made, (_, tmp) => writeExclusive(tmp, toArray(chunksOf(stored(writeEnvelope(type, payload))))))
            return step(filled, ([, , tmp]) => {
                const moved = catchStep(rename(tmp, path), e => resultStep(rm(tmp), () => pureError(e)))
                return mapStep(moved, () => id)
            })
        })
    }
}

/**
 * `entries` with `e` in place of the entry of its name, where the tree
 * order Git requires puts it.
 *
 * @type {(entries: readonly TreeEntry[], e: TreeEntry) => readonly TreeEntry[]}
 */
const withEntry = (entries, e) => {
    const others = entries.filter(x => !sameItems(x.name)(e.name))
    const i = others.findIndex(x => compare(e, x) < 0)
    return i === -1 ? [...others, e] : [...others.slice(0, i), e, ...others.slice(i)]
}

/**
 * The tree `tree` with the blob `blob` at `path`, written: every tree along
 * the path rebuilt and stored, the new root's id answered. `null` where the
 * blob is already there, so nothing was written and the tree stands; a
 * path through an entry that is no subtree, or ending at another blob, is
 * refused — the first is no CAS layout, the second a collision or a corrupt
 * store, and neither is a write to make. A `null` tree is the empty one.
 *
 * Recursive along the path, which has as many components as `toPath`
 * spells and no more, so the recursion is as deep as the layout and not as
 * deep as a store.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(type: ObjectType, payload: Bytes) => Effect<ProposalOperation, Oid, IoChannel>} write
 * @param {OidBytes} oidBytes
 * @returns {(tree: Nullable<Oid>, path: readonly (readonly number[])[], blob: Oid) => Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>}
 */
const placed = (read, write, oidBytes) => {
    const entriesOf = treeEntries(read, oidBytes)
    const bytesOf = writeTree(oidBytes)
    /** @type {(entries: readonly TreeEntry[], e: TreeEntry) => Effect<ProposalOperation, Nullable<Oid>, IoChannel>} */
    const rebuilt = (entries, e) => write('tree', bytesOf(withEntry(entries, e)))
    /** @type {(tree: Nullable<Oid>, path: readonly (readonly number[])[], blob: Oid) => Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>} */
    const go = (tree, [name, ...rest], blob) => {
        const entries = tree === null ? pureOk(/** @type {readonly TreeEntry[]} */ ([])) : entriesOf(tree)
        const looked = step(entries, onlyNamed(name))
        if (rest.length === 0) {
            return step(looked, ({ es, found }) => {
                if (found === null) { return rebuilt(es, { mode: fileMode, name, oid: blob }) }
                return isRegularFile(found) && found.oid === blob
                    ? pureOk(null)
                    : refuseEntry(`${nameText(name)} already holds ${hexText(found.oid)}`)
            })
        }
        const below = historyStep(history(looked), ({ found }) => {
            if (found === null) { return go(null, rest, blob) }
            return isSubtree(found) ? go(found.oid, rest, blob) : refuseEntry(`${nameText(name)} is no subtree`)
        })
        return step(below, ([sub, { es }]) => sub === null ? pureOk(null) : rebuilt(es, { mode: subtreeMode, name, oid: sub }))
    }
    return go
}

/** What a chunk that is not whole bytes is refused as: `writeBytes`'s words, which `fileCas.write` and `contentKey` refuse it with. */
const partialByte = pureError(ioError({ message: 'invalid buffer size' }))

/**
 * A payload gathered: its chunks, held, and its CAS key, the hash `fileCas`
 * folds over the same chunks — one pass over the stream for both. A stream
 * that fails fails this, as `write` fails closed, and so does a chunk that
 * is not whole bytes: the blob's bytes would pad it where the key hashed
 * its bits, and a key is the hash of the bytes a read answers.
 *
 * @template {Operation} O
 * @param {Sha2} sha2
 * @param {EffectList<O, Vec, IoChannel>} payload
 * @returns {Effect<O, { readonly key: Vec, readonly chunks: readonly Vec[] }, IoChannel>}
 */
const gathered = (sha2, payload) => {
    /** @type {(state: Sha2State, chunks: readonly Vec[]) => (s: EffectList<O, Vec, IoChannel>) => Effect<O, { readonly key: Vec, readonly chunks: readonly Vec[] }, IoChannel>} */
    const loop = (state, chunks) => s =>
        step(s, node => {
            if (node === undefined) { return pureOk({ key: sha2.end(state), chunks }) }
            return isWholeBytes(node.first) ? loop(sha2.append(node.first)(state), [...chunks, node.first])(node.tail) : partialByte
        })
    return loop(sha2.init, [])(payload)
}

/**
 * The commit that adds `key` to the proposal: `tree` the new tree, `parent`
 * the proposal so far where there is one, `author` and `committer` the one
 * ident at `ms` — the `now` effect's milliseconds, as the seconds Git
 * counts, in `+0000` — and a message naming the key.
 *
 * @throws As the ident writer throws, on a name or an email holding `<`, `>`
 * or a line feed.
 *
 * @type {(author: Author, tree: Oid, parent: Nullable<Oid>, key: Vec, ms: number) => Bytes}
 */
const commitOf = (author, tree, parent, key, ms) => {
    const who = writeIdent({
        name: stringToU8List(author.name),
        email: stringToU8List(author.email),
        time: BigInt(Math.floor(ms / 1_000)),
        tz: '+0000',
    })
    return writePayload({
        headers: [
            [ascii('tree'), toHex(tree)],
            ...parent === null ? [] : [/** @type {const} */ ([ascii('parent'), toHex(parent)])],
            [ascii('author'), who],
            [ascii('committer'), who],
        ],
        message: ascii(`cas: add ${vecToCBase32(key)}\n`),
    })
}

/**
 * The proposal of `branch`, by `author`, as a `Cas<O>` keyed by `sha2`'s
 * hash as `fileCas(sha2)` is. Its `read` and `list` see the proposal's
 * tree — the published snapshot plus what this repository has added — and
 * its `write` adds content: the blob as a loose object, the trees above it
 * rebuilt, and one commit on {@link proposalRef} with the proposal so far
 * as its parent, or the published snapshot's commit where no proposal has
 * been started, or no parent where the branch has nothing yet. Content
 * already in the tree under its key is written as no object and no
 * commit: the key is answered and the proposal stands.
 *
 * Each operation reads the proposal ref when it runs rather than once, so
 * a `read` after a `write` sees the write; a snapshot pins its commit, and
 * {@link snapshot} is where to read what is published.
 *
 * The source checkout is not touched: the writes are below `objects/` and
 * at the proposal ref, and nowhere else.
 *
 * @param {Sha2} sha2
 * @param {Branch} branch
 * @param {Author} author
 * @returns {Effect<ProposalOperation, Cas<ProposalOperation>, IoChannel>}
 */
export const proposal = (sha2, branch, author) => {
    const ref = proposalRef(branch)
    const named = historyStep(history(refName(ref)), () => refName(snapshotRef(branch)))
    const o = historyStep(named, () => opened(branch.dir))
    return mapStep(o, ([{ oidBytes, read, dirs }, published, name]) => {
        const resolve = tryResolve(dirs, oidBytes)
        const at = casAt(read, oidBytes)
        const treeOf = treeOfCommit(read, oidBytes, ref)
        const write = writeObject(branch.dir, oidBytes)
        const place = placed(read, write, oidBytes)
        const writeRef = tryWrite(dirs, oidBytes)(name)
        /**
         * The commit the proposal stands at: the proposal ref, or the
         * published snapshot where none has been started, or none.
         */
        const head = step(resolve(name), c => c === null ? resolve(published) : pureOk(c))
        /** That commit's tree, or `null` for the empty one. */
        const tree = step(head, c => c === null ? pureOk(null) : treeOf(c))
        /**
         * Seven links, one per line and in the order they run: the payload
         * gathered, its blob written, the proposal's head and tree read, the
         * tree rebuilt around the blob, the time taken, and the commit written
         * and the ref moved to it — or neither, where the tree stood.
         *
         * @template {Operation} O1
         * @param {EffectList<O1, Vec, IoChannel>} payload
         * @returns {Effect<O1 | ProposalOperation, Vec, IoChannel>}
         */
        const add = payload => {
            const got = history(gathered(sha2, payload))
            const blob = historyStep(got, ({ chunks }) => write('blob', flat(map(u8ListMsb)(chunks))))
            const base = historyStep(blob, () => head)
            const baseTree = historyStep(base, c => c === null ? pureOk(null) : treeOf(c))
            const root = historyStep(baseTree, (t, _c, b, { key }) => place(t, components(key), b))
            const when = historyStep(root, () => now())
            return step(when, ([ms, newTree, , c, , { key }]) => {
                if (newTree === null) { return pureOk(key) }
                const commit = write('commit', commitOf(author, newTree, c, key, ms))
                return step(commit, id => mapStep(writeRef(id), () => key))
            })
        }
        return {
            read: key => step(tree, t => at(t).read(key)),
            list: () => step(tree, t => at(t).list()),
            write: add,
        }
    })
}
