/**
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../../git/object/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { EffectList } from '../../effects/list/types.ts'
 * @import { Dirs } from '../../git/refstore/types.ts'
 * @import { Author, Branch, CasReader, SnapshotOperation, WriteOperation } from './types.ts'
 * @import { Cas } from '../types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { ioError, pureError, pureOk, runPure } from '../../effects/module.f.mjs'
import { empty, nonEmpty } from '../../effects/list/module.f.mjs'
import { isNotFound } from '../../effects/node/module.f.mjs'
import { virtual, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { author as authorOf, parents, tryRead as readCommit } from '../../git/commit/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of } from '../../git/oid/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { objectPath, objectsDir, readIn, tryRead as readObject } from '../../git/store/module.f.mjs'
import { initConfig, initSha256Config, latin1 } from '../../git/testlib.f.mjs'
import { compare, write as writeTree } from '../../git/tree/module.f.mjs'
import { length, maxLength, msb, u8ListToVecMsb, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { storedBytes } from '../../zlib/testlib.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { collectRead, toPath } from '../module.f.mjs'
import { _driveCas } from '../proof.f.mjs'
import { authorCode, branchCas, branchRef, casAt, casEntryCode, configuredAuthor, repositoryFormatCode, snapshot, snapshotHeadCode, writeObject } from './module.f.mjs'

/** The repository every case reads, and the branch the snapshot is of. */
const dir = /** @type {const} */ ('repo')

/** @type {Branch} */
const branch = { dir, branch: 'build-cache' }

/** Where the branch ref is, as a path in the virtual filesystem. */
const refPath = `${dir}/refs/heads/build-cache`

/** @type {(s: string) => readonly Vec[]} */
const text = s => [u8ListToVecMsb(latin1(s))]

/** The CAS key of some bytes: SHA-256 over them, as `fileCas(sha256)` keys content. @type {(bytes: readonly number[]) => Vec} */
const keyOf = bytes => computeSync(sha256)([u8ListToVecMsb(bytes)])

/** Two contents, one text and one binary with a NUL and a byte above `0x7F`. */
const alpha = latin1('alpha\n')

const beta = [0x00, 0xff, 0x80, 0x7f]

const alphaKey = keyOf(alpha)

const betaKey = keyOf(beta)

/** The path components a key is stored under, `.cas` first. @type {(key: Vec) => readonly string[]} */
const pathOf = key => toPath(key).split('/')

/** @type {(mode: string, name: string, oid: Oid) => TreeEntry} */
const entry = (mode, name, oid) => ({ mode: latin1(mode), name: latin1(name), oid })

/**
 * A nested directory with `content` at `path`, built over `d`: the shape the
 * virtual filesystem is given, from the flat paths the fixtures spell.
 *
 * @type {(d: Dir, path: readonly string[], content: readonly Vec[] | Dir) => Dir}
 */
const setIn = (d, [first, ...rest], content) => {
    if (rest.length === 0) { return { ...d, [first]: content } }
    const sub = d[first]
    const below = sub !== undefined && typeof sub === 'object' && !(sub instanceof Array) ? sub : {}
    return { ...d, [first]: setIn(below, rest, content) }
}

/**
 * A repository's filesystem from flat paths, over the one directory every
 * repository has and these fixtures never fill: `objects/pack/`, which the
 * object store lists for packs and `git init` creates empty. The virtual
 * filesystem reports a listing of a directory that is not there as a
 * failure, and the store takes a failure on the packed side as the refusal
 * it would be on a host, so a repository without it reads nothing.
 *
 * @type {(files: readonly (readonly [string, readonly Vec[]])[]) => Dir}
 */
const fs = files => files.reduce(
    (d, [path, content]) => setIn(d, path.split('/'), content),
    /** @type {Dir} */ ({ [dir]: { objects: { pack: {} } } }))

/**
 * The writers of a repository at one id width: an object as the loose file
 * Git stores it in — one zlib stream of stored blocks over the envelope — a
 * tree from the files below it, every subtree an object too, and a commit
 * over a tree.
 *
 * @param {OidBytes} oidBytes
 */
const writers = oidBytes => {
    const idOf = of(oidBytes)
    const write = writeTree(oidBytes)
    /** @type {(type: ObjectType, payload: readonly number[]) => readonly [string, readonly Vec[]]} */
    const object = (type, payload) =>
        [objectPath(dir)(idOf(type, payload)), [u8ListToVecMsb(storedBytes(toArray(writeEnvelope(type, payload))))]]
    /**
     * @type {(files: readonly (readonly [readonly string[], Oid])[]) => { readonly id: Oid, readonly objects: readonly (readonly [string, readonly Vec[]])[] }}
     */
    const tree = files => {
        const names = [...new Set(files.map(([p]) => p[0]))].toSorted()
        const parts = names.map(name => {
            const below = files.filter(([p]) => p[0] === name)
            const [[path, oid]] = below
            if (path.length === 1) { return { entry: entry('100644', name, oid), objects: [] } }
            const sub = tree(below.map(([p, o]) => /** @type {const} */ ([p.slice(1), o])))
            return { entry: entry('40000', name, sub.id), objects: sub.objects }
        })
        const payload = toArray(write(parts.map(p => p.entry)))
        return { id: idOf('tree', payload), objects: [...parts.flatMap(p => p.objects), object('tree', payload)] }
    }
    /** @type {(entries: readonly TreeEntry[]) => { readonly id: Oid, readonly object: readonly [string, readonly Vec[]] }} */
    const treeOf = entries => {
        const payload = toArray(write(entries))
        return { id: idOf('tree', payload), object: object('tree', payload) }
    }
    /** @type {(treeId: Oid) => readonly number[]} */
    const commit = treeId =>
        latin1([`tree ${hexText(treeId)}`, 'author A <a@b> 1 +0000', 'committer A <a@b> 1 +0000', '', 'cas', ''].join('\n'))
    return { idOf, object, tree, treeOf, commit }
}

/**
 * A repository as files: its `config`, the branch ref at `head`, and the
 * objects given. No ref where `head` is `null`.
 *
 * @type {(config: string, head: Oid | null, objects: readonly (readonly [string, readonly Vec[]])[]) => Dir}
 */
const repository = (config, head, objects) => fs([
    [`${dir}/config`, text(config)],
    ...head === null ? [] : [/** @type {const} */ ([refPath, text(`${hexText(head)}\n`)])],
    ...objects,
])

/**
 * The ordinary repository at a width: a commit over a tree holding a
 * `README` and the two contents at their CAS paths.
 *
 * @type {(oidBytes: OidBytes, config: string) => Dir}
 */
const ordinary = (oidBytes, config) => {
    const { idOf, object, tree, commit } = writers(oidBytes)
    const readme = latin1('# cache\n')
    const root = tree([
        [['README'], idOf('blob', readme)],
        [pathOf(alphaKey), idOf('blob', alpha)],
        [pathOf(betaKey), idOf('blob', beta)],
    ])
    const c = commit(root.id)
    return repository(config, idOf('commit', c), [
        object('blob', readme),
        object('blob', alpha),
        object('blob', beta),
        ...root.objects,
        object('commit', c),
    ])
}

const sha1 = writers(20)

/**
 * A SHA-1 repository whose commit is over `root`, a tree the case builds by
 * hand, plus the objects it names.
 *
 * @type {(root: readonly TreeEntry[], objects: readonly (readonly [string, readonly Vec[]])[]) => Dir}
 */
const over = (root, objects) => {
    const t = sha1.treeOf(root)
    const c = sha1.commit(t.id)
    return repository(initConfig, sha1.idOf('commit', c), [t.object, sha1.object('commit', c), ...objects])
}

/** The `.cas/ab/cd/<rest>` entries one key spells over `oid`, as a hand-built root. @type {(key: Vec, mode: string, oid: Oid) => { readonly root: readonly TreeEntry[], readonly objects: readonly (readonly [string, readonly Vec[]])[] }} */
const casEntry = (key, mode, oid) => {
    const [, ab, cd, rest] = pathOf(key)
    const leaf = sha1.treeOf([entry(mode, rest, oid)])
    const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
    const cas = sha1.treeOf([entry('40000', ab, mid.id)])
    return { root: [entry('40000', '.cas', cas.id)], objects: [leaf.object, mid.object, cas.object] }
}

/** Opens the snapshot of `branch` over `root`: the filesystem it left and the reader. @type {(root: Dir) => readonly [State, Result<CasReader<SnapshotOperation>, IoChannel>]} */
const opened = root => virtualAt(root)(snapshot(branch))

/** @type {(root: Dir) => readonly [State, CasReader<SnapshotOperation>]} */
const reader = root => {
    const [state, r] = opened(root)
    return [state, assertOk(r)]
}

/** @type {(root: Dir, key: Vec) => Result<Vec, IoChannel>} */
const readAll = (root, key) => {
    const [state, r] = reader(root)
    return virtual(state)(collectRead(r.read(key)))[1]
}

/** @type {(root: Dir) => Result<readonly Vec[], IoChannel>} */
const listed = root => {
    const [state, r] = reader(root)
    return virtual(state)(r.list())[1]
}

/** Keys as their cBase32 text, sorted, so two listings compare. @type {(keys: readonly Vec[]) => readonly string[]} */
const spelled = keys => keys.map(vecToCBase32).toSorted()

/** The code a refusal carries. @type {(r: Result<unknown, IoChannel>) => string | undefined} */
const codeOf = r => {
    const e = assertError(r)
    assert(e[0] === 'ioError', e)
    return e[1].code
}

/** @type {(root: Dir, key: Vec, bytes: readonly number[]) => void} */
const assertReads = (root, key, bytes) => {
    const v = assertOk(readAll(root, key))
    assertEq(msb.cmp(v)(u8ListToVecMsb(bytes)), 0, ['read back other bytes', vecToCBase32(key)])
}

// ## Writing
//
// What the write side's fixtures add: a checkout beside the repository — a
// `HEAD`, an index and a worktree file — which a write must leave as it found
// them, and the author every commit of the branch is by.

/** @type {Author} */
const author = { name: 'Cas Writer', email: 'cas@example.com' }

/** A repository with a checkout beside it: `HEAD` on `master`, an index, and a worktree file. @type {(root: Dir) => Dir} */
const checkedOut = root => ({
    ...root,
    [dir]: { ...root[dir], HEAD: text('ref: refs/heads/master\n'), index: [u8ListToVecMsb([0x44, 0x49, 0x52, 0x43])] },
    src: { 'README.md': text('# source\n') },
})

/** Content none of the fixtures hold, in one chunk and in two. */
const gamma = latin1('gamma\n')

const gammaKey = keyOf(gamma)

/** @type {(chunks: readonly (readonly number[])[]) => EffectList<never, Vec, IoChannel>} */
const payload = chunks => chunks.reduceRight(
    (tail, chunk) => nonEmpty(u8ListToVecMsb(chunk), tail),
    /** @satisfies {EffectList<never, Vec, IoChannel>} */ (empty()))

/** Opens the writable CAS of `branch` over `root`: the filesystem it left and the store. @type {(root: Dir) => readonly [State, Cas<WriteOperation>]} */
const writable = root => {
    const [state, r] = virtualAt(root)(branchCas(sha256, branch, author))
    return [state, assertOk(r)]
}

/** Writes `chunks` through `cas` over `state`: the filesystem after and the key. @type {(state: State, cas: Cas<WriteOperation>, chunks: readonly (readonly number[])[]) => readonly [State, Result<Vec, IoChannel>]} */
const wrote = (state, cas, chunks) => virtual(state)(cas.write(payload(chunks)))

/** The two directories of the fixture repository, as the ref store takes them. @type {Dirs} */
const dirs = { gitdir: dir, common: dir }

/** The id a ref holds over `state`, or `null`. @type {(state: State, name: string) => Oid | null} */
const refAt = (state, name) => assertOk(virtual(state)(tryResolve(dirs, 20)(latin1(name)))[1])

/** The id the branch ref holds over `state`, or `null`. @type {(state: State) => Oid | null} */
const branchHead = state => refAt(state, branchRef(branch))

/** The commit an id names over `state`, read. @type {(state: State, id: Oid) => { readonly parents: readonly Oid[], readonly author: string }} */
const commitAt = (state, id) => {
    const o = assertNotNullish(assertOk(virtual(state)(readObject(dir, 20)(id))[1]))
    assertEq(o.type, 'commit')
    const c = assertNotNullish(readCommit(o.payload))
    const who = authorOf(c)
    return { parents: parents(c), author: `${nameOf(who.name)} <${nameOf(who.email)}> ${who.time} ${who.tz}` }
}

/** Bytes as the text they spell, for an ident's fields. @type {(bytes: readonly number[] | import('../../git/types.ts').Bytes) => string} */
const nameOf = bytes => String.fromCharCode(...toArray(bytes))

/**
 * Everything of `root` a write may not touch, structurally the same in
 * `after`: the checkout's `HEAD`, index and worktree, the repository's
 * `config` and every ref but the branch's. Only `objects/` and the branch
 * ref may differ, and no temporary object file is left behind.
 *
 * @type {(before: Dir, after: Dir) => void}
 */
const assertUntouched = (before, after) => {
    const strip = (/** @type {Dir} */ d) => {
        const repo = d[dir]
        assert(repo !== undefined && typeof repo === 'object' && !(repo instanceof Array))
        const { objects, refs, ...rest } = repo
        // A repository with no ref at all has no `refs/` yet; a write makes it.
        const held = refs !== undefined && typeof refs === 'object' && !(refs instanceof Array) ? refs : {}
        const { heads, ...otherRefs } = held
        const { 'build-cache': _, ...otherHeads } = heads !== undefined && typeof heads === 'object' && !(heads instanceof Array) ? heads : {}
        return { ...d, [dir]: { ...rest, refs: { ...otherRefs, heads: otherHeads } } }
    }
    assertStructurallySame(strip(after), strip(before))
    const objects = assertNotNullish(after[dir])
    assert(typeof objects === 'object' && !(objects instanceof Array))
    const od = objects.objects
    assert(od !== undefined && typeof od === 'object' && !(od instanceof Array))
    assert(Object.keys(od).every(n => !n.startsWith('tmp_obj_')), Object.keys(od))
}

/**
 * A SHA-1 CAS holding `bytes` under its key, as objects in memory: the root
 * tree's id and every object by its hex id, for a reader that is no store.
 *
 * @type {(bytes: readonly number[]) => { readonly root: Oid, readonly held: ReadonlyMap<string, Envelope> }}
 */
const inMemory = bytes => {
    const { idOf } = sha1
    const blobId = idOf('blob', bytes)
    const [, ab, cd, rest] = pathOf(alphaKey)
    const leaf = toArray(writeTree(20)([entry('100644', rest, blobId)]))
    const mid = toArray(writeTree(20)([entry('40000', cd, idOf('tree', leaf))]))
    const cas = toArray(writeTree(20)([entry('40000', ab, idOf('tree', mid))]))
    const root = toArray(writeTree(20)([entry('40000', '.cas', idOf('tree', cas))]))
    return {
        root: idOf('tree', root),
        held: new Map([
            [hexText(blobId), { type: 'blob', payload: bytes }],
            [hexText(idOf('tree', leaf)), { type: 'tree', payload: leaf }],
            [hexText(idOf('tree', mid)), { type: 'tree', payload: mid }],
            [hexText(idOf('tree', cas)), { type: 'tree', payload: cas }],
            [hexText(idOf('tree', root)), { type: 'tree', payload: root }],
        ]),
    }
}

/**
 * The ordinary repository behaves as a store: both contents read back byte
 * for byte, the binary one included, and the listing is exactly the two
 * keys — the `README` beside `.cas` is no key and is not listed.
 *
 * @type {(root: Dir) => void}
 */
const assertOrdinary = root => {
    assertReads(root, alphaKey, alpha)
    assertReads(root, betaKey, beta)
    assertStructurallySame(spelled(assertOk(listed(root))), spelled([alphaKey, betaKey]))
}

export const proof = {
    // ## The branch ref
    branchRef: () => {
        assertEq(branchRef(branch), 'refs/heads/build-cache')
        assertEq(branchRef({ dir, branch: 'feature/x' }), 'refs/heads/feature/x')
    },
    // ## Reading a snapshot
    //
    // A SHA-1 repository and a SHA-256 one, each built from the objects Git
    // would store — the id width is read off `config`, and every object id,
    // tree entry and loose file follows it.
    readsAndLists: () => {
        assertOrdinary(ordinary(20, initConfig))
    },
    sha256Repository: () => {
        assertOrdinary(ordinary(32, initSha256Config))
    },
    // A key the snapshot does not hold is the miss `fileCas` reports: `ENOENT`,
    // so `isNotFound` tells it from every refusal below.
    missingKey: () => {
        const r = readAll(ordinary(20, initConfig), keyOf(latin1('gamma\n')))
        assert(isNotFound(assertError(r)), r)
    },
    // No branch at all — one nobody has created yet — is the empty map:
    // every key a miss, and no key listed.
    noRef: () => {
        const root = repository(initConfig, null, [])
        assert(isNotFound(assertError(readAll(root, alphaKey))))
        assertStructurallySame(assertOk(listed(root)), [])
    },
    // A ref file that names no commit — junk where an id should be, or a
    // symbolic ref to nothing — is not the absent branch `tryResolve` folds
    // it into: a read refuses it rather than opening the empty map, and a
    // write refuses it rather than writing a root commit over it, with the
    // file left as it was.
    malformedRef: () => {
        for (const bytes of ['junk\n', 'ref: refs/heads/nowhere\n']) {
            const root = fs([[`${dir}/config`, text(initConfig)], [refPath, text(bytes)]])
            assertEq(codeOf(opened(root)[1]), snapshotHeadCode, bytes)
            const [s0, cas] = writable(root)
            assertEq(codeOf(virtual(s0)(cas.list())[1]), snapshotHeadCode, bytes)
            const [s1, w] = wrote(s0, cas, [gamma])
            assertEq(codeOf(w), snapshotHeadCode, bytes)
            assertStructurallySame(s1.root, root)
        }
    },
    // A commit with no `.cas` in its tree is the empty map too: nothing has
    // been stored on this branch yet, though the branch itself exists.
    noCasTree: () => {
        const readme = latin1('# cache\n')
        const root = over([entry('100644', 'README', sha1.idOf('blob', readme))], [sha1.object('blob', readme)])
        assert(isNotFound(assertError(readAll(root, alphaKey))))
        assertStructurallySame(assertOk(listed(root)), [])
    },
    // ## Refusals
    //
    // A branch whose name is no ref name is refused before any file is opened,
    // which `runPure` finishing is the proof of: the effect never reached a
    // command.
    badBranchName: () => {
        const o = runPure(snapshot({ dir, branch: 'a..b' }))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), snapshotHeadCode)
    },
    // A `config` Git does not open — a repository format version it does not
    // know — gives no id width, and so no object can be read.
    badConfig: () => {
        const root = repository('[core]\n\trepositoryformatversion = 99\n', null, [])
        assertEq(codeOf(opened(root)[1]), repositoryFormatCode)
    },
    // The branch ref names what is no commit: a blob, bytes that are no
    // object at all, or a commit whose `tree` header is no id. A branch ref Git
    // wrote names a commit, so each is a repository this backend did not write.
    refNamesNoCommit: () => {
        const { idOf, object } = sha1
        const blobRoot = repository(initConfig, idOf('blob', alpha), [object('blob', alpha)])
        assertEq(codeOf(opened(blobRoot)[1]), snapshotHeadCode)
        const junk = latin1('junk')
        const junkId = idOf('blob', junk)
        const junkRoot = repository(initConfig, junkId, [[objectPath(dir)(junkId), [u8ListToVecMsb(storedBytes(junk))]]])
        assertEq(codeOf(opened(junkRoot)[1]), snapshotHeadCode)
        const treeless = latin1(['tree zz', 'author A <a@b> 1 +0000', 'committer A <a@b> 1 +0000', '', 'm', ''].join('\n'))
        const treelessRoot = repository(initConfig, idOf('commit', treeless), [object('commit', treeless)])
        assertEq(codeOf(opened(treelessRoot)[1]), snapshotHeadCode)
    },
    // The ref names a commit the repository does not hold: the store's "no
    // such object" is a missing object and not an empty snapshot.
    refNamesMissingCommit: () => {
        const root = repository(initConfig, sha1.idOf('commit', sha1.commit(sha1.idOf('tree', []))), [])
        assertEq(codeOf(opened(root)[1]), casEntryCode)
    },
    // `.cas` is a file: the listing refuses it, since the map it would walk is
    // not there, and a read refuses it the same way rather than walking a
    // path through it to a miss.
    casIsFile: () => {
        const root = over([entry('100644', '.cas', sha1.idOf('blob', alpha))], [sha1.object('blob', alpha)])
        assertEq(codeOf(listed(root)), casEntryCode)
        assertEq(codeOf(readAll(root, alphaKey)), casEntryCode)
    },
    // A tree whose entries are out of the order Git writes — which `git
    // fsck` refuses as `treeNotSorted` — is refused by the listing and by a
    // read through it: a writer rebuilding it would write one Git refuses.
    unsortedTree: () => {
        const [, ab, cd, rest] = pathOf(alphaKey)
        const blob = sha1.idOf('blob', alpha)
        const leaf = sha1.treeOf([entry('100644', 'zz', blob), entry('100644', rest, blob)])
        const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
        const top = sha1.treeOf([entry('40000', ab, mid.id)])
        const root = over([entry('40000', '.cas', top.id)], [leaf.object, mid.object, top.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(root)), casEntryCode)
        assertEq(codeOf(readAll(root, alphaKey)), casEntryCode)
    },
    // An entry whose id is all zero bytes, which Git never writes and `git
    // fsck` refuses as `nullSha1`: refused by the listing rather than named
    // as a key, and by a read rather than asked of the store.
    nullId: () => {
        const [, ab, cd, rest] = pathOf(alphaKey)
        const leaf = sha1.treeOf([entry('100644', rest, u8ListToVecMsb(Array(20).fill(0)))])
        const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
        const top = sha1.treeOf([entry('40000', ab, mid.id)])
        const root = over([entry('40000', '.cas', top.id)], [leaf.object, mid.object, top.object])
        assertEq(codeOf(listed(root)), casEntryCode)
        assertEq(codeOf(readAll(root, alphaKey)), casEntryCode)
    },
    // The root tree, which the layout shares with the rest of the branch, is
    // checked as a tree and no more: a name it holds twice refuses a read
    // and the listing, where a `README.md` beside `.cas` is nobody's
    // business.
    rootIllFormed: () => {
        const readme = sha1.idOf('blob', alpha)
        const { root, objects } = casEntry(alphaKey, '100644', readme)
        const twice = over([...root, entry('100644', 'README.md', readme), entry('100644', 'README.md', readme)], [...objects, sha1.object('blob', alpha)])
        assertEq(codeOf(readAll(twice, alphaKey)), casEntryCode)
        assertEq(codeOf(listed(twice)), casEntryCode)
    },
    // A subtree spelled `040000` or `40755` — the same kind as `40000`, in a
    // spelling Git refuses — is refused by the listing and by a read through
    // it, as a file's spelling is.
    directoryMode: () => {
        for (const mode of ['040000', '40755']) {
            const [, ab, cd, rest] = pathOf(alphaKey)
            const leaf = sha1.treeOf([entry('100644', rest, sha1.idOf('blob', alpha))])
            const mid = sha1.treeOf([entry(mode, cd, leaf.id)])
            const top = sha1.treeOf([entry('40000', ab, mid.id)])
            const root = over([entry('40000', '.cas', top.id)], [leaf.object, mid.object, top.object, sha1.object('blob', alpha)])
            assertEq(codeOf(listed(root)), casEntryCode, mode)
            assertEq(codeOf(readAll(root, alphaKey)), casEntryCode, mode)
        }
    },
    // An entry at a key's path whose mode is not `100644`: an executable, a
    // symbolic link whose blob holds its target's path, and `100644` spelled
    // `0100644`, the same bits in a spelling Git refuses. Each is refused
    // rather than read as the key's content, and the listing refuses the
    // tree rather than naming a key the read would refuse.
    entryMode: () => {
        for (const mode of ['100755', '120000', '0100644']) {
            const { root, objects } = casEntry(alphaKey, mode, sha1.idOf('blob', alpha))
            const r = over(root, [...objects, sha1.object('blob', alpha)])
            assertEq(codeOf(readAll(r, alphaKey)), casEntryCode, mode)
            assertEq(codeOf(listed(r)), casEntryCode, mode)
        }
    },
    // A tree naming the key's file twice, which `git fsck` refuses as
    // `duplicateEntries`: the listing refuses it rather than naming the key
    // twice, and a read refuses it rather than choosing one of them.
    duplicateEntries: () => {
        const [, ab, cd, rest] = pathOf(alphaKey)
        const blob = sha1.idOf('blob', alpha)
        const leaf = sha1.treeOf([entry('100644', rest, blob), entry('100644', rest, blob)])
        const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
        const top = sha1.treeOf([entry('40000', ab, mid.id)])
        const root = over([entry('40000', '.cas', top.id)], [leaf.object, mid.object, top.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(root)), casEntryCode)
        assertEq(codeOf(readAll(root, alphaKey)), casEntryCode)
    },
    // A `100644` entry whose object is a tree, and one whose object is bytes
    // that are no object: neither is the key's content.
    entryNoBlob: () => {
        const t = sha1.treeOf([])
        const { root, objects } = casEntry(alphaKey, '100644', t.id)
        assertEq(codeOf(readAll(over(root, [...objects, t.object]), alphaKey)), casEntryCode)
        const junk = latin1('junk')
        const junkId = sha1.idOf('blob', junk)
        const j = casEntry(alphaKey, '100644', junkId)
        const junkRoot = over(j.root, [...j.objects, [objectPath(dir)(junkId), [u8ListToVecMsb(storedBytes(junk))]]])
        assertEq(codeOf(readAll(junkRoot, alphaKey)), casEntryCode)
    },
    // A `100644` entry whose blob the repository does not hold — a partial
    // clone, a corrupt store — is a missing object, refused, and not a key
    // that is not in the snapshot.
    entryMissing: () => {
        const { root, objects } = casEntry(alphaKey, '100644', sha1.idOf('blob', alpha))
        assertEq(codeOf(readAll(over(root, objects), alphaKey)), casEntryCode)
    },
    // A file below `.cas` whose name is no cBase32 — a `README.md` someone
    // put there, a name with a byte above `0x7F` — spells no key and is
    // skipped, as `fileCas` skips a file that is no shard. The keys around it
    // are listed. (`README` alone would not do: every letter of it is a
    // cBase32 digit, and it would list as a key no hash produced, which the
    // layout's inverse does not check and `fileCas` does not either.)
    strayFiles: () => {
        const readme = latin1('# cache\n')
        const readmeId = sha1.idOf('blob', readme)
        const [, ab, cd, rest] = pathOf(alphaKey)
        const leaf = sha1.treeOf([entry('100644', rest, sha1.idOf('blob', alpha))])
        const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
        const cas = sha1.treeOf([entry('100644', 'README.md', readmeId), entry('100644', '\xff', readmeId), entry('40000', ab, mid.id)].toSorted(compare))
        const root = over([entry('40000', '.cas', cas.id)], [leaf.object, mid.object, cas.object, sha1.object('blob', readme), sha1.object('blob', alpha)])
        assertStructurallySame(spelled(assertOk(listed(root))), spelled([alphaKey]))
    },
    // A key filed where `toPath` does not file it — `.cas/a/b/<rest>` and
    // `.cas/<whole>` for a key filed at `.cas/ab/cd/<rest>` — spells a key
    // `unshard` reads all the same, and a read of that key walks the one
    // canonical path and misses. The listing refuses the layout rather than
    // naming a key the snapshot cannot read.
    misfiled: () => {
        const s = vecToCBase32(alphaKey)
        const blob = sha1.idOf('blob', alpha)
        const leaf = sha1.treeOf([entry('100644', s.slice(2), blob)])
        const b = sha1.treeOf([entry('40000', s[1], leaf.id)])
        const split = sha1.treeOf([entry('40000', s[0], b.id)])
        const splitRoot = over([entry('40000', '.cas', split.id)], [leaf.object, b.object, split.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(splitRoot)), casEntryCode)
        assert(isNotFound(assertError(readAll(splitRoot, alphaKey))))
        const whole = sha1.treeOf([entry('100644', s, blob)])
        const wholeRoot = over([entry('40000', '.cas', whole.id)], [whole.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(wholeRoot)), casEntryCode)
        // An entry whose name holds a `/` — the canonical path as one tree
        // entry's name, which `git fsck` refuses — spells the canonical path
        // and is still no entry the walk reaches; refused, as a file and as a
        // subtree.
        const slashed = sha1.treeOf([entry('100644', toPath(alphaKey).slice('.cas/'.length), blob)])
        const slashedRoot = over([entry('40000', '.cas', slashed.id)], [slashed.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(slashedRoot)), casEntryCode)
        const [, ab, cd, rest] = pathOf(alphaKey)
        const deep = sha1.treeOf([entry('100644', rest, blob)])
        const slashedDir = sha1.treeOf([entry('40000', `${ab}/${cd}`, deep.id)])
        const slashedDirRoot = over([entry('40000', '.cas', slashedDir.id)], [deep.object, slashedDir.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(slashedDirRoot)), casEntryCode)
    },
    // A subtree below `.cas` whose object is bytes that are no tree, one
    // the repository does not hold, and one that is a blob: the listing is
    // refused rather than cut short at any of them, and a read down the
    // key's path is refused at the blob rather than answered as a miss.
    subtreeNoTree: () => {
        const junk = latin1('junk')
        const junkId = sha1.idOf('tree', junk)
        const cas = sha1.treeOf([entry('40000', 'zz', junkId)])
        const root = over([entry('40000', '.cas', cas.id)], [cas.object, [objectPath(dir)(junkId), [u8ListToVecMsb(storedBytes(junk))]]])
        assertEq(codeOf(listed(root)), casEntryCode)
        const gone = sha1.treeOf([entry('40000', 'zz', sha1.idOf('tree', []))])
        assertEq(codeOf(listed(over([entry('40000', '.cas', gone.id)], [gone.object]))), casEntryCode)
        const [, ab] = pathOf(alphaKey)
        const blobDir = sha1.treeOf([entry('40000', ab, sha1.idOf('blob', alpha))])
        const blobRoot = over([entry('40000', '.cas', blobDir.id)], [blobDir.object, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(blobRoot)), casEntryCode)
        assertEq(codeOf(readAll(blobRoot, alphaKey)), casEntryCode)
    },
    // A `40000` entry at the key's own path naming a blob: the listing walks
    // it as a subtree and refuses the blob as no tree, and a read refuses
    // the entry rather than streaming the blob it wrongly names — the one
    // mode `malformed` lets below `.cas` that is no file.
    leafIsDirectory: () => {
        const { root, objects } = casEntry(alphaKey, '40000', sha1.idOf('blob', alpha))
        const r = over(root, [...objects, sha1.object('blob', alpha)])
        assertEq(codeOf(listed(r)), casEntryCode)
        assertEq(codeOf(readAll(r, alphaKey)), casEntryCode)
    },
    // ## The map over any reader
    //
    // `casAt` takes the store's reader, so a blob longer than one `Vec` is
    // read through a reader that holds it in memory, with no file to inflate:
    // it streams as two cells, a full `Vec` and the rest, and then ends.
    bigBlob: () => {
        const big = Array.from({ length: Number(maxLength / 8n) + 1 }, (_, i) => i & 0xff)
        const { root, held } = inMemory(big)
        /** @type {Read<never>} */
        const read = id => pureOk(held.get(hexText(id)) ?? null)
        const stream = casAt(read, 20)(root).read(alphaKey)
        const o1 = runPure(stream)
        assert(o1.length === 1, o1)
        const c1 = assertOk(o1[0])
        assert(c1 !== undefined)
        assertEq(length(c1.first), maxLength)
        const o2 = runPure(c1.tail)
        assert(o2.length === 1, o2)
        const c2 = assertOk(o2[0])
        assert(c2 !== undefined)
        assertEq(length(c2.first), 8n)
        const o3 = runPure(c2.tail)
        assert(o3.length === 1, o3)
        assertEq(assertOk(o3[0]), undefined)
    },
    // A store whose read of the blob fails with the host's other words for
    // nothing at the path — `ENOTDIR`, a loose path through a file, and
    // `ELOOP`, a cycle of links — is a missing object, refused as the
    // `ENOENT` one is; a failure that says the file may well be there,
    // `EACCES`, is passed on as it is. Driven through an in-memory reader,
    // since the virtual filesystem answers `ENOENT` for all three
    // ([its todo](../../effects/node/virtual/todo/reads-enotdir-through-a-file.md)).
    entryUnreachable: () => {
        const { root, held } = inMemory(alpha)
        const blobId = sha1.idOf('blob', alpha)
        /** @type {(code: string) => Read<never>} */
        const failing = code => id => hexText(id) === hexText(blobId)
            ? pureError(ioError({ code, message: code }))
            : pureOk(held.get(hexText(id)) ?? null)
        for (const code of ['ENOTDIR', 'ELOOP']) {
            const o = runPure(casAt(failing(code), 20)(root).read(alphaKey))
            assert(o.length === 1, o)
            assertEq(codeOf(o[0]), casEntryCode, code)
        }
        const o = runPure(casAt(failing('EACCES'), 20)(root).read(alphaKey))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), 'EACCES')
    },
    // ## Writing
    //
    // A write into the ordinary repository: the key is the content's hash as
    // `fileCas` would key it, the store reads it back — in two chunks, so
    // the gathering is proved to keep every chunk — and lists it beside the
    // keys that were there, a snapshot opened afterwards sees it too, the
    // commit is a child of the commit the branch was at, by the author
    // given, and nothing of the
    // checkout, the `config` or any other ref has changed.
    writes: () => {
        const before = checkedOut(ordinary(20, initConfig))
        const [s0, cas] = writable(before)
        const was = assertNotNullish(branchHead(s0))
        const [s1, w] = wrote(s0, cas, [gamma.slice(0, 3), gamma.slice(3)])
        const key = assertOk(w)
        assertEq(msb.cmp(key)(gammaKey), 0, 'the key is not the content hash')
        const back = assertOk(virtual(s1)(collectRead(cas.read(key)))[1])
        assertEq(msb.cmp(back)(u8ListToVecMsb(gamma)), 0, 'read back other bytes')
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey]))
        assertStructurallySame(spelled(assertOk(listed(s1.root))), spelled([alphaKey, betaKey, gammaKey]))
        const head = assertNotNullish(branchHead(s1))
        const c = commitAt(s1, head)
        assertStructurallySame(c.parents.map(hexText), [hexText(was)])
        assertEq(c.author, 'Cas Writer <cas@example.com> 0 +0000')
        assertUntouched(before, s1.root)
    },
    // The same content twice is one object and one commit: the second write
    // answers the key and moves nothing, since the tree already holds the
    // blob under that key. A third, different write chains on the first.
    // A tree the layout did not write, met by a write: a leaf naming the
    // key's file twice is refused rather than the first of them taken as the
    // key, and a `40000` entry naming a commit — whose tree the walk's
    // `tryEntries` would peel to, and a read never does — is refused as no
    // tree, as the listing refuses both. Nothing is written for either.
    writeRefusesMalformed: () => {
        const [, ab, cd, rest] = pathOf(alphaKey)
        const blob = sha1.idOf('blob', alpha)
        const twice = sha1.treeOf([entry('100644', rest, blob), entry('100644', rest, blob)])
        const mid = sha1.treeOf([entry('40000', cd, twice.id)])
        const top = sha1.treeOf([entry('40000', ab, mid.id)])
        const [s0, cas] = writable(over([entry('40000', '.cas', top.id)], [twice.object, mid.object, top.object, sha1.object('blob', alpha)]))
        const [s1, w] = wrote(s0, cas, [alpha])
        assertEq(codeOf(w), casEntryCode)
        assertStructurallySame(s1.root, s0.root)
        assertEq(codeOf(virtual(s0)(cas.list())[1]), casEntryCode)
        const leaf = sha1.treeOf([entry('100644', rest, blob)])
        const commit = sha1.commit(leaf.id)
        const commitId = sha1.idOf('commit', commit)
        const mid2 = sha1.treeOf([entry('40000', cd, commitId)])
        const top2 = sha1.treeOf([entry('40000', ab, mid2.id)])
        const [s2, cas2] = writable(over([entry('40000', '.cas', top2.id)], [leaf.object, sha1.object('commit', commit), mid2.object, top2.object, sha1.object('blob', alpha)]))
        const [s3, w2] = wrote(s2, cas2, [alpha])
        assertEq(codeOf(w2), casEntryCode)
        assertStructurallySame(s3.root, s2.root)
        assertEq(codeOf(virtual(s2)(cas2.list())[1]), casEntryCode)
        // A tree on the path naming a *sibling* twice — `zz`, beside the
        // key's directory — is refused too: rebuilt, it would carry the
        // duplicate into the branch's own commit, which the listing then
        // refuses.
        const other = sha1.treeOf([entry('100644', 'other.txt', blob)])
        const shared = sha1.treeOf([entry('40000', cd, sha1.idOf('tree', [])), entry('40000', 'zz', other.id), entry('40000', 'zz', other.id)])
        const top3 = sha1.treeOf([entry('40000', ab, shared.id)])
        const emptyTree = sha1.treeOf([])
        const [s4, cas4] = writable(over([entry('40000', '.cas', top3.id)], [other.object, emptyTree.object, shared.object, top3.object, sha1.object('blob', alpha)]))
        const [s5, w3] = wrote(s4, cas4, [alpha])
        assertEq(codeOf(w3), casEntryCode)
        assertStructurallySame(s5.root, s4.root)
        // A sibling the listing refuses for the layout — an executable
        // beside the key's directory — is refused by the write too, rather
        // than carried into a commit the listing then refuses.
        const executable = sha1.treeOf([entry('40000', cd, emptyTree.id), entry('100755', 'zz', blob)])
        const top4 = sha1.treeOf([entry('40000', ab, executable.id)])
        const [s6, cas6] = writable(over([entry('40000', '.cas', top4.id)], [emptyTree.object, executable.object, top4.object, sha1.object('blob', alpha)]))
        const [s7, w4] = wrote(s6, cas6, [alpha])
        assertEq(codeOf(w4), casEntryCode)
        assertStructurallySame(s7.root, s6.root)
    },
    // Content already under its key whose blob the repository holds only
    // through a borrowed directory: the tree decides before the blob is
    // stored, so the write stores no loose copy of it and the repository is
    // as it was.
    writesNothingBesideDonor: () => {
        const gammaId = sha1.idOf('blob', gamma)
        const { root, objects } = casEntry(gammaKey, '100644', gammaId)
        const borrowing = setIn(over(root, objects), ['repo', 'objects', 'info', 'alternates'], [u8ListToVecMsb(latin1('../../donor/objects\n'))])
        /** @type {readonly Vec[]} */
        const good = [u8ListToVecMsb(storedBytes(toArray(writeEnvelope('blob', gamma))))]
        const withDonor = setIn(setIn(borrowing, objectPath('donor')(gammaId).split('/'), good), ['donor', 'objects', 'pack'], {})
        const [s0, cas] = writable(withDonor)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertEq(msb.cmp(assertOk(w))(gammaKey), 0)
        assertStructurallySame(s1.root, s0.root)
    },
    writesOnce: () => {
        const [s0, cas] = writable(ordinary(20, initConfig))
        const [s1, w1] = wrote(s0, cas, [gamma])
        const [s2, w2] = wrote(s1, cas, [gamma])
        assertEq(msb.cmp(assertOk(w1))(assertOk(w2)), 0)
        assertStructurallySame(s2.root, s1.root, 'the second write changed the repository')
        const delta = latin1('delta\n')
        const [s3] = wrote(s2, cas, [delta])
        const first = assertNotNullish(branchHead(s1))
        const third = assertNotNullish(branchHead(s3))
        assertStructurallySame(commitAt(s3, third).parents.map(hexText), [hexText(first)])
        assertStructurallySame(spelled(assertOk(virtual(s3)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey, keyOf(delta)]))
    },
    // A repository with no branch at all: the first write is a root commit
    // over a tree of nothing but `.cas`, the store reads it back, and so does
    // a snapshot opened afterwards — the branch now exists.
    writesFromNothing: () => {
        const before = checkedOut(repository(initConfig, null, []))
        const [s0, cas] = writable(before)
        assertStructurallySame(assertOk(virtual(s0)(cas.list())[1]), [])
        const [s1, w] = wrote(s0, cas, [gamma])
        const key = assertOk(w)
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([key]))
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(key)))[1]))(u8ListToVecMsb(gamma)), 0)
        assertStructurallySame(commitAt(s1, assertNotNullish(branchHead(s1))).parents, [])
        assertStructurallySame(spelled(assertOk(listed(s1.root))), spelled([key]))
        assertUntouched(before, s1.root)
    },
    // The same through a SHA-256 repository: the ids, trees and loose files
    // follow the width `config` names.
    writesSha256: () => {
        const [s0, cas] = writable(ordinary(32, initSha256Config))
        const [s1, w] = wrote(s0, cas, [gamma])
        const key = assertOk(w)
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(key)))[1]))(u8ListToVecMsb(gamma)), 0)
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey]))
    },
    // A payload that fails writes nothing: no object, no ref, the repository
    // as it was.
    writeStreamFailure: () => {
        const before = ordinary(20, initConfig)
        const [s0, cas] = writable(before)
        /** @type {EffectList<never, Vec, IoChannel>} */
        const failing = nonEmpty(u8ListToVecMsb(gamma), pureError(ioError({ message: 'boom' })))
        const [s1, w] = virtual(s0)(cas.write(failing))
        const e = assertError(w)
        assert(e[0] === 'ioError' && e[1].message === 'boom', e)
        assertStructurallySame(s1.root, before)
    },
    // The tree already holds the key's path over another blob — a collision,
    // or a corrupt store — or holds a file where the key's path needs a
    // subtree: below `.cas`, where the layout refuses the file as filed
    // where no key is, and at the root, where `.cas` itself is the file. A
    // root tree naming an entry twice is refused as a tree. None is a write
    // to make, and none changes the repository.
    writeRefuses: () => {
        const other = sha1.idOf('blob', alpha)
        const collided = casEntry(gammaKey, '100644', other)
        const before = over(collided.root, [...collided.objects, sha1.object('blob', alpha)])
        const [s0, cas] = writable(before)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertEq(codeOf(w), casEntryCode)
        // The tree refused before anything was written: no blob, no tree.
        assertStructurallySame(s1.root, before)
        const [, ab] = pathOf(gammaKey)
        const file = sha1.treeOf([entry('100644', ab, other)])
        const [s2, cas2] = writable(over([entry('40000', '.cas', file.id)], [file.object, sha1.object('blob', alpha)]))
        assertEq(codeOf(wrote(s2, cas2, [gamma])[1]), casEntryCode)
        const [s3, cas3] = writable(over([entry('100644', '.cas', other)], [sha1.object('blob', alpha)]))
        assertEq(codeOf(wrote(s3, cas3, [gamma])[1]), casEntryCode)
        const [s4, cas4] = writable(over([entry('100644', 'README.md', other), entry('100644', 'README.md', other)], [sha1.object('blob', alpha)]))
        assertEq(codeOf(wrote(s4, cas4, [gamma])[1]), casEntryCode)
    },
    // A store over a repository whose ref names no commit is refused when
    // it is read, as a snapshot is; and a branch whose name is no ref name
    // before anything is opened.
    writeBadHead: () => {
        const [s0, cas] = writable(repository(initConfig, sha1.idOf('blob', alpha), [sha1.object('blob', alpha)]))
        assertEq(codeOf(virtual(s0)(cas.list())[1]), snapshotHeadCode)
        const o = runPure(branchCas(sha256, { dir, branch: 'a..b' }, author))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), snapshotHeadCode)
    },
    // An author an ident cannot hold — a name or an email that is empty or
    // blank, or holds `<`, `>`, a line feed or a NUL — is refused before
    // anything is opened, which `runPure` finishing is the proof of, rather
    // than carried to the ident writer that throws once the blob and trees
    // are written, or written as a commit `git fsck` refuses.
    writeBadAuthor: () => {
        /** @type {readonly Author[]} */
        const bad = [
            { name: 'A <B>', email: 'a@b' },
            { name: 'A', email: 'a@b\nc' },
            { name: 'A\0B', email: 'a@b' },
            { name: '', email: 'a@b' },
            { name: 'A', email: ' ' },
        ]
        for (const author of bad) {
            const o = runPure(branchCas(sha256, branch, author))
            assert(o.length === 1, o)
            assertEq(codeOf(o[0]), authorCode, JSON.stringify(author))
        }
    },
    // ## Writing an object
    //
    // A file already at the object's path that is not the object — junk that
    // inflates to no object here — is replaced, so a write never commits
    // a tree naming a path a read would then refuse. A good object there is
    // left alone, which `writesOnce` shows by the unchanged repository.
    writeObjectReplacesCorrupt: () => {
        const gammaId = sha1.idOf('blob', gamma)
        const root = ordinary(20, initConfig)
        const corrupt = setIn(root, objectPath(dir)(gammaId).split('/'), [u8ListToVecMsb(storedBytes(latin1('junk')))])
        const [s0, cas] = writable(corrupt)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const o = assertNotNullish(assertOk(virtual(s1)(readObject(dir, 20)(gammaId))[1]))
        assertEq(o.type, 'blob')
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(gammaKey)))[1]))(u8ListToVecMsb(gamma)), 0)
    },
    // A good loose object already at the path — gamma's blob, there before
    // any key named it — is left as it is when the write needs it: the
    // file's bytes are the same after as before.
    writeObjectLeavesPresent: () => {
        const gammaId = sha1.idOf('blob', gamma)
        const [s0, cas] = writable(over([], [sha1.object('blob', gamma)]))
        const [s1, w] = wrote(s0, cas, [gamma])
        assertEq(msb.cmp(assertOk(w))(gammaKey), 0)
        const at = objectPath(dir)(gammaId).split('/')
        /** @type {(d: Dir, path: readonly string[]) => unknown} */
        const getIn = (d, [first, ...rest]) => {
            const sub = d[first]
            return rest.length === 0 || sub === undefined || sub instanceof Array ? sub : getIn(/** @type {Dir} */ (sub), rest)
        }
        assertStructurallySame(getIn(s1.root, at), getIn(s0.root, at))
    },
    // A valid loose object at the path that is another object — alpha's
    // bytes filed under gamma's id — is not the object either: the hash is
    // compared, not the file's being an object, and the write replaces it.
    writeObjectReplacesOther: () => {
        const gammaId = sha1.idOf('blob', gamma)
        /** @type {readonly Vec[]} */
        const other = [u8ListToVecMsb(storedBytes(toArray(writeEnvelope('blob', alpha))))]
        const swapped = setIn(ordinary(20, initConfig), objectPath(dir)(gammaId).split('/'), other)
        const [s0, cas] = writable(swapped)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const o = assertNotNullish(assertOk(virtual(s1)(readObject(dir, 20)(gammaId))[1]))
        assertEq(msb.cmp(u8ListToVecMsb(toArray(o.payload)))(u8ListToVecMsb(gamma)), 0)
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(gammaKey)))[1]))(u8ListToVecMsb(gamma)), 0)
    },
    // The decision reads the loose file itself and not the store: the same
    // object held by a borrowed directory would otherwise stand for the
    // corrupt file at the repository's own path, which Git refuses later. A
    // repository whose `alternates` names a donor holding the good object,
    // with junk at its own path: the write replaces the junk, and the
    // repository's own `objects/`, read alone, holds the object.
    writeObjectReplacesCorruptBesideDonor: () => {
        const gammaId = sha1.idOf('blob', gamma)
        /** @type {readonly Vec[]} */
        const good = [u8ListToVecMsb(storedBytes(toArray(writeEnvelope('blob', gamma))))]
        const borrowing = setIn(ordinary(20, initConfig), ['repo', 'objects', 'info', 'alternates'], [u8ListToVecMsb(latin1('../../donor/objects\n'))])
        const withDonor = setIn(setIn(borrowing, objectPath('donor')(gammaId).split('/'), good), ['donor', 'objects', 'pack'], {})
        const corrupt = setIn(withDonor, objectPath(dir)(gammaId).split('/'), [u8ListToVecMsb(storedBytes(latin1('junk')))])
        const [s0, cas] = writable(corrupt)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const own = assertNotNullish(assertOk(virtual(s1)(readIn([objectsDir(dir)], 20)(gammaId))[1]))
        assertEq(own.type, 'blob')
    },
    // A chunk that is not whole bytes is refused as `fileCas.write` and
    // `contentKey` refuse it, before any object is written: the blob's bytes
    // would pad the chunk where the key hashed its bits.
    writeRefusesPartialByte: () => {
        const [s0, cas] = writable(repository(initConfig, null, []))
        /** @type {EffectList<never, Vec, IoChannel>} */
        const stream = nonEmpty(vec8(0x11n), nonEmpty(vec(5n)(0b10101n), empty()))
        const [s1, r] = virtual(s0)(cas.write(stream))
        const e = assertError(r)
        assert(e[0] === 'ioError' && e[1].message === 'invalid buffer size', e)
        assertStructurallySame(s1.root, s0.root)
    },
    // The loose file is renamed into place once whole, and a rename that
    // fails takes the temporary file with it: driven with the virtual
    // filesystem's commands answered by hand, since no filesystem fails a
    // rename on request. The store's read finds no object yet, the `rename`
    // fails, and the log shows the `rm` that followed it.
    writeObjectRenameFails: () => {
        const drive = _driveCas({
            writeExclusive: ok(undefined),
            readWhole: error(ioError({ code: 'ENOENT', message: 'no such file or directory' })),
        })
        const boom = ioError({ message: 'boom' })
        const [r, log] = drive({
            rename: [error(boom)],
        })(writeObject(dir, 20)('blob', alpha))
        assertEq(assertError(r), boom)
        assertStructurallySame(log.slice(log.indexOf('rename')), ['rename', 'rm'])
    },
    // ## The configured author
    //
    // `user.name` and `user.email` from the repository's `config`, each
    // falling back to `~/.gitconfig`; `null` where either is set in neither,
    // and a `config` Git does not read refused.
    configuredAuthor: () => {
        /** @type {(local: string | null, global: string | null) => Result<Author | null, IoChannel>} */
        const found = (local, global) => virtualAt({
            repo: local === null ? {} : { config: text(local) },
            home: global === null ? {} : { '.gitconfig': text(global) },
        })(configuredAuthor('repo', 'home'))[1]
        assertStructurallySame(assertOk(found('[user]\n\tname = A\n\temail = a@b\n', null)), { name: 'A', email: 'a@b' })
        assertStructurallySame(assertOk(found('[user]\n\tname = A\n', '[user]\n\tname = G\n\temail = g@b\n')), { name: 'A', email: 'g@b' })
        assertStructurallySame(assertOk(found(null, '[user]\n\tname = G\n\temail = g@b\n')), { name: 'G', email: 'g@b' })
        assertEq(assertOk(found('[core]\n', null)), null)
        assertEq(assertOk(found(null, null)), null)
        assertEq(codeOf(found('[unclosed\n', null)), repositoryFormatCode)
        // A value an ident cannot hold, which `git commit` would strip the
        // brackets from: refused, naming the setting, in either file.
        assertEq(codeOf(found('[user]\n\tname = A <B>\n\temail = a@b\n', null)), authorCode)
        assertEq(codeOf(found('[user]\n\tname = A\n', '[user]\n\temail = <a@b>\n')), authorCode)
        // Each refused character on its own, in either setting: `<`, `>`, and
        // a line feed, which a quoted value spells `\n`.
        for (const bad of ['A <B', 'A> B', '"A\\nB"']) {
            assertEq(codeOf(found(`[user]\n\tname = ${bad}\n\temail = a@b\n`, null)), authorCode, bad)
            assertEq(codeOf(found(`[user]\n\tname = A\n\temail = ${bad}\n`, null)), authorCode, bad)
        }
        // A setting that is set and empty, or blank, which `git commit`
        // refuses as an empty ident: refused, not an author of nobody and
        // not an author of none.
        for (const empty of ['', '" "']) {
            assertEq(codeOf(found(`[user]\n\tname = ${empty}\n\temail = a@b\n`, null)), authorCode, JSON.stringify(empty))
            assertEq(codeOf(found(`[user]\n\tname = A\n\temail = ${empty}\n`, null)), authorCode, JSON.stringify(empty))
        }
        // An `[include]` or `[includeIf]` is not followed, so a file holding
        // one is refused where its answer would count: the repository's
        // always, `~/.gitconfig` where the repository's does not name both.
        assertEq(codeOf(found('[include]\n\tpath = ~/.gitconfig.d/user\n[user]\n\tname = A\n\temail = a@b\n', null)), authorCode)
        assertEq(codeOf(found('[user]\n\tname = A\n', '[includeIf "gitdir:~/work/"]\n\tpath = work\n[user]\n\temail = g@b\n')), authorCode)
        assertStructurallySame(assertOk(found('[user]\n\tname = A\n\temail = a@b\n', '[include]\n\tpath = other\n')), { name: 'A', email: 'a@b' })
        // A `config` the host refuses to read for any reason but its absence
        // is that refusal, not an author of none: driven with `readFile`
        // answering `EACCES`, which no virtual filesystem produces.
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        const [r] = _driveCas({ readFile: error(denied) })({})(configuredAuthor('repo', 'home'))
        assertEq(assertError(r), denied)
    },
}
