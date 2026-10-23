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
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import { errorMessage, history, historyStep, ioError, pureError, pureOk, refuse, resultMapStep, step, walkStep } from '../../effects/module.f.mjs'
import { fromList } from '../../effects/list/module.f.mjs'
import { isNotFound } from '../../effects/node/module.f.mjs'
import { tryTreeAt } from '../../git/commit/module.f.mjs'
import { oidBytes as widthOf } from '../../git/format/module.f.mjs'
import { hexText } from '../../git/oid/module.f.mjs'
import { isWholeName } from '../../git/refname/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { isSubtree, mode } from '../../git/tree/module.f.mjs'
import { tryEntries, tryEntry } from '../../git/walk/module.f.mjs'
import { join } from '../../path/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { maxLengthBytes, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
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
 * writer never writes another.
 */
const regularFile = 0o100644

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
const keyOf = rel => e => isSubtree(e) ? [] : toOption(unshard(join(rel, nameText(e.name))))

/**
 * The subtree an entry names, as the next item of the listing's walk, or
 * none where the entry is a file.
 *
 * @type {(rel: string) => (e: TreeEntry) => readonly { readonly id: Oid, readonly rel: string }[]}
 */
const subtreeOf = rel => e => isSubtree(e) ? [{ id: e.oid, rel: join(rel, nameText(e.name)) }] : []

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
    const entriesAt = tryEntries(read, oidBytes)
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
    /**
     * One subtree of the listing's walk: its files' keys added, its subtrees
     * walked next. An object below `.cas` that is no tree refuses the listing
     * rather than shortening it.
     *
     * @type {(item: { readonly id: Oid, readonly rel: string }) => (keys: readonly Vec[]) => Effect<O, readonly [readonly Vec[], readonly { readonly id: Oid, readonly rel: string }[]], IoChannel>}
     */
    const listStep = ({ id, rel }) => keys => step(present(entriesAt(id)), es => es === null
        ? refuseEntry(`${hexText(id)} is no tree`)
        : pureOk([[...keys, ...es.flatMap(keyOf(rel))], es.flatMap(subtreeOf(rel))]))
    return tree => ({
        read: key => tree === null
            ? notFound(key)
            : step(present(entryAt(tree, components(key))), e => e === null ? notFound(key) : blobOf(e)),
        list: () => tree === null
            ? pureOk([])
            : step(present(entryAt(tree, casDir)), e => {
                if (e === null) { return pureOk([]) }
                if (!isSubtree(e)) { return refuseEntry(`${prefix} has mode ${nameText(e.mode)}`) }
                return walkStep(pureOk([{ id: e.oid, rel: '' }]), /** @type {readonly Vec[]} */ ([]), listStep)
            }),
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
    const head = historyStep(dirs, (_ods, w) => tryResolve({ gitdir: dir, common: dir }, w)(name))
    return step(head, ([commit, ods, w]) => {
        const read = readIn(ods, w)
        const at = casAt(read, w)
        if (commit === null) { return pureOk(at(null)) }
        return step(present(read(commit)), o => {
            const tree = o === null || o.type !== 'commit' ? null : tryTreeAt(w)(o.payload)
            return tree === null
                ? refuse(snapshotHeadCode)(`${snapshotRef(branch)} names ${hexText(commit)}, which is no commit`)
                : pureOk(at(tree))
        })
    })
}
