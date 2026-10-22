/**
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../../git/object/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { Branch, CasReader, SnapshotOperation } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { pureOk, runPure } from '../../effects/module.f.mjs'
import { isNotFound } from '../../effects/node/module.f.mjs'
import { virtual, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of } from '../../git/oid/module.f.mjs'
import { objectPath } from '../../git/store/module.f.mjs'
import { initConfig, initSha256Config, latin1 } from '../../git/testlib.f.mjs'
import { write as writeTree } from '../../git/tree/module.f.mjs'
import { length, maxLength, msb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { storedBytes } from '../../zlib/testlib.f.mjs'
import { collectRead, toPath } from '../module.f.mjs'
import { casAt, casEntryCode, repositoryFormatCode, snapshot, snapshotHeadCode, snapshotRef } from './module.f.mjs'

/** The repository every case reads, and the branch the snapshot is of. */
const dir = /** @type {const} */ ('repo')

/** @type {Branch} */
const branch = { dir, remote: 'origin', branch: 'build-cache' }

/** Where the snapshot ref is, as a path in the virtual filesystem. */
const refPath = `${dir}/refs/remotes/origin/build-cache`

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
 * @type {(d: Dir, path: readonly string[], content: readonly Vec[]) => Dir}
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
 * A repository as files: its `config`, the snapshot ref at `head`, and the
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
    // ## The snapshot ref
    snapshotRef: () => {
        assertEq(snapshotRef(branch), 'refs/remotes/origin/build-cache')
        assertEq(snapshotRef({ dir, remote: 'up', branch: 'feature/x' }), 'refs/remotes/up/feature/x')
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
    // No snapshot ref at all — a branch never fetched, or one the remote does
    // not have — is the empty map: every key a miss, and no key listed.
    noRef: () => {
        const root = repository(initConfig, null, [])
        assert(isNotFound(assertError(readAll(root, alphaKey))))
        assertStructurallySame(assertOk(listed(root)), [])
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
        const o = runPure(snapshot({ dir, remote: 'origin', branch: 'a..b' }))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), snapshotHeadCode)
    },
    // A `config` Git does not open — a repository format version it does not
    // know — gives no id width, and so no object can be read.
    badConfig: () => {
        const root = repository('[core]\n\trepositoryformatversion = 99\n', null, [])
        assertEq(codeOf(opened(root)[1]), repositoryFormatCode)
    },
    // The snapshot ref names what is no commit: a blob, bytes that are no
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
    // not there. A read walks a path through it and finds nothing, which is a
    // miss — the walk's answer for a path a tree does not take.
    casIsFile: () => {
        const root = over([entry('100644', '.cas', sha1.idOf('blob', alpha))], [sha1.object('blob', alpha)])
        assertEq(codeOf(listed(root)), casEntryCode)
        assert(isNotFound(assertError(readAll(root, alphaKey))))
    },
    // An entry at a key's path whose mode is not `100644`: an executable, and
    // a symbolic link whose blob holds its target's path. Either is refused
    // rather than read as the key's content. The listing names the key all the
    // same — it reads trees, not modes — which is what makes the read the
    // place the refusal has to be.
    entryMode: () => {
        for (const mode of ['100755', '120000']) {
            const { root, objects } = casEntry(alphaKey, mode, sha1.idOf('blob', alpha))
            const r = over(root, [...objects, sha1.object('blob', alpha)])
            assertEq(codeOf(readAll(r, alphaKey)), casEntryCode, mode)
            assertStructurallySame(spelled(assertOk(listed(r))), spelled([alphaKey]))
        }
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
        const cas = sha1.treeOf([entry('100644', 'README.md', readmeId), entry('100644', '\xff', readmeId), entry('40000', ab, mid.id)])
        const root = over([entry('40000', '.cas', cas.id)], [leaf.object, mid.object, cas.object, sha1.object('blob', readme), sha1.object('blob', alpha)])
        assertStructurallySame(spelled(assertOk(listed(root))), spelled([alphaKey]))
    },
    // A subtree below `.cas` whose object is bytes that are no tree, and one
    // the repository does not hold: the listing is refused rather than cut
    // short at either.
    subtreeNoTree: () => {
        const junk = latin1('junk')
        const junkId = sha1.idOf('tree', junk)
        const cas = sha1.treeOf([entry('40000', 'zz', junkId)])
        const root = over([entry('40000', '.cas', cas.id)], [cas.object, [objectPath(dir)(junkId), [u8ListToVecMsb(storedBytes(junk))]]])
        assertEq(codeOf(listed(root)), casEntryCode)
        const gone = sha1.treeOf([entry('40000', 'zz', sha1.idOf('tree', []))])
        assertEq(codeOf(listed(over([entry('40000', '.cas', gone.id)], [gone.object]))), casEntryCode)
    },
    // ## The map over any reader
    //
    // `casAt` takes the store's reader, so a blob longer than one `Vec` is
    // read through a reader that holds it in memory, with no file to inflate:
    // it streams as two cells, a full `Vec` and the rest, and then ends.
    bigBlob: () => {
        const { idOf } = sha1
        const big = Array.from({ length: Number(maxLength / 8n) + 1 }, (_, i) => i & 0xff)
        const bigId = idOf('blob', big)
        const [, ab, cd, rest] = pathOf(alphaKey)
        const leaf = toArray(writeTree(20)([entry('100644', rest, bigId)]))
        const mid = toArray(writeTree(20)([entry('40000', cd, idOf('tree', leaf))]))
        const cas = toArray(writeTree(20)([entry('40000', ab, idOf('tree', mid))]))
        const root = toArray(writeTree(20)([entry('40000', '.cas', idOf('tree', cas))]))
        /** @type {ReadonlyMap<string, Envelope>} */
        const held = new Map([
            [hexText(bigId), { type: 'blob', payload: big }],
            [hexText(idOf('tree', leaf)), { type: 'tree', payload: leaf }],
            [hexText(idOf('tree', mid)), { type: 'tree', payload: mid }],
            [hexText(idOf('tree', cas)), { type: 'tree', payload: cas }],
            [hexText(idOf('tree', root)), { type: 'tree', payload: root }],
        ])
        /** @type {Read<never>} */
        const read = id => pureOk(held.get(hexText(id)) ?? null)
        const stream = casAt(read, 20)(idOf('tree', root)).read(alphaKey)
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
}
