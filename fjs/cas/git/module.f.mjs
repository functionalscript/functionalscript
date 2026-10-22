/**
 * CAS content in a Git branch: the published snapshot of a branch, read as
 * the CAS map its tree holds; the proposal a writer adds to and takes out
 * of; and the publication that carries the proposal to the remote branch.
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
 * {@link proposal} is the branch as a writer sees it, a whole `Cas<O>` and
 * two deletions: its `read` and `list` see the proposal's tree, the
 * published snapshot plus what this repository has added, its `write` adds
 * content as Git adds a file — the blob as a loose object in the
 * repository's own `objects/`, the `.cas` trees above it rebuilt, and one
 * commit on the proposal ref, {@link proposalRef}, with the proposal so far
 * as its parent — and `remove` and `clear` take content out the same way,
 * one deletion commit each. The source checkout is never touched: no `HEAD`,
 * no index, no file of the worktree, only objects and refs of this backend's
 * own.
 *
 * {@link publish} carries the proposal to the remote branch through a
 * {@link Remote}: fetch, then push the proposal where it descends from what
 * was fetched, and otherwise reconcile the two through their merge base —
 * by exact path, the proposal's additions and deletions since the base
 * applied to the fetched tree, every entry unchanged by the proposal taken
 * as the remote has it — as one merge commit with both as parents, and
 * push that; a push the remote refuses because the branch moved is fetched
 * and reconciled again, the merge commit kept as the proposal so its
 * ancestry is kept, until the push lands or the attempts run out. Nothing
 * is ever force-pushed. {@link gitRemote} is the remote over the `git`
 * command line, through the `exec` effect, and is the one place a `git`
 * runs: the network is the one thing [`fjs/git`](../../git/README.md) does
 * not do.
 *
 * Everything else is native over `fjs/git`: the repository's id width from
 * its `config`, the refs through the ref store and its writer, the objects
 * through the object store and the walk, the trees and commits through
 * their writers, the loose file through
 * [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs).
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
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Dirs } from '../../git/refstore/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { _Change, _Keyed, _Removal } from './private.ts'
 * @import { Author, Branch, CasReader, GitRemoteOperation, Proposal, ProposalOperation, Remote, SnapshotOperation } from './types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import {
    catchStep, errorMessage, foldStep, history, historyStep, ioError, mapStep, pure, pureError, pureOk, refuse, resultMapStep,
    resultStep, step, walkStep,
} from '../../effects/module.f.mjs'
import { fromList } from '../../effects/list/module.f.mjs'
import { exec, isNotFound, mkdir, now, rename, rm, writeExclusive } from '../../effects/node/module.f.mjs'
import { tryTreeAt } from '../../git/commit/module.f.mjs'
import { oidBytes as widthOf } from '../../git/format/module.f.mjs'
import { write as writePayload } from '../../git/header/module.f.mjs'
import { write as writeIdent } from '../../git/ident/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of, toHex, tryFromHex } from '../../git/oid/module.f.mjs'
import { isWholeName } from '../../git/refname/module.f.mjs'
import { tryRead as readLoose } from '../../git/loose/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { tryDelete, tryWrite } from '../../git/refstore/write/module.f.mjs'
import { objectPath, objectsDir, objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { compare, isSubtree, mode, write as writeTree } from '../../git/tree/module.f.mjs'
import { tryEntries, tryEntry } from '../../git/walk/module.f.mjs'
import { join, parent } from '../../path/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { isWholeBytes, maxLengthBytes, u8ListMsb, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { concat, flat, map, sameItems, toArray } from '../../types/list/module.f.mjs'
import { toOption } from '../../types/nullable/module.f.js'
import { error, ok } from '../../types/result/module.f.js'
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

/**
 * The code a publication is refused with when every attempt's push was
 * refused by the remote: {@link maxAttempts} fetches, reconciliations and
 * pushes, each finding the branch moved again. The proposal ref holds the
 * last reconciliation, so the next publication starts from it rather than
 * from the beginning.
 */
export const publishAttemptsCode = /** @type {const} */ ('ERR_PUBLISH_ATTEMPTS')

/**
 * The code a `git` command's argument is refused with when no quoting makes
 * it safe for the shell `exec` hands the command to; see {@link quoted}.
 */
export const shellArgumentCode = /** @type {const} */ ('ERR_SHELL_ARGUMENT')

/**
 * The code `git`'s output is refused with when it does not say what the
 * command's contract says it says: a line that holds no object id where one
 * was asked for.
 */
export const gitOutputCode = /** @type {const} */ ('ERR_GIT_OUTPUT')

/**
 * How many times a publication fetches, reconciles and pushes before it
 * gives up as {@link publishAttemptsCode}: enough for a branch several
 * writers publish to at once, and a bound, so that a remote that refuses
 * every push does not keep a writer forever.
 */
export const maxAttempts = 8

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
 * writer never writes another.
 */
const regularFile = 0o100644

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

/** The path of the `.cas` directory itself: where a listing starts, and what `clear` takes out. */
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
 * The entry a file below `.cas` is, keyed, or none: `unshard` over its path
 * relative to `.cas`, with the leading separator `fileCas`'s listing hands it
 * too. A subtree is no key; it is walked.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly _Keyed[]}
 */
const keyedOf = rel => e => {
    if (isSubtree(e)) { return [] }
    const key = unshard(join(rel, nameText(e.name)))
    return key === null ? [] : [{ key, oid: e.oid }]
}

/**
 * The path of an entry below `.cas` that is no path of the layout, or
 * none: a file that spells a key `toPath` files elsewhere — `.cas/a/b/<rest>`,
 * or `.cas/<whole>`, for a key filed at `.cas/ab/cd/<rest>` — and an entry
 * of either kind whose name holds a `/`, which `git fsck` refuses as
 * `fullPathname` and which would spell a path the walk never takes.
 * `unshard` reads the key off any split of its digits, and a read of that
 * key walks the one path `toPath` spells, so a listing that named it would
 * name content the same snapshot cannot read; it refuses the layout
 * instead.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly string[]}
 */
const misfiled = rel => e => {
    const name = nameText(e.name)
    const path = `${prefix}${join(rel, name)}`
    if (name.includes('/')) { return [path] }
    if (isSubtree(e)) { return [] }
    const key = unshard(join(rel, name))
    return key === null || toPath(key) === path ? [] : [path]
}

/**
 * The subtree an entry names, as the next item of the listing's walk, or
 * none where the entry is a file.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly { readonly id: Oid, readonly rel: string }[]}
 */
const subtreeOf = rel => e => isSubtree(e) ? [{ id: e.oid, rel: join(rel, nameText(e.name)) }] : []

/** Whether an entry has `name`. @type {(name: Bytes) => (e: TreeEntry) => boolean} */
const named = name => e => sameItems(e.name)(name)

/**
 * The entries of the tree an id names, read through `read`, or refused where
 * the id names no tree or an object the repository does not hold. One
 * answer for the listing and the writers, so that all read a tree the same
 * way.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {(id: Oid) => Effect<O, readonly TreeEntry[], IoChannel>}
 */
const treeEntries = (read, oidBytes) => {
    const entriesAt = tryEntries(read, oidBytes)
    return id => step(present(entriesAt(id)), es => es === null ? refuseEntry(`${hexText(id)} is no tree`) : pureOk(es))
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
 * The CAS map the tree `tree` holds, as its keyed entries: the `.cas` subtree
 * walked, every file below it a key with the blob it names and every subtree
 * walked in turn, flat in the tree's size as `walkStep` keeps a walk. No
 * blob is read. The empty map for a `null` tree and for a tree with no
 * `.cas`; a `.cas` that is no subtree is refused.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {OidBytes} oidBytes
 * @returns {(tree: Nullable<Oid>) => Effect<O, readonly _Keyed[], IoChannel>}
 */
const keyedEntries = (read, oidBytes) => {
    const entryAt = tryEntry(read, oidBytes)
    const entriesOf = treeEntries(read, oidBytes)
    /**
     * One subtree of the walk: its files' entries added, its subtrees walked
     * next. A key filed where `toPath` does not file it ({@link misfiled})
     * refuses the walk. The entries gather as a list whose `concat` is one
     * node per tree, flattened once at the end, so a walk over many trees
     * copies nothing it gathered before.
     *
     * @type {(item: { readonly id: Oid, readonly rel: string }) => (keyed: List<_Keyed>) => Effect<O, readonly [List<_Keyed>, readonly { readonly id: Oid, readonly rel: string }[]], IoChannel>}
     */
    const walk = ({ id, rel }) => keyed => step(entriesOf(id), es => {
        const stray = es.flatMap(misfiled(rel))
        return stray.length !== 0
            ? refuseEntry(`${stray[0]} is no path of the layout`)
            : pureOk([concat(keyed)(es.flatMap(keyedOf(rel))), es.flatMap(subtreeOf(rel))])
    })
    return tree => {
        if (tree === null) { return pureOk([]) }
        // Three links: the `.cas` entry, the walk below it, the list
        // flattened. No `.cas` is the empty map; one that is no subtree is
        // refused; and `toArray` of the empty list is `[]`.
        const cas = step(present(entryAt(tree, casDir)), e => {
            if (e === null) { return pureOk(null) }
            return isSubtree(e) ? pureOk(e.oid) : refuseEntry(`${prefix} has mode ${nameText(e.mode)}`)
        })
        const walked = step(cas, id => id === null
            ? pureOk(/** @type {List<_Keyed>} */ (null))
            : walkStep(pureOk([{ id, rel: '' }]), /** @type {List<_Keyed>} */ (null), walk))
        return mapStep(walked, toArray)
    }
}

/**
 * The CAS map the tree `tree` holds, read through `read`, a store's reader
 * at the repository's id width; `null` is the empty map, which is what a
 * branch nobody has published has.
 *
 * `read` of a key walks `.cas/ab/cd/<rest>` to the entry and streams the
 * blob it names; a path the tree does not take it down is the ordinary
 * miss. `list` is {@link keyedEntries}' keys. Neither reads an object it
 * need not: a listing reads trees and no blob.
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
    const keyed = keyedEntries(read, oidBytes)
    /**
     * The blob a key's entry names, streamed: refused where the entry is no
     * regular file or its object no blob, since either holds something that is
     * not the key's content.
     *
     * @type {(e: TreeEntry) => EffectList<O, Vec, IoChannel>}
     */
    const blobOf = e => {
        if (mode(e) !== regularFile) {
            return refuseEntry(`${nameText(e.name)} has mode ${nameText(e.mode)}`)
        }
        return step(present(read(e.oid)), o => o === null || o.type !== 'blob'
            ? refuseEntry(`${hexText(e.oid)} is no blob`)
            : fromList(chunksOf(o.payload)))
    }
    return tree => ({
        read: key => tree === null
            ? notFound(key)
            : step(present(entryAt(tree, components(key))), e => e === null ? notFound(key) : blobOf(e)),
        list: () => mapStep(keyed(tree), es => es.map(({ key }) => key)),
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
    const others = entries.filter(x => !named(e.name)(x))
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
        const looked = mapStep(entries, es => ({ es, found: es.find(named(name)) ?? null }))
        if (rest.length === 0) {
            return step(looked, ({ es, found }) => {
                if (found === null) { return rebuilt(es, { mode: fileMode, name, oid: blob }) }
                return mode(found) === regularFile && found.oid === blob
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

/** What {@link removed} answers where the tree held no such path. */
const same = /** @type {_Removal} */ (['same'])

/** What {@link removed} answers where the tree is empty without the path. */
const gone = /** @type {_Removal} */ (['gone'])

/**
 * The tree `tree` without the entry at `path`, written: every tree along
 * the path rebuilt and stored, and a tree left with no entries taken out of
 * the tree above it rather than written empty, so a cleared `.cas/ab/cd`
 * leaves no empty subtree behind, as `git rm` leaves none. `same` where
 * the tree does not hold the path — a path through a file is a path it does
 * not hold — `gone` where the root itself is empty without it, which the
 * caller writes as the empty tree, and the rebuilt root otherwise.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(type: ObjectType, payload: Bytes) => Effect<ProposalOperation, Oid, IoChannel>} write
 * @param {OidBytes} oidBytes
 * @returns {(tree: Oid, path: readonly (readonly number[])[]) => Effect<O | ProposalOperation, _Removal, IoChannel>}
 */
const removed = (read, write, oidBytes) => {
    const entriesOf = treeEntries(read, oidBytes)
    const bytesOf = writeTree(oidBytes)
    /** @type {(entries: readonly TreeEntry[]) => Effect<ProposalOperation, _Removal, IoChannel>} */
    const rebuilt = entries => entries.length === 0
        ? pureOk(gone)
        : mapStep(write('tree', bytesOf(entries)), id => /** @type {_Removal} */ (['tree', id]))
    /** @type {(tree: Oid, path: readonly (readonly number[])[]) => Effect<O | ProposalOperation, _Removal, IoChannel>} */
    const go = (tree, [name, ...rest]) => {
        const looked = mapStep(entriesOf(tree), es => ({ es, found: es.find(named(name)) ?? null }))
        if (rest.length === 0) {
            return step(looked, ({ es, found }) => found === null ? pureOk(same) : rebuilt(es.filter(x => !named(name)(x))))
        }
        const below = historyStep(history(looked), ({ found }) =>
            found === null || !isSubtree(found) ? pureOk(same) : go(found.oid, rest))
        return step(below, ([r, { es }]) => {
            if (r[0] === 'same') { return pureOk(r) }
            return r[0] === 'gone'
                ? rebuilt(es.filter(x => !named(name)(x)))
                : rebuilt(withEntry(es, { mode: subtreeMode, name, oid: r[1] }))
        })
    }
    return go
}

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
 * A commit of this backend's: `tree`, the `parents` given — none for a
 * root, one for an addition or a deletion, two for a reconciliation —
 * `author` and `committer` the one ident at `ms`, the `now` effect's
 * milliseconds as the seconds Git counts, in `+0000`, and `message`.
 *
 * @throws As the ident writer throws, on a name or an email holding `<`, `>`
 * or a line feed.
 *
 * @type {(author: Author, tree: Oid, parents: readonly Oid[], message: string, ms: number) => Bytes}
 */
const commitOf = (author, tree, parents, message, ms) => {
    const who = writeIdent({
        name: stringToU8List(author.name),
        email: stringToU8List(author.email),
        time: BigInt(Math.floor(ms / 1_000)),
        tz: '+0000',
    })
    return writePayload({
        headers: [
            [ascii('tree'), toHex(tree)],
            ...parents.map(p => /** @type {const} */ ([ascii('parent'), toHex(p)])),
            [ascii('author'), who],
            [ascii('committer'), who],
        ],
        message: ascii(`${message}\n`),
    })
}

/**
 * What the writers of a branch share once the repository is open: the
 * reader, the id width, the object writer, the tree surgery and a commit
 * writer, bound to the branch's directory and author.
 *
 * @param {Branch} branch
 * @param {Author} author
 * @param {{ readonly oidBytes: OidBytes, readonly read: Read<SnapshotOperation>, readonly dirs: Dirs }} o
 */
const writers = (branch, author, o) => {
    const { oidBytes, read } = o
    const write = writeObject(branch.dir, oidBytes)
    /**
     * A commit of `tree` on `parents` with `message`, written, at the time it
     * is written.
     *
     * @type {(tree: Oid, parents: readonly Oid[], message: string) => Effect<ProposalOperation, Oid, IoChannel>}
     */
    const commit = (tree, parents, message) => step(now(), ms => write('commit', commitOf(author, tree, parents, message, ms)))
    /** The empty tree, written: what a root with nothing left in it is. */
    const emptyTree = write('tree', writeTree(oidBytes)([]))
    /**
     * A removal as the tree it leaves: `gone` written as the empty tree, and
     * `same` as `null`, nothing to commit.
     *
     * @type {(r: _Removal) => Effect<ProposalOperation, Nullable<Oid>, IoChannel>}
     */
    const left = r => r[0] === 'same' ? pureOk(null) : r[0] === 'gone' ? emptyTree : pureOk(r[1])
    return {
        write,
        commit,
        left,
        place: placed(read, write, oidBytes),
        take: removed(read, write, oidBytes),
        keyed: keyedEntries(read, oidBytes),
        treeOf: treeOfCommit(read, oidBytes, proposalRef(branch)),
        at: casAt(read, oidBytes),
    }
}

/**
 * The proposal of `branch`, by `author`, as a `Cas<O>` keyed by `sha2`'s
 * hash as `fileCas(sha2)` is, with `remove` and `clear` beside it. Its
 * `read` and `list` see the proposal's tree — the published snapshot plus
 * what this repository has added — and its `write` adds content: the blob
 * as a loose object, the trees above it rebuilt, and one commit on
 * {@link proposalRef} with the proposal so far as its parent, or the
 * published snapshot's commit where no proposal has been started, or no
 * parent where the branch has nothing yet. Content already in the tree
 * under its key is written as no object and no commit: the key is answered
 * and the proposal stands. `remove` takes one key out and `clear` the whole
 * `.cas`, each as one deletion commit the same way, answering whether there
 * was anything to take out.
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
 * @returns {Effect<ProposalOperation, Proposal<ProposalOperation>, IoChannel>}
 */
export const proposal = (sha2, branch, author) => {
    const named = historyStep(history(refName(proposalRef(branch))), () => refName(snapshotRef(branch)))
    const o = historyStep(named, () => opened(branch.dir))
    return mapStep(o, ([open, published, name]) => {
        const { oidBytes, dirs } = open
        const { write, commit, left, place, take, treeOf, at } = writers(branch, author, open)
        const resolve = tryResolve(dirs, oidBytes)
        const writeRef = tryWrite(dirs, oidBytes)(name)
        /**
         * The commit the proposal stands at: the proposal ref, or the
         * published snapshot where none has been started, or none.
         */
        const head = step(resolve(name), c => c === null ? resolve(published) : pureOk(c))
        /** That commit's tree, or `null` for the empty one. */
        const tree = step(head, c => c === null ? pureOk(null) : treeOf(c))
        /**
         * One commit of `tree` on the proposal's head with `message`, and the
         * ref moved to it.
         *
         * @type {(tree: Oid, head: Nullable<Oid>, message: string) => Effect<ProposalOperation, void, IoChannel>}
         */
        const advanced = (tree, head, message) => step(commit(tree, head === null ? [] : [head], message), writeRef)
        /**
         * Seven links, one per line and in the order they run: the payload
         * gathered, its blob written, the proposal's head and tree read, the
         * tree rebuilt around the blob, and the commit written and the ref
         * moved to it — or neither, where the tree stood.
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
            return step(root, ([newTree, , c, , { key }]) => newTree === null
                ? pureOk(key)
                : mapStep(advanced(newTree, c, `cas: add ${vecToCBase32(key)}`), () => key))
        }
        /**
         * A path taken out of the proposal's tree as one deletion commit:
         * `true` where there was something to take out.
         *
         * @type {(path: readonly (readonly number[])[], message: string) => Effect<ProposalOperation, boolean, IoChannel>}
         */
        const taken = (path, message) => {
            const base = history(head)
            const baseTree = historyStep(base, c => c === null ? pureOk(null) : treeOf(c))
            const root = historyStep(baseTree, t => t === null ? pureOk(same) : take(t, path))
            const kept = historyStep(root, left)
            return step(kept, ([newTree, , , c]) => newTree === null
                ? pureOk(false)
                : mapStep(advanced(newTree, c, message), () => true))
        }
        return {
            read: key => step(tree, t => at(t).read(key)),
            list: () => step(tree, t => at(t).list()),
            write: add,
            remove: key => taken(components(key), `cas: remove ${vecToCBase32(key)}`),
            clear: () => taken(casDir, 'cas: clear'),
        }
    })
}

/**
 * The changes `ours` makes to the map relative to `base`: a key in `ours`
 * and not in `base` is an addition, one in `base` and not in `ours` a
 * deletion, and one in both names the same blob or is refused as the
 * collision it would be. By exact path, with no notion of a rename: similar
 * content at two keys is two entries, which is what disables rename
 * inference for this map.
 *
 * @type {(base: readonly _Keyed[], ours: readonly _Keyed[]) => Result<readonly _Change[], IoChannel>}
 */
const changesOf = (base, ours) => {
    /** @type {(es: readonly _Keyed[]) => ReadonlyMap<string, Oid>} */
    const mapOf = es => new Map(es.map(({ key, oid }) => [vecToCBase32(key), oid]))
    const b = mapOf(base)
    const o = mapOf(ours)
    const collided = ours.find(({ key, oid }) => {
        const was = b.get(vecToCBase32(key))
        return was !== undefined && was !== oid
    })
    if (collided !== undefined) {
        return error(ioError({ code: casEntryCode, message: `${vecToCBase32(collided.key)} names two blobs` }))
    }
    return ok([
        ...ours.flatMap(e => b.has(vecToCBase32(e.key)) ? [] : [/** @type {_Change} */ (['add', e])]),
        ...base.flatMap(({ key }) => o.has(vecToCBase32(key)) ? [] : [/** @type {_Change} */ (['delete', key])]),
    ])
}

/**
 * The attempts of a publication, one after another: see {@link publish}.
 *
 * @template {Operation} O
 * @param {Remote<O>} remote
 * @param {Branch} branch
 * @param {Author} author
 * @param {{ readonly oidBytes: OidBytes, readonly read: Read<SnapshotOperation>, readonly dirs: Dirs }} open
 * @param {Bytes} name
 * @param {Bytes} published
 * @returns {Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>}
 */
const attempted = (remote, branch, author, open, name, published) => {
    const { oidBytes, dirs } = open
    const { commit, left, place, take, keyed, treeOf } = writers(branch, author, open)
    const resolve = tryResolve(dirs, oidBytes)
    const writeRef = tryWrite(dirs, oidBytes)
    const deleteRef = tryDelete(dirs, oidBytes)
    /**
     * The proposal `p` reconciled with the fetched `c` through their merge
     * base: `p`'s changes since the base applied to `c`'s tree, as one commit
     * with both as parents — or `null` where nothing is left to add, every
     * change of `p` being in `c` already.
     *
     * @type {(c: Oid, p: Oid, base: Nullable<Oid>) => Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>}
     */
    const reconciled = (c, p, base) => {
        const trees = history(treeOf(c))
        const ours = historyStep(trees, () => treeOf(p))
        const baseKeyed = historyStep(ours, () => base === null ? pureOk([]) : step(treeOf(base), keyed))
        const ourKeyed = historyStep(baseKeyed, (_b, tp) => keyed(tp))
        const changes = historyStep(ourKeyed, (o, b) => pure(changesOf(b, o)))
        const applied = historyStep(changes, (cs, _o, _b, _tp, tc) => foldStep(
            pureOk(cs),
            /** @type {Oid} */ (tc),
            change => tree => change[0] === 'add'
                ? mapStep(place(tree, components(change[1].key), change[1].oid), t => t ?? tree)
                : step(take(tree, components(change[1])), r => mapStep(left(r), t => t ?? tree))))
        return step(applied, ([tree, cs, , , , tc]) => tree === tc
            ? pureOk(null)
            : commit(tree, [c, p], `cas: reconcile ${cs.length} changes`))
    }
    /**
     * One attempt, the `n`th: six links in the order they run — the remote
     * fetched, the proposal read, their merge base asked, the candidate
     * chosen, pushed — and what the push's answer calls for.
     *
     * @type {(n: number) => Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>}
     */
    const attempt = n => {
        const fetched = history(remote.fetch())
        const proposed = historyStep(fetched, () => resolve(name))
        const based = historyStep(proposed, (p, c) => p === null || c === null || p === c ? pureOk(null) : remote.mergeBase(p, c))
        const candidate = historyStep(based, (b, p, c) => {
            if (p === null || p === c) { return pureOk(null) }
            return c === null || b === c ? pureOk(p) : reconciled(c, p, b)
        })
        const pushed = historyStep(candidate, cand => cand === null ? pureOk(false) : remote.push(cand))
        return step(pushed, ([landed, cand, , , c]) => {
            if (cand === null) { return mapStep(deleteRef(name), () => c) }
            if (landed) {
                const noted = step(writeRef(published)(cand), () => deleteRef(name))
                return mapStep(noted, () => cand)
            }
            if (n === maxAttempts) {
                return refuse(publishAttemptsCode)(`${proposalRef(branch)} was not published in ${maxAttempts} attempts`)
            }
            return step(writeRef(name)(cand), () => attempt(n + 1))
        })
    }
    return attempt(1)
}

/**
 * Publishes the proposal of `branch` to the remote branch through `remote`,
 * and answers the commit the published snapshot is at afterwards — `null`
 * where the remote has no branch and there was nothing to publish.
 *
 * Each attempt: fetch, so the snapshot is the remote's; read the proposal,
 * and with none, or one the snapshot already is, there is nothing to do but
 * drop the proposal ref; otherwise push the proposal where it descends from
 * the snapshot — the ordinary case, a fast-forward — and where it does not,
 * reconcile the two through their merge base and push the merge commit. A
 * push that lands moves the snapshot ref to it and drops the proposal ref:
 * the proposal is published and the next write starts from the snapshot. A
 * push the remote refuses, because the branch moved since the fetch, makes
 * the merge commit the proposal — its ancestry kept — and the next attempt
 * fetches and reconciles again, up to {@link maxAttempts}.
 *
 * Reconciliation is by exact path, as the todo requires: the proposal's
 * additions and deletions since the merge base are applied to the fetched
 * tree, and every entry the proposal did not change is as the remote has
 * it. So an entry the remote deleted stays deleted unless the proposal
 * added it after the base; an entry both added is one entry; an entry the
 * proposal deleted that the remote left is gone; two roots with no base
 * reconcile over the empty map; and a proposal whose every change the
 * remote already holds publishes nothing and is dropped. Nothing is ever
 * force-pushed.
 *
 * @template {Operation} O
 * @param {Remote<O>} remote
 * @param {Branch} branch
 * @param {Author} author
 * @returns {Effect<O | ProposalOperation, Nullable<Oid>, IoChannel>}
 */
export const publish = (remote, branch, author) => {
    const named = historyStep(history(refName(proposalRef(branch))), () => refName(snapshotRef(branch)))
    const o = historyStep(named, () => opened(branch.dir))
    return step(o, ([open, published, name]) => attempted(remote, branch, author, open, name, published))
}

/**
 * `s` as one argument of a shell command, or `null` where no quoting makes
 * it one on both shells `exec` may hand the command to. Double quotes are
 * what `sh` and `cmd.exe` agree on: inside them a space, `&`, `|`, `<`, `>`
 * and `^` are literal on both. What they do not agree on is refused rather
 * than escaped one shell's way: `"` and `%` and `!`, which `cmd.exe` cannot
 * escape inside quotes; `$` and a backquote, which `sh` expands inside them;
 * a line feed or carriage return, which ends a command; and a backslash
 * doubled or last, which `sh` reads as an escape inside quotes where
 * `cmd.exe` reads a path separator. A single backslash before any other
 * character is literal to both, so a Windows path quotes as it is.
 *
 * @type {(s: string) => Nullable<string>}
 */
const quoted = s =>
    [...s].some(c => '"%!$`\n\r'.includes(c)) || s.includes('\\\\') || s.endsWith('\\') ? null : `"${s}"`

/**
 * The first object id a line of `git` output spells, or refused as
 * {@link gitOutputCode}: `ls-remote` prints `<id> TAB <ref>` and
 * `merge-base` prints `<id>`, and anything else is not what was asked.
 *
 * @type {(text: string) => Result<Oid, IoChannel>}
 */
const idIn = text => {
    const end = [...text].findIndex(c => c === '\t' || c === '\n' || c === '\r' || c === ' ')
    const token = end === -1 ? text : text.slice(0, end)
    const id = tryFromHex(stringToU8List(token))
    return id === null ? error(ioError({ code: gitOutputCode, message: `no object id in ${JSON.stringify(text)}` })) : ok(id)
}

/**
 * How `exec` reports a command that exited non-zero: Node's `Command
 * failed: <command>\n<stderr>`, with the exit code in a field the error
 * channel does not carry. What the command said is therefore read off the
 * message, and a command that said nothing — `merge-base` with no base —
 * is the message with nothing after the command.
 *
 * @type {(command: string, e: IoChannel) => Nullable<string>}
 */
const stderrOf = (command, e) => {
    const head = `Command failed: ${command}\n`
    return e[0] === 'ioError' && e[1].message.startsWith(head) ? e[1].message.slice(head.length) : null
}

/**
 * The remote of `branch` over the `git` command line: the three operations
 * that leave the repository, each one `git` run through `exec`, and the
 * merge base, which `git` answers in an instant. This is the one place a
 * `git` runs, and `exec` hands the command to a shell, so every argument
 * goes through {@link quoted} and the remote refuses, as
 * {@link shellArgumentCode}, a directory, remote or branch name no quoting
 * makes safe.
 *
 * - `fetch` asks `git ls-remote <remote> refs/heads/<branch>` whether the
 *   branch is there — nothing printed means it is not, and the snapshot ref
 *   is deleted so a stale one does not stand for a branch that is gone —
 *   and fetches it with the one refspec that updates the snapshot ref
 *   whatever the repository was cloned with, then reads that ref.
 * - `push` offers the commit as `<id>:refs/heads/<branch>`, with no force
 *   of any kind; a refusal `git` reports as `[rejected]` with
 *   `non-fast-forward` or `fetch first` is `false`, and any other failure
 *   is the error it is.
 * - `mergeBase` is `git merge-base`, whose exit 1 with nothing said is no
 *   base at all.
 *
 * @type {(branch: Branch) => Remote<GitRemoteOperation>}
 */
export const gitRemote = branch => {
    const { dir, remote, branch: b } = branch
    const [qdir, qremote, qref, qrefspec] = [dir, remote, `refs/heads/${b}`, `+refs/heads/${b}:${snapshotRef(branch)}`].map(quoted)
    /** The quoted arguments, or `null` where one of them has no quoting. */
    const args = qdir !== null && qremote !== null && qref !== null && qrefspec !== null
        ? { dir: qdir, remote: qremote, ref: qref, refspec: qrefspec }
        : null
    /**
     * A `git` command over the quoted arguments, or the refusal every
     * operation shares where one of them could not be quoted.
     *
     * @type {(words: (a: { readonly remote: string, readonly ref: string, readonly refspec: string }) => readonly string[]) => Effect<never, string, IoChannel>}
     */
    const command = words => args === null
        ? refuse(shellArgumentCode)(`${JSON.stringify([dir, remote, b])} cannot be quoted for a shell`)
        : pureOk(['git', `--git-dir=${args.dir}`, ...words(args)].join(' '))
    /**
     * A command run, answering what it printed, or, where it failed, what
     * `forgive` makes of what `git` said on `stderr` — one value, or none,
     * and then the failure is the error it is. `stderr` is `null` where
     * `exec` reported something other than a non-zero exit.
     *
     * @template T
     * @param {Effect<never, string, IoChannel>} cmd
     * @param {(stdout: string) => Result<T, IoChannel>} answer
     * @param {(stderr: Nullable<string>) => readonly T[]} forgive
     * @returns {Effect<GitRemoteOperation, T, IoChannel>}
     */
    const ran = (cmd, answer, forgive) => step(cmd, c => resultStep(exec(c), r => {
        if (r[0] === 'ok') { return pure(answer(r[1].stdout)) }
        const forgiven = forgive(stderrOf(c, r[1]))
        return forgiven.length === 0 ? pureError(r[1]) : pureOk(forgiven[0])
    }))
    /** @type {(stderr: Nullable<string>) => readonly never[]} */
    const never = () => []
    return {
        fetch: () => {
            const listed = ran(command(a => ['ls-remote', a.remote, a.ref]), stdout => ok(stdout.trim() === '' ? null : stdout), never)
            const o = historyStep(history(listed), () => opened(dir))
            return step(o, ([{ oidBytes, dirs }, line]) => {
                const name = stringToU8List(snapshotRef(branch))
                if (line === null) {
                    return mapStep(tryDelete(dirs, oidBytes)(name), () => null)
                }
                const fetched = ran(command(a => ['fetch', a.remote, a.refspec]), () => ok(undefined), never)
                return step(fetched, () => tryResolve(dirs, oidBytes)(name))
            })
        },
        push: commit => ran(
            command(a => ['push', a.remote, `${hexText(commit)}:refs/heads/${b}`]),
            () => ok(true),
            stderr => stderr !== null && stderr.includes('[rejected]') && (stderr.includes('non-fast-forward') || stderr.includes('fetch first'))
                ? [false]
                : []),
        mergeBase: (a, c) => ran(
            command(() => ['merge-base', hexText(a), hexText(c)]),
            idIn,
            stderr => stderr === '' ? [null] : []),
    }
}
