/**
 * CAS content in a Git branch: a branch read as the CAS map its tree holds,
 * and written to as Git writes a file.
 *
 * A branch's tree is a map from canonical CAS paths to immutable content —
 * `.cas/ab/cd/<rest>` for a key, the layout [`fjs/cas`](../module.f.mjs)'s
 * `toPath` spells and `unshard` reads back — so a commit of the branch *is*
 * a CAS snapshot. {@link snapshot} is one read through the existing
 * `Cas<O>` surface, pinned at the commit the branch is at when it is
 * opened: `read` streams the blob a key's path names and `list` walks the
 * `.cas` tree for every key. {@link branchCas} is the whole `Cas<O>` over
 * the branch as it moves: `read` and `list` of the commit the branch is at
 * when each runs, and `write`, which stores the blob and the trees above it
 * as loose objects in the repository's own `objects/` and moves the branch
 * to one new commit — or stores nothing where the key is already there.
 * Either sees the branch and nothing else: content in another branch, in
 * Git history or in the local object database is not in the map. Moving a
 * branch between repositories is `git push` and `git fetch`, and joining
 * two writers' branches is `git merge`, as for any branch; this backend
 * syncs nothing
 * ([`todo/git-branch-storage.md`](../todo/git-branch-storage.md)).
 *
 * Everything here is native over [`fjs/git`](../../git/README.md): the
 * repository's id width from its `config`, the refs through the ref store
 * and its writer, the objects through the object store and the walk, the
 * trees and commits through their writers, the loose file through
 * [`fjs/zlib/stored`](../../zlib/stored/module.f.mjs). No `git` runs.
 *
 * What a read refuses rather than answers, each a repository that is not
 * what this backend writes: a `config` Git does not open, a branch ref
 * naming anything but a commit, and at a CAS path an entry that is no
 * regular file or an object that is no blob, and an object the branch names
 * that the repository does not hold — {@link casEntryCode}. A key the
 * branch does not hold is the ordinary miss, `ENOENT` as `fileCas` reports
 * one, and a branch that is not there is the empty map. A write refuses the
 * same shapes where it meets them, and one more: a key already in the tree
 * over other bytes, which is a hash collision or a corrupt store and never
 * a write to make.
 *
 * Two limits, each recorded as a todo beside this module: a payload is held
 * in memory while its object is written, since a loose object's envelope
 * states the size before the bytes
 * ([`todo/streaming-writes.md`](./todo/streaming-writes.md)); and two
 * writers of one repository moving the branch at once can lose one
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
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { Bytes, ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Envelope } from '../../git/object/types.ts'
 * @import { Entry } from '../../git/config/types.ts'
 * @import { Dirs } from '../../git/refstore/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Cas } from '../types.ts'
 * @import { Author, Branch, CasReader, SnapshotOperation, WriteOperation } from './types.ts'
 */

import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { ascii } from '../../ebnf/byte/module.f.mjs'
import {
    catchStep, errorMessage, foldStep, history, historyStep, ioError, mapStep, pureError, pureOk, refuse, resultMapStep, resultStep, step, walkStep,
} from '../../effects/module.f.mjs'
import { fromList } from '../../effects/list/module.f.mjs'
import { isNotFound, mkdir, namesNothing, now, readUtf8File, rename, rm, writeExclusive } from '../../effects/node/module.f.mjs'
import { tryTreeAt } from '../../git/commit/module.f.mjs'
import { lastValue, tryEntries as configEntries } from '../../git/config/module.f.js'
import { oidBytes as widthOf } from '../../git/format/module.f.mjs'
import { write as writePayload } from '../../git/header/module.f.mjs'
import { write as writeIdent } from '../../git/ident/module.f.mjs'
import { tryRead as readLoose } from '../../git/loose/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of, toHex } from '../../git/oid/module.f.mjs'
import { isWholeName } from '../../git/refname/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { tryWrite } from '../../git/refstore/write/module.f.mjs'
import { objectPath, objectsDir, objectsDirs, readIn } from '../../git/store/module.f.mjs'
import { compare, tryRead as readTree, validate, write as writeTree } from '../../git/tree/module.f.mjs'
import { join, parent, under } from '../../path/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { stringToU8List } from '../../text/utf8/module.f.mjs'
import { isWholeBytes, maxLengthBytes, u8ListMsb, u8ListToVecChunksMsb } from '../../types/bit_vec/module.f.mjs'
import { concat, flat, map, sameItems, toArray } from '../../types/list/module.f.mjs'
import { toOption } from '../../types/nullable/module.f.js'
import { error } from '../../types/result/module.f.js'
import { stored } from '../../zlib/stored/module.f.mjs'
import { prefix, random256, toPath, unshard } from '../module.f.mjs'

/**
 * The ref a branch is read at: `refs/heads/<branch>`, the local branch
 * itself, as `git log <branch>` reads it. Whether the branch is checked
 * out anywhere is beside the point: the ref is read, never a worktree.
 *
 * @type {(branch: Branch) => string}
 */
export const branchRef = ({ branch }) => `refs/heads/${branch}`

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

/**
 * The code the configured author is refused with: a `user.name` or
 * `user.email` an author's ident cannot hold — one with `<`, `>` or a line
 * break, which `git commit` strips and goes on; this backend does not
 * guess at the name meant — or a `config` whose author may sit behind an
 * `[include]` or `[includeIf]` this backend does not follow, where
 * answering from the file alone could name an author Git would not.
 */
export const authorCode = /** @type {const} */ ('ERR_AUTHOR')

/** Refuses with {@link casEntryCode}. */
const refuseEntry = refuse(casEntryCode)

/** Refuses with {@link snapshotHeadCode}. */
const refuseHead = refuse(snapshotHeadCode)

/** Refuses with {@link repositoryFormatCode}. */
const refuseFormat = refuse(repositoryFormatCode)

/** Refuses with {@link authorCode}. */
const refuseAuthor = refuse(authorCode)

/**
 * Whether a value is one no ident can carry as an author's name or email:
 * empty or blank, which `git commit` refuses as an empty ident and which
 * would otherwise sign a commit as nobody or as `<>`; or holding `<`, `>`
 * or a line feed, the delimiters of an identification line, which the
 * ident writer throws on and `git commit` silently strips; or a NUL, which
 * no header holds and `git fsck` refuses as `nulInHeader`.
 *
 * @type {(value: string) => boolean}
 */
const noIdent = value => value.trim() === '' || ['<', '>', '\n', '\0'].some(c => value.includes(c))

/**
 * An object read from the store, with a store that has no such object
 * refused as {@link casEntryCode} rather than passed on. The store reports
 * a missing object as the host's word for nothing at the path — `ENOENT`,
 * or the `ENOTDIR` and `ELOOP` of a path through a file or a cycle of
 * links, which `namesNothing` gathers as the store itself does — and
 * `ENOENT` is the code a key the snapshot does not hold is reported with
 * too, so the two must not read alike: a repository missing an object its
 * snapshot names — a partial clone, a corrupt store — would otherwise
 * answer "not in the snapshot" for a key that is. The walk itself never
 * answers `ENOENT`; a path the tree does not take is `null`.
 *
 * @template {Operation} O
 * @template T
 * @param {Effect<O, T, IoChannel>} e
 * @returns {Effect<O, T, IoChannel>}
 */
const present = e => resultMapStep(e, r => r[0] === 'error' && namesNothing(r[1])
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
 * What is wrong with a tree as a tree, in a few words, or nothing: what
 * `git fsck` refuses in any tree, as [`fjs/git/tree`](../../git/tree/module.f.mjs)'s
 * `validate` vouches for it — a name held twice, which a walk answers no
 * one entry for; a name holding `/`, which spells a path no walk reaches;
 * entries out of the order Git writes, which a writer rebuilding the tree
 * would keep; an id of all zero bytes; a mode zero-padded or none of Git's
 * five; an empty, `.`, `..`, `.git` or over-long name. Every walk here
 * refuses a tree holding any wherever it meets one, so no tree Git
 * refuses is read as a map, and none is rebuilt into a commit of this
 * backend's.
 *
 * @type {(es: readonly TreeEntry[]) => readonly string[]}
 */
const illFormed = es => {
    const r = validate(es)
    return r[0] === 'ok' ? [] : [`is no tree Git writes: ${r[1]}`]
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

/** Whether an entry has `name`. @type {(name: Bytes) => (e: TreeEntry) => boolean} */
const named = name => e => sameItems(e.name)(name)

/**
 * The entry of `name` among a tree's entries, or `null`, beside the
 * entries, checked as a walk checks a tree before taking it: the root,
 * where `rel` is `null`, for being {@link illFormed}, and a tree below
 * `.cas` for the layout ({@link malformed}). A writer rebuilding a tree
 * that fails either would carry the fault into a commit of its own, which
 * the listing then refuses, so the write refuses first.
 *
 * @type {(name: readonly number[], rel: Nullable<string>) => (es: readonly TreeEntry[]) => Effect<never, { readonly es: readonly TreeEntry[], readonly found: Nullable<TreeEntry> }, IoChannel>}
 */
const onlyNamed = (name, rel) => es => {
    const wrong = rel === null ? illFormed(es) : malformed(rel)(es)
    if (wrong.length !== 0) { return refuseEntry(rel === null ? `the root tree ${wrong[0]}` : wrong[0]) }
    const found = es.find(x => sameItems(x.name)(name))
    return pureOk({ es, found: found === undefined ? null : found })
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
 * The blob a key's entry names, streamed, given its object as read: refused
 * where the object is no blob, which holds something that is not the key's
 * content. The entry's mode was the walk's to check, in the tree it came
 * from.
 *
 * @template {Operation} O
 * @param {TreeEntry} e
 * @param {Nullable<Envelope>} o
 * @returns {EffectList<O, Vec, IoChannel>}
 */
const blobOf = (e, o) => o === null || o.type !== 'blob'
    ? refuseEntry(`${hexText(e.oid)} is no blob`)
    : fromList(chunksOf(o.payload))

/**
 * The CAS map the tree `tree` holds, read through `read`, a store's reader
 * at the repository's id width; `null` is the empty map, which is what a
 * branch nobody has written to has.
 *
 * `read` of a key walks `.cas/ab/cd/<rest>` to the entry ({@link walkTo})
 * and streams the blob it names; a path the tree does not take it down is
 * the ordinary miss. `list` walks the `.cas` subtree, every file below it a
 * key and every subtree walked in turn, flat in the tree's size as
 * `walkStep` keeps a walk. Neither reads an object it need not: a listing
 * reads trees and no blob, so it names a key by the tree's word and the
 * read of that key is where the blob is asked for — an object the
 * repository does not hold, or one that is no blob, is refused then, as
 * `fileCas` lists a shard without opening it. Both check every tree they
 * read for the layout before taking it, so what one lists the other walks
 * to, and a tree this backend did not write is refused rather than read as
 * a map it is not.
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
        read: key => {
            if (tree === null) { return notFound(key) }
            // Two links: the entry the key's path names, and its object. A
            // subtree at the key's path is no object to read: the listing
            // walks it as a tree and refuses what it names, so the read
            // refuses the entry rather than streaming the blob a `40000`
            // entry may wrongly name.
            const entry = history(entryAt(tree, components(key)))
            const object = historyStep(entry, e => e === null || isDirectory(e) ? pureOk(null) : present(read(e.oid)))
            return step(object, ([o, e]) => e === null
                ? notFound(key)
                : isDirectory(e) ? refuseEntry(`${toPath(key)} has mode ${nameText(e.mode)}`) : blobOf(e, o))
        },
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
 * What every operation on a branch resolves first, once rather than per
 * key: the repository's id width, its object directories and a reader over
 * them, and the two directories its refs live in — one directory twice,
 * since the backend's refs are shared refs and no worktree's own.
 *
 * @type {(dir: string) => Effect<SnapshotOperation, { readonly oidBytes: OidBytes, readonly read: Read<SnapshotOperation>, readonly dirs: Dirs }, IoChannel>}
 */
const opened = dir => {
    const width = step(widthOf(dir), w => w === null
        ? refuseFormat(`${dir} is not a repository Git opens`)
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
 * The snapshot of `branch`: the CAS map at the commit its {@link branchRef}
 * names, pinned there, or the empty map where the ref is not there — a
 * branch nobody has created yet.
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
    const ref = branchRef(branch)
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
 * @type {(dir: string, oidBytes: OidBytes) => (type: ObjectType, payload: Bytes) => Effect<WriteOperation, Oid, IoChannel>}
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
 * deep as a store. Every tree on the way is checked as the read's walk
 * checks it ({@link onlyNamed}) before it is rebuilt, so a write never
 * commits a tree the listing would refuse.
 *
 * @template {Operation} O
 * @param {Read<O>} read
 * @param {(type: ObjectType, payload: Bytes) => Effect<WriteOperation, Oid, IoChannel>} write
 * @param {OidBytes} oidBytes
 * @returns {(tree: Nullable<Oid>, path: readonly (readonly number[])[], blob: Oid) => Effect<O | WriteOperation, Nullable<Oid>, IoChannel>}
 */
const placed = (read, write, oidBytes) => {
    const entriesOf = treeEntries(read, oidBytes)
    const bytesOf = writeTree(oidBytes)
    /** @type {(entries: readonly TreeEntry[], e: TreeEntry) => Effect<WriteOperation, Nullable<Oid>, IoChannel>} */
    const rebuilt = (entries, e) => write('tree', bytesOf(withEntry(entries, e)))
    /** @type {(tree: Nullable<Oid>, path: readonly (readonly number[])[], blob: Oid, rel: Nullable<string>) => Effect<O | WriteOperation, Nullable<Oid>, IoChannel>} */
    const go = (tree, [name, ...rest], blob, rel) => {
        const entries = tree === null ? pureOk(/** @type {readonly TreeEntry[]} */ ([])) : entriesOf(tree)
        const looked = step(entries, onlyNamed(name, rel))
        if (rest.length === 0) {
            return step(looked, ({ es, found }) => {
                if (found === null) { return rebuilt(es, { mode: fileMode, name, oid: blob }) }
                return isRegularFile(found) && found.oid === blob
                    ? pureOk(null)
                    : refuseEntry(`${nameText(name)} already holds ${hexText(found.oid)}`)
            })
        }
        const under = rel === null ? '' : join(rel, nameText(name))
        const below = historyStep(history(looked), ({ found }) => {
            if (found === null) { return go(null, rest, blob, under) }
            return isDirectory(found) ? go(found.oid, rest, blob, under) : refuseEntry(`${nameText(name)} is no subtree`)
        })
        return step(below, ([sub, { es }]) => sub === null ? pureOk(null) : rebuilt(es, { mode: subtreeMode, name, oid: sub }))
    }
    return (tree, path, blob) => go(tree, path, blob, null)
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
 * A commit of this backend's: `tree`, the `parents` given — none for a
 * root, one for an addition or a deletion, two for a reconciliation —
 * `author` and `committer` the one ident at `ms`, the `now` effect's
 * milliseconds as the seconds Git counts, in `+0000`, and `message`.
 *
 * `author` holds no `<`, `>`, line feed or NUL: {@link branchCas} refuses one
 * that does before anything is written.
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
 * The CAS in `branch`, keyed by `sha2`'s hash as `fileCas(sha2)` is. `read`
 * and `list` see the commit the branch is at when each runs, so a `read`
 * after a `write` sees the write; {@link snapshot} is the pinned view.
 * `write` adds content as Git adds a file: the blob as a loose object in
 * the repository's own `objects/`, the `.cas` trees above it rebuilt in the
 * order Git requires, and one commit on {@link branchRef} whose parent is
 * the commit the branch was at, or none where the branch did not exist.
 * Content already in the tree under its key writes no object and no
 * commit: the key is answered and the branch stands. Every commit is by
 * `author`, as `author` and `committer` both, at the `now` effect's time;
 * an author whose name or email is empty or holds `<`, `>`, a line feed or
 * a NUL, which no ident can carry, is refused as {@link authorCode} before
 * anything is opened or written.
 *
 * The source checkout is not touched: the writes are below `objects/` and
 * at the branch ref, and nowhere else — not `HEAD`, not the index, not a
 * file of the worktree. The branch is a store; a checkout of it, if there
 * is one, sees its ref move as `git fetch` moves one.
 *
 * @param {Sha2} sha2
 * @param {Branch} branch
 * @param {Author} author
 * @returns {Effect<WriteOperation, Cas<WriteOperation>, IoChannel>}
 */
export const branchCas = (sha2, branch, author) => {
    if (noIdent(author.name) || noIdent(author.email)) {
        return refuseAuthor(`the author's name or email is empty or holds "<", ">", a line break or a NUL: ${author.name} <${author.email}>`)
    }
    const ref = branchRef(branch)
    const named = history(refName(ref))
    const o = historyStep(named, () => opened(branch.dir))
    return mapStep(o, ([{ oidBytes, read, dirs }, name]) => {
        const write = writeObject(branch.dir, oidBytes)
        const idOf = of(oidBytes)
        const at = casAt(read, oidBytes)
        const place = placed(read, write, oidBytes)
        const treeOf = treeOfCommit(read, oidBytes, ref)
        const writeRef = tryWrite(dirs, oidBytes)(name)
        /** The commit the branch is at, or none. */
        const head = tryResolve(dirs, oidBytes)(name)
        /** That commit's tree, or `null` for the empty one. */
        const tree = step(head, c => c === null ? pureOk(null) : treeOf(c))
        /** The bytes of a blob, from the chunks gathered: what is hashed for its id and written. @type {(chunks: readonly Vec[]) => Bytes} */
        const bytesOf = chunks => flat(map(u8ListMsb)(chunks))
        /**
         * One commit of `tree` on `parent` with `message`, at the time it is
         * written, and the ref moved to it.
         *
         * @type {(tree: Oid, parent: Nullable<Oid>, message: string) => Effect<WriteOperation, void, IoChannel>}
         */
        const advanced = (tree, parent, message) => {
            const commit = step(now(), ms => write('commit', commitOf(author, tree, parent === null ? [] : [parent], message, ms)))
            return step(commit, writeRef)
        }
        /**
         * Six links, one per line and in the order they run: the payload
         * gathered, the branch's head and tree read, the tree rebuilt around
         * the blob's id, the blob written where the tree changed, and the
         * commit written and the ref moved to it — or none of the last two,
         * where the tree stood. The tree decides before the blob is stored,
         * so content already under its key writes nothing, even where its
         * blob sits in a pack or a borrowed directory and no loose file of it
         * is there to find.
         *
         * @template {Operation} O1
         * @param {EffectList<O1, Vec, IoChannel>} payload
         * @returns {Effect<O1 | WriteOperation, Vec, IoChannel>}
         */
        const add = payload => {
            const got = history(gathered(sha2, payload))
            const base = historyStep(got, () => head)
            const baseTree = historyStep(base, c => c === null ? pureOk(null) : treeOf(c))
            const root = historyStep(baseTree, (t, _c, { key, chunks }) => place(t, components(key), idOf('blob', bytesOf(chunks))))
            const blob = historyStep(root, (newTree, _t, _c, { chunks }) => newTree === null ? pureOk(null) : write('blob', bytesOf(chunks)))
            return step(blob, ([, newTree, , c, { key }]) => newTree === null
                ? pureOk(key)
                : mapStep(advanced(newTree, c, `cas: add ${vecToCBase32(key)}`), () => key))
        }
        return {
            read: key => step(tree, t => at(t).read(key)),
            list: () => step(tree, t => at(t).list()),
            write: add,
        }
    })
}

/**
 * The entries of a Git `config` file at `path`, none where there is no such
 * file, and refused as {@link repositoryFormatCode} where there is one Git
 * does not read.
 *
 * @type {(path: string) => Effect<ReadFile, readonly Entry[], IoChannel>}
 */
const configAt = path => {
    const read = catchStep(readUtf8File(path), e => isNotFound(e) ? pureOk('') : pureError(e))
    return step(read, text => {
        const entries = configEntries(text)
        return entries === null ? refuseFormat(`${path} is not a config Git reads`) : pureOk(entries)
    })
}

/**
 * Whether a `config` holds an `[include]` or `[includeIf …]` section, whose
 * file this backend does not read.
 *
 * @type {(entries: readonly Entry[]) => boolean}
 */
const includes = entries => entries.some(([section]) => section === 'include' || section.startsWith('includeif.'))

/**
 * Who a repository's commits are by, as `git commit` decides it from
 * configuration: `user.name` and `user.email` of the repository's own
 * `config`, each falling back to `<home>/.gitconfig`, or `null` where
 * either is set in neither. The `GIT_AUTHOR_*` environment is not read —
 * configuration and parameters over environment variables
 * ([DESIGN.md §7](../../../doc/DESIGN.md#7-cli-parameters-over-environment-variables))
 * — and neither are the system and XDG configuration files; a repository
 * whose author is set only there sets it in one of these two. A value an
 * ident cannot hold — `A <B>`, which `git commit` would strip the brackets
 * from — is refused as {@link authorCode}, naming the setting, rather than
 * carried to the ident writer that throws on it; so is a setting that is
 * set and empty, or blank, which `git commit` refuses as an empty ident
 * and which would otherwise sign a commit as nobody.
 *
 * `[include]` and `[includeIf]` are not followed: an included file may set
 * or override `user.*`, so a file holding either directive is refused as
 * {@link authorCode} where its answer would count — the repository's
 * `config` always, `~/.gitconfig` where the repository's does not name
 * both settings — rather than read as if the include were not there.
 *
 * @type {(dir: string, home: string) => Effect<ReadFile, Nullable<Author>, IoChannel>}
 */
export const configuredAuthor = (dir, home) => {
    const localPath = under(dir, 'config')
    const globalPath = under(home, '.gitconfig')
    const local = history(configAt(localPath))
    const global = historyStep(local, () => configAt(globalPath))
    return step(global, ([g, l]) => {
        /** @type {(key: string) => Nullable<string>} */
        const value = key => lastValue(l, 'user', key) ?? lastValue(g, 'user', key)
        const name = value('name')
        const email = value('email')
        const localOnly = lastValue(l, 'user', 'name') !== null && lastValue(l, 'user', 'email') !== null
        const included = includes(l) ? localPath : !localOnly && includes(g) ? globalPath : null
        if (included !== null) {
            return refuseAuthor(`${included} has an [include] or [includeIf], which is not followed here; set user.name and user.email in it directly`)
        }
        if (name === null || email === null) { return pureOk(null) }
        /** @type {readonly (readonly [string, string])[]} */
        const values = [['name', name], ['email', email]]
        const bad = values.find(([, v]) => noIdent(v))
        return bad === undefined
            ? pureOk({ name, email })
            : refuseAuthor(`user.${bad[0]} is empty or holds "<", ">", a line break or a NUL; set it in ${dir}/config or ${home}/.gitconfig`)
    })
}
