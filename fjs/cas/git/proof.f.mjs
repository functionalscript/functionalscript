/**
 * @import { Dir, State } from '../../effects/node/virtual/types.ts'
 * @import { EffectList } from '../../effects/list/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Envelope } from '../../git/object/types.ts'
 * @import { TreeEntry } from '../../git/tree/types.ts'
 * @import { ObjectType, Oid, OidBytes } from '../../git/types.ts'
 * @import { Read } from '../../git/walk/types.ts'
 * @import { Cas } from '../types.ts'
 * @import { Author, Branch, CasReader, ProposalOperation, SnapshotOperation } from './types.ts'
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
import { write as writeTree } from '../../git/tree/module.f.mjs'
import { length, maxLength, msb, u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { storedBytes } from '../../zlib/testlib.f.mjs'
import { collectRead, toPath } from '../module.f.mjs'
import { _driveCas } from '../proof.f.mjs'
import { casAt, casEntryCode, proposal, proposalRef, repositoryFormatCode, snapshot, snapshotHeadCode, snapshotRef, writeObject } from './module.f.mjs'

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

// ## Writing
//
// What the write side's fixtures add: a checkout beside the repository — a
// `HEAD`, an index and a worktree file — which a write must leave as it found
// them, and the author every proposal commit is by.

/** @type {Author} */
const author = { name: 'Cas Writer', email: 'cas@example.com' }

/** The proposal ref as a path, and as the name the ref store reads. */
const proposalPath = `${dir}/refs/cas/origin/build-cache`

const proposalName = latin1(proposalRef(branch))

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

/** Opens the proposal of `branch` over `root`: the filesystem it left and the store. @type {(root: Dir) => readonly [State, Cas<ProposalOperation>]} */
const proposed = root => {
    const [state, r] = virtualAt(root)(proposal(sha256, branch, author))
    return [state, assertOk(r)]
}

/** Writes `chunks` through `cas` over `state`: the filesystem after and the key. @type {(state: State, cas: Cas<ProposalOperation>, chunks: readonly (readonly number[])[]) => readonly [State, Result<Vec, IoChannel>]} */
const wrote = (state, cas, chunks) => virtual(state)(cas.write(payload(chunks)))

/** The id the proposal ref holds over `state`, or `null`. @type {(state: State) => Oid | null} */
const proposalHead = state => assertOk(virtual(state)(tryResolve({ gitdir: dir, common: dir }, 20)(proposalName))[1])

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
 * `config` and every ref but the proposal's. Only `objects/` and
 * `refs/cas/` may differ, and no temporary object file is left behind.
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
        const { cas, ...otherRefs } = held
        return { ...d, [dir]: { ...rest, refs: otherRefs } }
    }
    assertStructurallySame(strip(after), strip(before))
    const objects = assertNotNullish(after[dir])
    assert(typeof objects === 'object' && !(objects instanceof Array))
    const od = objects.objects
    assert(od !== undefined && typeof od === 'object' && !(od instanceof Array))
    assert(Object.keys(od).every(n => !n.startsWith('tmp_obj_')), Object.keys(od))
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
    // ## The proposal
    //
    // A write into the ordinary repository: the key is the content's hash as
    // `fileCas` would key it, the proposal reads it back — in two chunks, so
    // the gathering is proved to keep every chunk — and lists it beside the
    // published keys, the published snapshot does not see it, the commit is a
    // child of the published commit by the author given, and nothing of the
    // checkout, the `config` or any other ref has changed.
    proposalWrites: () => {
        const before = checkedOut(ordinary(20, initConfig))
        const [s0, cas] = proposed(before)
        const [s1, w] = wrote(s0, cas, [gamma.slice(0, 3), gamma.slice(3)])
        const key = assertOk(w)
        assertEq(msb.cmp(key)(gammaKey), 0, 'the key is not the content hash')
        const back = assertOk(virtual(s1)(collectRead(cas.read(key)))[1])
        assertEq(msb.cmp(back)(u8ListToVecMsb(gamma)), 0, 'read back other bytes')
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey]))
        assertStructurallySame(spelled(assertOk(listed(s1.root))), spelled([alphaKey, betaKey]))
        const head = assertNotNullish(proposalHead(s1))
        const published = assertNotNullish(assertOk(virtual(s1)(tryResolve({ gitdir: dir, common: dir }, 20)(latin1(snapshotRef(branch))))[1]))
        const c = commitAt(s1, head)
        assertStructurallySame(c.parents.map(hexText), [hexText(published)])
        assertEq(c.author, 'Cas Writer <cas@example.com> 0 +0000')
        assertUntouched(before, s1.root)
        assert(proposalPath.split('/').reduce((/** @type {unknown} */ d, n) => d !== undefined && typeof d === 'object' ? /** @type {Dir} */ (d)[n] : undefined, s1.root) !== undefined, 'no proposal ref')
    },
    // The same content twice is one object and one commit: the second write
    // answers the key and moves nothing, since the tree already holds the
    // blob under that key. A third, different write chains on the first.
    proposalWritesOnce: () => {
        const [s0, cas] = proposed(ordinary(20, initConfig))
        const [s1, w1] = wrote(s0, cas, [gamma])
        const [s2, w2] = wrote(s1, cas, [gamma])
        assertEq(msb.cmp(assertOk(w1))(assertOk(w2)), 0)
        assertStructurallySame(s2.root, s1.root, 'the second write changed the repository')
        const delta = latin1('delta\n')
        const [s3] = wrote(s2, cas, [delta])
        const first = assertNotNullish(proposalHead(s1))
        const third = assertNotNullish(proposalHead(s3))
        assertStructurallySame(commitAt(s3, third).parents.map(hexText), [hexText(first)])
        assertStructurallySame(spelled(assertOk(virtual(s3)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey, keyOf(delta)]))
    },
    // A repository with no snapshot at all: the first write is a root commit
    // over a tree of nothing but `.cas`, the proposal reads it back, and the
    // published snapshot is still empty — a proposal is not a publication.
    proposalFromNothing: () => {
        const before = checkedOut(repository(initConfig, null, []))
        const [s0, cas] = proposed(before)
        assertStructurallySame(assertOk(virtual(s0)(cas.list())[1]), [])
        const [s1, w] = wrote(s0, cas, [gamma])
        const key = assertOk(w)
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([key]))
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(key)))[1]))(u8ListToVecMsb(gamma)), 0)
        assertStructurallySame(commitAt(s1, assertNotNullish(proposalHead(s1))).parents, [])
        assertStructurallySame(assertOk(listed(s1.root)), [])
        assertUntouched(before, s1.root)
    },
    // The same through a SHA-256 repository: the ids, trees and loose files
    // follow the width `config` names.
    proposalSha256: () => {
        const [s0, cas] = proposed(ordinary(32, initSha256Config))
        const [s1, w] = wrote(s0, cas, [gamma])
        const key = assertOk(w)
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(key)))[1]))(u8ListToVecMsb(gamma)), 0)
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([alphaKey, betaKey, gammaKey]))
    },
    // A payload that fails writes nothing: no object, no ref, the repository
    // as it was.
    proposalStreamFailure: () => {
        const before = ordinary(20, initConfig)
        const [s0, cas] = proposed(before)
        /** @type {EffectList<never, Vec, IoChannel>} */
        const failing = nonEmpty(u8ListToVecMsb(gamma), pureError(ioError({ message: 'boom' })))
        const [s1, w] = virtual(s0)(cas.write(failing))
        const e = assertError(w)
        assert(e[0] === 'ioError' && e[1].message === 'boom', e)
        assertStructurallySame(s1.root, before)
    },
    // The tree already holds the key's path over another blob — a collision,
    // or a corrupt store — or holds a file where the key's path needs a
    // subtree. Neither is a write to make, and neither changes the repository.
    proposalRefuses: () => {
        const other = sha1.idOf('blob', alpha)
        const collided = casEntry(gammaKey, '100644', other)
        const before = over(collided.root, [...collided.objects, sha1.object('blob', alpha)])
        const [s0, cas] = proposed(before)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertEq(codeOf(w), casEntryCode)
        // The blob was written before the tree refused it, and nothing else was.
        const { objects, ...rest } = assertNotNullish(/** @type {Dir} */ (s1.root[dir]))
        const { objects: objectsBefore, ...restBefore } = assertNotNullish(/** @type {Dir} */ (before[dir]))
        assertStructurallySame(rest, restBefore)
        const [, ab] = pathOf(gammaKey)
        const file = sha1.treeOf([entry('100644', ab, other)])
        const [s2, cas2] = proposed(over([entry('40000', '.cas', file.id)], [file.object, sha1.object('blob', alpha)]))
        assertEq(codeOf(wrote(s2, cas2, [gamma])[1]), casEntryCode)
    },
    // A proposal over a repository whose ref names no commit is refused when
    // it is read, as a snapshot is; and a branch whose name is no ref name
    // before anything is opened.
    proposalBadHead: () => {
        const [s0, cas] = proposed(repository(initConfig, sha1.idOf('blob', alpha), [sha1.object('blob', alpha)]))
        assertEq(codeOf(virtual(s0)(cas.list())[1]), snapshotHeadCode)
        const o = runPure(proposal(sha256, { dir, remote: 'origin', branch: 'a..b' }, author))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), snapshotHeadCode)
    },
    // ## Writing an object
    //
    // A file already at the object's path that is not the object — junk that
    // inflates to no object here — is replaced, so the proposal never commits
    // a tree naming a path a read would then refuse. A good object there is
    // left alone, which `proposalWritesOnce` shows by the unchanged repository.
    writeObjectReplacesCorrupt: () => {
        const gammaId = sha1.idOf('blob', gamma)
        const root = ordinary(20, initConfig)
        const corrupt = setIn(root, objectPath(dir)(gammaId).split('/'), [u8ListToVecMsb(storedBytes(latin1('junk')))])
        const [s0, cas] = proposed(corrupt)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const o = assertNotNullish(assertOk(virtual(s1)(readObject(dir, 20)(gammaId))[1]))
        assertEq(o.type, 'blob')
        assertEq(msb.cmp(assertOk(virtual(s1)(collectRead(cas.read(gammaKey)))[1]))(u8ListToVecMsb(gamma)), 0)
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
        })(writeObject(dir, 20, readIn([objectsDir(dir)], 20))('blob', alpha))
        assertEq(assertError(r), boom)
        assertStructurallySame(log.slice(log.indexOf('rename')), ['rename', 'rm'])
    },
}
