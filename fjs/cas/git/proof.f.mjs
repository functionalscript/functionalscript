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
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Exec, ExecResult, IoResult, NodeOp } from '../../effects/node/types.ts'
 * @import { Author, Branch, CasReader, Proposal, ProposalOperation, Remote, SnapshotOperation } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { vecToCBase32 } from '../../basen/cbase32/module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { history, historyStep, ioError, mapStep, pureError, pureOk, runPure, step, walkStep } from '../../effects/module.f.mjs'
import { empty, nonEmpty } from '../../effects/list/module.f.mjs'
import { partialRun } from '../../effects/mock/module.f.mjs'
import { isNotFound, nodeCommands } from '../../effects/node/module.f.mjs'
import { virtual, virtualAt, virtualOperationMap } from '../../effects/node/virtual/module.f.mjs'
import { author as authorOf, parents, tryRead as readCommit } from '../../git/commit/module.f.mjs'
import { write as writeEnvelope } from '../../git/object/module.f.mjs'
import { hexText, of } from '../../git/oid/module.f.mjs'
import { tryResolve } from '../../git/refstore/module.f.mjs'
import { tryDelete, tryWrite } from '../../git/refstore/write/module.f.mjs'
import { objectPath, objectsDir, readIn, tryRead as readObject } from '../../git/store/module.f.mjs'
import { initConfig, initSha256Config, latin1 } from '../../git/testlib.f.mjs'
import { write as writeTree } from '../../git/tree/module.f.mjs'
import { length, maxLength, msb, u8ListToVecMsb, vec, vec8 } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { storedBytes } from '../../zlib/testlib.f.mjs'
import { collectRead, toPath } from '../module.f.mjs'
import { _driveCas } from '../proof.f.mjs'
import {
    casAt, casEntryCode, gitOutputCode, gitRemote, maxAttempts, proposal, proposalRef, publish, publishAttemptsCode,
    repositoryFormatCode, shellArgumentCode, snapshot, snapshotHeadCode, snapshotRef, writeObject,
} from './module.f.mjs'

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
 * A nested directory with `content` at `path` — a file's chunks, or a
 * directory — built over `d`: the shape the virtual filesystem is given,
 * from the flat paths the fixtures spell.
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

/** Opens the proposal of `branch` over `root`: the filesystem it left and the store. @type {(root: Dir) => readonly [State, Proposal<ProposalOperation>]} */
const proposed = root => {
    const [state, r] = virtualAt(root)(proposal(sha256, branch, author))
    return [state, assertOk(r)]
}

/** Writes `chunks` through `cas` over `state`: the filesystem after and the key. @type {(state: State, cas: Proposal<ProposalOperation>, chunks: readonly (readonly number[])[]) => readonly [State, Result<Vec, IoChannel>]} */
const wrote = (state, cas, chunks) => virtual(state)(cas.write(payload(chunks)))

/** The two directories of the fixture repository, as the ref store takes them. */
const dirs = { gitdir: dir, common: dir }

/** The id a ref holds over `state`, or `null`. @type {(state: State, name: string) => Oid | null} */
const refAt = (state, name) => assertOk(virtual(state)(tryResolve(dirs, 20)(latin1(name)))[1])

/** The id the proposal ref holds over `state`, or `null`. @type {(state: State) => Oid | null} */
const proposalHead = state => refAt(state, proposalRef(branch))

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

// ## Publishing
//
// A remote over the virtual filesystem, so the publication loop runs with no
// network and no `git`: the remote branch is a ref of the same repository,
// `refs/fake/origin/build-cache`, whose objects are therefore already local;
// `fetch` copies it to the snapshot ref and notes what was fetched; `push`
// is refused exactly where the remote moved since the last fetch, which is
// what a non-fast-forward is; and a `pending` ref, where a case sets one, is
// what the remote moves to during the first push — the race a real remote
// can run and a proof has to stage.

const remoteRef = 'refs/fake/origin/build-cache'

const fetchedRef = 'refs/fake/origin/fetched'

const pendingRef = 'refs/fake/origin/pending'

const resolveRef = tryResolve(dirs, 20)

const writeRef = tryWrite(dirs, 20)

const deleteRef = tryDelete(dirs, 20)

/** Moves `name` to `id`, or removes it where `id` is `null`. @type {(name: string) => (id: Oid | null) => import('../../effects/types.ts').Effect<NodeOp, unknown, IoChannel>} */
const setRef = name => id => id === null ? deleteRef(latin1(name)) : writeRef(latin1(name))(id)

/**
 * The ancestors of a commit, itself included, as the hex of each: a walk over
 * the parents, which for the short histories here is what a merge base is
 * found in.
 *
 * @type {(id: Oid) => import('../../effects/types.ts').Effect<NodeOp, ReadonlySet<string>, IoChannel>}
 */
const ancestors = id => walkStep(pureOk([id]), /** @type {ReadonlySet<string>} */ (new Set()), c => seen => {
    if (seen.has(hexText(c))) { return pureOk(/** @type {const} */ ([seen, []])) }
    return mapStep(readObject(dir, 20)(c), o => {
        const commit = assertNotNullish(readCommit(assertNotNullish(o).payload))
        return /** @type {const} */ ([new Set([...seen, hexText(c)]), parents(commit)])
    })
})

/**
 * The merge base of two commits of the fixture repository: the first
 * ancestor of `a`, breadth first, that is an ancestor of `b` — exact for the
 * linear and two-sided histories the cases build.
 *
 * @type {(a: Oid, b: Oid) => import('../../effects/types.ts').Effect<NodeOp, Oid | null, IoChannel>}
 */
const mergeBaseOf = (a, b) => step(ancestors(b), theirs => {
    const found = walkStep(pureOk([a]), /** @type {{ readonly seen: ReadonlySet<string>, readonly base: Oid | null }} */ ({ seen: new Set(), base: null }), c => s => {
        if (s.base !== null || s.seen.has(hexText(c))) { return pureOk(/** @type {const} */ ([s, []])) }
        if (theirs.has(hexText(c))) { return pureOk(/** @type {const} */ ([{ ...s, base: c }, []])) }
        return mapStep(readObject(dir, 20)(c), o => {
            const commit = assertNotNullish(readCommit(assertNotNullish(o).payload))
            return /** @type {const} */ ([{ ...s, seen: new Set([...s.seen, hexText(c)]) }, parents(commit)])
        })
    })
    return mapStep(found, s => s.base)
})

/** @type {Remote<NodeOp>} */
const fakeRemote = {
    fetch: () => {
        const r = history(resolveRef(latin1(remoteRef)))
        const noted = historyStep(r, id => setRef(snapshotRef(branch))(id))
        const marked = historyStep(noted, (_, id) => setRef(fetchedRef)(id))
        return mapStep(marked, ([, , id]) => id)
    },
    push: commit => {
        const r = history(resolveRef(latin1(remoteRef)))
        const f = historyStep(r, () => resolveRef(latin1(fetchedRef)))
        const p = historyStep(f, () => resolveRef(latin1(pendingRef)))
        return step(p, ([pending, fetched, at]) => {
            if (pending !== null) {
                // The race: the remote moves to what was pending, and this push
                // meets a branch that is no longer where it was fetched.
                return mapStep(step(setRef(remoteRef)(pending), () => setRef(pendingRef)(null)), () => false)
            }
            if (at !== fetched) { return pureOk(false) }
            return mapStep(setRef(remoteRef)(commit), () => true)
        })
    },
    mergeBase: mergeBaseOf,
}

/** A remote that refuses every push, moving each time, so a publication runs out of attempts. @type {Remote<NodeOp>} */
const unyielding = {
    ...fakeRemote,
    push: () => pureOk(false),
}

/** Publishes `branch` through `remote` over `state`. @type {(state: State, remote?: Remote<NodeOp>) => readonly [State, Result<Oid | null, IoChannel>]} */
const publishedBy = (state, remote = fakeRemote) => virtual(state)(publish(remote, branch, author))

/**
 * Another writer of the same remote branch, in the same repository: its
 * snapshot ref is set to `from`, so its proposal descends from that commit,
 * and its proposal is what a case moves the fake remote to.
 *
 * @type {(state: State, from: Oid | null, act: (cas: Proposal<ProposalOperation>) => import('../../effects/types.ts').Effect<ProposalOperation, unknown, IoChannel>) => readonly [State, Oid]}
 */
const other = (state, from, act) => {
    /** @type {Branch} */
    const theirs = { dir, remote: 'other', branch: 'build-cache' }
    const [s1, r1] = virtual(state)(from === null ? pureOk(undefined) : writeRef(latin1(snapshotRef(theirs)))(from))
    assertOk(r1)
    const [s2, r2] = virtual(s1)(step(proposal(sha256, theirs, { name: 'Other', email: 'other@example.com' }), act))
    assertOk(r2)
    return [s2, assertNotNullish(refAt(s2, proposalRef(theirs)))]
}

/** The keys of the published snapshot over `state`, spelled. @type {(state: State) => readonly string[]} */
const publishedKeys = state => spelled(assertOk(virtual(state)(step(snapshot(branch), s => s.list()))[1]))

/** Sets the fake remote's branch to `id` over `state`. @type {(state: State, id: Oid) => State} */
const remoteAt = (state, id) => {
    const [s, r] = virtual(state)(setRef(remoteRef)(id))
    assertOk(r)
    return s
}

/** The ordinary repository with its published commit also at the fake remote. @type {() => readonly [State, Oid]} */
const published = () => {
    const root = ordinary(20, initConfig)
    const [state] = virtualAt(root)(pureOk(undefined))
    const a = assertNotNullish(refAt(state, snapshotRef(branch)))
    return [remoteAt(state, a), a]
}

/** A proposal over `state` with `gamma` and `delta` written. @type {(state: State) => State} */
const withTwo = state => {
    const [s0, cas] = proposed(state.root)
    const [s1, w1] = wrote(s0, cas, [gamma])
    assertOk(w1)
    const [s2, w2] = wrote(s1, cas, [latin1('delta\n')])
    assertOk(w2)
    return s2
}

const deltaKey = keyOf(latin1('delta\n'))

const epsilonKey = keyOf(latin1('epsilon\n'))

// ## The `git` remote
//
// `exec` answered by a script keyed on the command `git` would be run
// with, over the virtual filesystem for the refs: what each command prints,
// or the failure Node's `exec` reports for a non-zero exit — `Command
// failed: <command>\n<stderr>`.

/** The commands {@link gitRemote} runs for the fixture branch, as it spells them. */
const git = {
    lsRemote: 'git --git-dir="repo" ls-remote -- "origin" "refs/heads/build-cache"',
    fetch: 'git --git-dir="repo" fetch -- "origin" "+refs/heads/build-cache:refs/remotes/origin/build-cache"',
    push: /** @type {(hex: string) => string} */ (hex => `git --git-dir="repo" push -- "origin" "${hex}:refs/heads/build-cache"`),
    mergeBase: /** @type {(a: string, b: string) => string} */ ((a, b) => `git --git-dir="repo" merge-base ${a} ${b}`),
}

/** What `exec` answers for a command that printed `stdout` and exited 0. @type {(stdout: string) => IoResult<ExecResult>} */
const printed = stdout => ok({ stdout, stderr: '' })

/** What `exec` answers for a command that exited non-zero having said `stderr`. @type {(command: string, stderr: string) => IoResult<ExecResult>} */
const failed = (command, stderr) => error(ioError({ message: `Command failed: ${command}\n${stderr}` }))

/**
 * Runs an effect over the virtual filesystem with `exec` answering from
 * `script`, a command the script does not know being the failure it is on
 * a host with no `git`.
 *
 * @type {(root: Dir, script: ReadonlyMap<string, IoResult<ExecResult>>) => <T>(e: import('../../effects/types.ts').Effect<NodeOp, T, IoChannel>) => readonly [State, Result<T, IoChannel>]}
 */
const scripted = (root, script) => {
    /** @type {MemOperationMap<Exec, State>} */
    const execMap = {
        exec: command => state => [state, script.get(command) ?? error(ioError({ code: 'ENOENT', message: `unknown command ${command}` }))],
    }
    const run = partialRun(nodeCommands)({ ...virtualOperationMap, ...execMap })
    return e => run({ ...virtualAt(root)(pureOk(undefined))[0] })(e)
}

const remote = gitRemote(branch)

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
    // The decision reads the loose file itself and not the store: the same
    // object held by a borrowed directory would otherwise stand for the
    // corrupt file at the repository's own path, which Git refuses later. A
    // repository whose `alternates` names a donor holding the good object,
    // with junk at its own path: the write replaces the junk, and the
    // repository's own `objects/`, read alone, holds the object.
    writeObjectReplacesCorruptBesideDonor: () => {
        const gammaId = sha1.idOf('blob', gamma)
        const good = [u8ListToVecMsb(storedBytes(toArray(writeEnvelope('blob', gamma))))]
        const borrowing = setIn(ordinary(20, initConfig), ['repo', 'objects', 'info', 'alternates'], [u8ListToVecMsb(latin1('../../donor/objects\n'))])
        const withDonor = setIn(setIn(borrowing, objectPath('donor')(gammaId).split('/'), good), ['donor', 'objects', 'pack'], {})
        const corrupt = setIn(withDonor, objectPath(dir)(gammaId).split('/'), [u8ListToVecMsb(storedBytes(latin1('junk')))])
        const [s0, cas] = proposed(corrupt)
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const own = assertNotNullish(assertOk(virtual(s1)(readIn([objectsDir(dir)], 20)(gammaId))[1]))
        assertEq(own.type, 'blob')
    },
    // A chunk that is not whole bytes is refused as `fileCas.write` and
    // `contentKey` refuse it, before any object is written: the blob's bytes
    // would pad the chunk where the key hashed its bits.
    proposalWriteRefusesPartialByte: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
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
    // ## Taking content out
    //
    // `remove` takes one key out as one deletion commit and answers whether
    // there was one to take; a key that is not there, including one whose
    // path runs into a file, is `false` and no commit. `clear` takes the
    // whole `.cas` out and leaves the rest of the tree — the `README` beside
    // it — as it was; cleared twice, the second finds nothing.
    proposalRemoves: () => {
        const [s0, cas] = proposed(ordinary(20, initConfig))
        const [s1, r1] = virtual(s0)(cas.remove(alphaKey))
        assertEq(assertOk(r1), true)
        assertStructurallySame(spelled(assertOk(virtual(s1)(cas.list())[1])), spelled([betaKey]))
        assert(isNotFound(assertError(virtual(s1)(collectRead(cas.read(alphaKey)))[1])))
        const [s2, r2] = virtual(s1)(cas.remove(alphaKey))
        assertEq(assertOk(r2), false)
        assertStructurallySame(s2.root, s1.root)
        const first = assertNotNullish(proposalHead(s1))
        const [s3, r3] = virtual(s2)(cas.clear())
        assertEq(assertOk(r3), true)
        assertStructurallySame(assertOk(virtual(s3)(cas.list())[1]), [])
        assertStructurallySame(commitAt(s3, assertNotNullish(proposalHead(s3))).parents.map(hexText), [hexText(first)])
        const [s4, r4] = virtual(s3)(cas.clear())
        assertEq(assertOk(r4), false)
        assertStructurallySame(s4.root, s3.root)
        // The published snapshot has seen none of it.
        assertStructurallySame(spelled(assertOk(listed(s4.root))), spelled([alphaKey, betaKey]))
    },
    // Nothing to take out of a branch with no snapshot and no proposal, and
    // nothing where the key's path runs into a file.
    proposalRemovesNothing: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
        assertEq(assertOk(virtual(s0)(cas.remove(alphaKey))[1]), false)
        assertEq(assertOk(virtual(s0)(cas.clear())[1]), false)
        const [, ab, cd] = pathOf(alphaKey)
        const file = sha1.treeOf([entry('100644', ab, sha1.idOf('blob', alpha))])
        const [s1, cas1] = proposed(over([entry('40000', '.cas', file.id)], [file.object, sha1.object('blob', alpha)]))
        assertEq(assertOk(virtual(s1)(cas1.remove(alphaKey))[1]), false)
        // The key's directories are there and hold another file: nothing to
        // take out, and nothing written.
        const leaf = sha1.treeOf([entry('100644', 'other.txt', sha1.idOf('blob', alpha))])
        const mid = sha1.treeOf([entry('40000', cd, leaf.id)])
        const top = sha1.treeOf([entry('40000', ab, mid.id)])
        const [s2, cas2] = proposed(over([entry('40000', '.cas', top.id)], [leaf.object, mid.object, top.object, sha1.object('blob', alpha)]))
        const [s3, r] = virtual(s2)(cas2.remove(alphaKey))
        assertEq(assertOk(r), false)
        assertStructurallySame(s3.root, s2.root)
    },
    // The key's first directory holds another directory beside the key's
    // (a stray `zz/other.txt`, which is no key): the key's own directory
    // goes, and the one above it is rebuilt around what is left rather than
    // taken out.
    proposalRemovesBesideAnother: () => {
        const [, ab, cd, rest] = pathOf(alphaKey)
        const alphaId = sha1.idOf('blob', alpha)
        const leaf = sha1.treeOf([entry('100644', rest, alphaId)])
        const otherLeaf = sha1.treeOf([entry('100644', 'other.txt', alphaId)])
        const shared = sha1.treeOf([entry('40000', cd, leaf.id), entry('40000', 'zz', otherLeaf.id)].toSorted((a, b) => nameOf(a.name) < nameOf(b.name) ? -1 : 1))
        const root = sha1.treeOf([entry('40000', ab, shared.id)])
        const [s0, cas] = proposed(over([entry('40000', '.cas', root.id)], [leaf.object, otherLeaf.object, shared.object, root.object, sha1.object('blob', alpha)]))
        assertStructurallySame(spelled(assertOk(virtual(s0)(cas.list())[1])), spelled([alphaKey]))
        const [s1, r] = virtual(s0)(cas.remove(alphaKey))
        assertEq(assertOk(r), true)
        assertStructurallySame(assertOk(virtual(s1)(cas.list())[1]), [])
        assert(isNotFound(assertError(virtual(s1)(collectRead(cas.read(alphaKey)))[1])))
    },
    // A repository whose root is `.cas` alone, cleared: the root is left with
    // nothing, which is the empty tree, written and committed.
    proposalClearsToEmpty: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const [s2, r] = virtual(s1)(cas.clear())
        assertEq(assertOk(r), true)
        assertStructurallySame(assertOk(virtual(s2)(cas.list())[1]), [])
        const head = assertNotNullish(proposalHead(s2))
        const o = assertNotNullish(assertOk(virtual(s2)(readObject(dir, 20)(head))[1]))
        const tree = assertNotNullish(readCommit(o.payload)).headers[0][1]
        assertEq(nameOf(tree), hexText(sha1.idOf('tree', [])))
    },
    // ## Publication
    //
    // The ordinary case: the proposal descends from the published snapshot,
    // so it is pushed as it is, and afterwards the remote, the snapshot ref
    // and `snapshot` all say so, and the proposal ref is gone.
    publishFastForward: () => {
        const [s0, a] = published()
        const s1 = withTwo(s0)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, r] = publishedBy(s1)
        const pushed = assertNotNullish(assertOk(r))
        assertEq(pushed, p)
        assertEq(refAt(s2, remoteRef), p)
        assertEq(refAt(s2, snapshotRef(branch)), p)
        assertEq(proposalHead(s2), null)
        assertStructurallySame(publishedKeys(s2), spelled([alphaKey, betaKey, gammaKey, deltaKey]))
        // The two writes, chained, on the published commit: no merge was made.
        const [first] = commitAt(s2, p).parents
        assertStructurallySame(commitAt(s2, assertNotNullish(first)).parents.map(hexText), [hexText(a)])
    },
    // Nothing to publish: no proposal answers the snapshot, which is the
    // remote's; and no remote branch with no proposal answers `null`.
    publishNothing: () => {
        const [s0, a] = published()
        const [s1, r] = publishedBy(s0)
        assertEq(assertOk(r), a)
        assertEq(refAt(s1, remoteRef), a)
        const [s2, r2] = publishedBy(virtualAt(repository(initConfig, null, []))(pureOk(undefined))[0])
        assertEq(assertOk(r2), null)
        assertEq(refAt(s2, snapshotRef(branch)), null)
    },
    // A proposal that is the snapshot already — the ref points where the
    // remote is — is dropped and nothing is pushed.
    publishAlreadyPublished: () => {
        const [s0, a] = published()
        const [s1, w] = virtual(s0)(writeRef(latin1(proposalRef(branch)))(a))
        assertOk(w)
        const [s2, r] = publishedBy(s1)
        assertEq(assertOk(r), a)
        assertEq(proposalHead(s2), null)
    },
    // The remote has no branch yet: the proposal, a root commit, creates it.
    publishCreatesBranch: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, r] = publishedBy(s1)
        assertEq(assertOk(r), p)
        assertEq(refAt(s2, remoteRef), p)
        assertStructurallySame(publishedKeys(s2), spelled([gammaKey]))
    },
    // The todo's table. Base `A` holds `A0, A1` (alpha, beta); the proposal
    // `B` adds `B0, B1` (gamma, delta); the remote has moved to `C`, which
    // deleted `A0` and added `C0` (epsilon). The result is `A1, B0, B1, C0`:
    // one merge commit with `C` and `B` as parents, and `A0` not restored.
    publishReconciles: () => {
        const [s0, a] = published()
        const s1 = withTwo(s0)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, c] = other(s1, a, cas => step(cas.remove(alphaKey), () => cas.write(payload([latin1('epsilon\n')]))))
        const [s3, r] = publishedBy(remoteAt(s2, c))
        const m = assertNotNullish(assertOk(r))
        assertStructurallySame(commitAt(s3, m).parents.map(hexText), [hexText(c), hexText(p)])
        assertStructurallySame(publishedKeys(s3), spelled([betaKey, gammaKey, deltaKey, epsilonKey]))
        assertEq(refAt(s3, remoteRef), m)
        assertEq(proposalHead(s3), null)
    },
    // The same, with the remote moving between the fetch and the push: the
    // first push is refused, the second attempt fetches `C`, reconciles and
    // lands. The proposal's ancestry is kept — the merge commit's second
    // parent is the proposal — and the result is the table's.
    publishRetries: () => {
        const [s0, a] = published()
        const s1 = withTwo(s0)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, c] = other(s1, a, cas => step(cas.remove(alphaKey), () => cas.write(payload([latin1('epsilon\n')]))))
        const [s3, w] = virtual(s2)(setRef(pendingRef)(c))
        assertOk(w)
        const [s4, r] = publishedBy(s3)
        const m = assertNotNullish(assertOk(r))
        assertStructurallySame(commitAt(s4, m).parents.map(hexText), [hexText(c), hexText(p)])
        assertStructurallySame(publishedKeys(s4), spelled([betaKey, gammaKey, deltaKey, epsilonKey]))
        assertEq(refAt(s4, pendingRef), null)
        assertEq(proposalHead(s4), null)
    },
    // Both added the same content: one stored object, and nothing left to
    // push once the remote's copy is fetched — the proposal is dropped and
    // the snapshot is the remote's commit.
    publishIdenticalAdditions: () => {
        const [s0, a] = published()
        const [s1, cas] = proposed(s0.root)
        const [s2, w] = wrote(s1, cas, [gamma])
        assertOk(w)
        const [s3, c] = other(s2, a, cas => cas.write(payload([gamma])))
        const [s4, r] = publishedBy(remoteAt(s3, c))
        assertEq(assertOk(r), c)
        assertEq(refAt(s4, remoteRef), c)
        assertEq(proposalHead(s4), null)
        assertStructurallySame(publishedKeys(s4), spelled([alphaKey, betaKey, gammaKey]))
    },
    // The remote added and then deleted what the proposal adds: its net
    // change to that path is empty, and the addition lands. And the
    // proposal deleted what the remote deleted too: nothing to take out
    // there, and the deletion stands.
    publishNetChanges: () => {
        const [s0, a] = published()
        const [s1, cas] = proposed(s0.root)
        const [s2, w] = wrote(s1, cas, [gamma])
        assertOk(w)
        const [s3, rm] = virtual(s2)(cas.remove(alphaKey))
        assertEq(assertOk(rm), true)
        const [s4, c] = other(s3, a, o => {
            const added = history(o.write(payload([gamma])))
            const removed = historyStep(added, () => o.remove(gammaKey))
            return historyStep(removed, () => o.remove(alphaKey))
        })
        const [s5, r] = publishedBy(remoteAt(s4, c))
        const m = assertNotNullish(assertOk(r))
        assert(m !== c)
        assertStructurallySame(publishedKeys(s5), spelled([betaKey, gammaKey]))
    },
    // An old commit the remote's cleanup already descends from, as the
    // proposal: merging it restores nothing, since nothing changed between
    // the base and the proposal. Nothing is pushed.
    publishOldCommitRestoresNothing: () => {
        const [s0, a] = published()
        const [s1, c] = other(s0, a, cas => cas.remove(alphaKey))
        const [s2, w] = virtual(remoteAt(s1, c))(writeRef(latin1(proposalRef(branch)))(a))
        assertOk(w)
        const [s3, r] = publishedBy(s2)
        assertEq(assertOk(r), c)
        assertStructurallySame(publishedKeys(s3), spelled([betaKey]))
        assertEq(proposalHead(s3), null)
    },
    // Two roots: the remote branch is created by another writer while this
    // one's root is being pushed. They share no ancestor and reconcile over
    // the empty map — both additions, one merge commit with both roots as
    // parents.
    publishConcurrentRoots: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
        const [s1, w] = wrote(s0, cas, [gamma])
        assertOk(w)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, rootC] = other(s1, null, o => o.write(payload([latin1('epsilon\n')])))
        const [s3, pend] = virtual(s2)(setRef(pendingRef)(rootC))
        assertOk(pend)
        const [s4, r] = publishedBy(s3)
        const m = assertNotNullish(assertOk(r))
        assertStructurallySame(commitAt(s4, m).parents.map(hexText), [hexText(rootC), hexText(p)])
        assertStructurallySame(publishedKeys(s4), spelled([gammaKey, epsilonKey]))
    },
    // A proposal that clears a branch whose root is `.cas` alone, against a
    // remote that moved without changing the map: every entry taken out of
    // the remote's tree leaves the empty tree, which is published.
    publishClearsToEmpty: () => {
        const [s0, cas] = proposed(repository(initConfig, null, []))
        const [s1, w] = wrote(s0, cas, [alpha])
        assertOk(w)
        const [s2, r1] = publishedBy(s1)
        const a = assertNotNullish(assertOk(r1))
        const [s3, cl] = virtual(s2)(cas.clear())
        assertEq(assertOk(cl), true)
        const [s4, c] = other(s3, a, o => step(o.write(payload([gamma])), () => o.remove(gammaKey)))
        const [s5, r2] = publishedBy(remoteAt(s4, c))
        const m = assertNotNullish(assertOk(r2))
        assert(m !== c)
        assertStructurallySame(publishedKeys(s5), [])
    },
    // The same key over two blobs in the proposal and in the base: a
    // collision or a corrupt store, refused rather than reconciled.
    publishCollision: () => {
        const [s0, a] = published()
        const collided = casEntry(alphaKey, '100644', sha1.idOf('blob', beta))
        const t = sha1.treeOf(collided.root)
        const c1 = sha1.commit(t.id)
        const [s1, w] = virtual(s0)(writeRef(latin1(proposalRef(branch)))(sha1.idOf('commit', latin1([`tree ${hexText(t.id)}`, `parent ${hexText(a)}`, 'author A <a@b> 1 +0000', 'committer A <a@b> 1 +0000', '', 'm', ''].join('\n')))))
        assertOk(w)
        const payloadP = latin1([`tree ${hexText(t.id)}`, `parent ${hexText(a)}`, 'author A <a@b> 1 +0000', 'committer A <a@b> 1 +0000', '', 'm', ''].join('\n'))
        const files = [...collided.objects, t.object, sha1.object('commit', payloadP), sha1.object('commit', c1)]
        const root = files.reduce((d, [path, content]) => setIn(d, path.split('/'), content), s1.root)
        const [s2, c] = other({ ...s1, root }, a, o => o.write(payload([latin1('epsilon\n')])))
        const [, r] = publishedBy(remoteAt(s2, c))
        assertEq(codeOf(r), casEntryCode)
    },
    // A remote that refuses every push: after `maxAttempts` the publication
    // is refused, and the proposal ref holds what the last attempt would have
    // pushed, so the next publication starts there.
    publishGivesUp: () => {
        const [s0] = published()
        const s1 = withTwo(s0)
        const p = assertNotNullish(proposalHead(s1))
        const [s2, r] = publishedBy(s1, unyielding)
        assertEq(codeOf(r), publishAttemptsCode)
        assertEq(proposalHead(s2), p)
        assert(maxAttempts > 1)
    },
    // A branch whose name is no ref name is refused before anything is
    // opened.
    publishBadBranchName: () => {
        const o = runPure(publish(fakeRemote, { dir, remote: 'origin', branch: 'a..b' }, author))
        assert(o.length === 1, o)
        assertEq(codeOf(o[0]), snapshotHeadCode)
    },
    // ## The `git` remote
    //
    // `fetch`: the branch is there, so `ls-remote` prints it and `fetch`
    // updates the snapshot ref — here written by the script's fixture, as
    // `git` would write it — and the commit is read off that ref. The
    // branch is not there: `ls-remote` prints nothing, the stale snapshot ref
    // is deleted, and the answer is `null`.
    gitRemoteFetches: () => {
        const root = ordinary(20, initConfig)
        const [s0] = virtualAt(root)(pureOk(undefined))
        const a = assertNotNullish(refAt(s0, snapshotRef(branch)))
        const present = new Map([[git.lsRemote, printed(`${hexText(a)}\trefs/heads/build-cache\n`)], [git.fetch, printed('')]])
        const [, r] = scripted(root, present)(remote.fetch())
        assertEq(assertOk(r), a)
        const absent = new Map([[git.lsRemote, printed('')]])
        const [s1, r1] = scripted(root, absent)(remote.fetch())
        assertEq(assertOk(r1), null)
        assertEq(refAt(s1, snapshotRef(branch)), null)
        // A `fetch` that fails is the error it is.
        const broken = new Map([[git.lsRemote, printed(`${hexText(a)}\trefs/heads/build-cache\n`)], [git.fetch, failed(git.fetch, 'fatal: unable to access')]])
        const e = assertError(scripted(root, broken)(remote.fetch())[1])
        assert(e[0] === 'ioError' && e[1].message.includes('unable to access'), e)
    },
    // `push`: landed is `true`; a `[rejected]` non-fast-forward is `false`;
    // any other failure, and a host with no `exec` at all, is the error it is.
    gitRemotePushes: () => {
        const root = ordinary(20, initConfig)
        const [s0] = virtualAt(root)(pureOk(undefined))
        const a = assertNotNullish(refAt(s0, snapshotRef(branch)))
        const cmd = git.push(hexText(a))
        assertEq(assertOk(scripted(root, new Map([[cmd, printed('')]]))(remote.push(a))[1]), true)
        const rejected = `To ../remote.git\n ! [rejected]        ${hexText(a)} -> build-cache (non-fast-forward)\nerror: failed to push some refs to '../remote.git'\n`
        assertEq(assertOk(scripted(root, new Map([[cmd, failed(cmd, rejected)]]))(remote.push(a))[1]), false)
        const fetchFirst = ` ! [rejected]        ${hexText(a)} -> build-cache (fetch first)\n`
        assertEq(assertOk(scripted(root, new Map([[cmd, failed(cmd, fetchFirst)]]))(remote.push(a))[1]), false)
        const hook = ` ! [remote rejected] ${hexText(a)} -> build-cache (pre-receive hook declined)\n`
        assertEq(codeOf(scripted(root, new Map([[cmd, failed(cmd, hook)]]))(remote.push(a))[1]), undefined)
        const e = assertError(virtualAt(root)(remote.push(a))[1])
        assertEq(e[0], 'notImplemented')
        // A host that cannot run the command at all — no `git` on it — reports
        // no `Command failed`, and that is the error it is.
        assertEq(codeOf(scripted(root, new Map())(remote.push(a))[1]), 'ENOENT')
    },
    // `mergeBase`: the id printed; exit 1 having said nothing is no base;
    // a `fatal` is the error it is; and output that is no id is refused.
    gitRemoteMergeBase: () => {
        const root = ordinary(20, initConfig)
        const [s0] = virtualAt(root)(pureOk(undefined))
        const a = assertNotNullish(refAt(s0, snapshotRef(branch)))
        const b = sha1.idOf('blob', beta)
        const cmd = git.mergeBase(hexText(a), hexText(b))
        assertEq(assertOk(scripted(root, new Map([[cmd, printed(`${hexText(b)}\n`)]]))(remote.mergeBase(a, b))[1]), b)
        assertEq(assertOk(scripted(root, new Map([[cmd, printed(hexText(b))]]))(remote.mergeBase(a, b))[1]), b)
        assertEq(assertOk(scripted(root, new Map([[cmd, failed(cmd, '')]]))(remote.mergeBase(a, b))[1]), null)
        const e = assertError(scripted(root, new Map([[cmd, failed(cmd, 'fatal: Not a valid object name\n')]]))(remote.mergeBase(a, b))[1])
        assert(e[0] === 'ioError' && e[1].message.includes('fatal'), e)
        assertEq(codeOf(scripted(root, new Map([[cmd, printed('nonsense\n')]]))(remote.mergeBase(a, b))[1]), gitOutputCode)
    },
    // An argument no quoting makes safe for both shells: every operation
    // refuses before any command runs. A Windows path with its backslashes
    // quotes as it is.
    gitRemoteQuotes: () => {
        for (const bad of ['a"b', 'a$b', 'a%b', 'a!b', 'a`b', 'a\nb', 'a\\\\b', 'a\\']) {
            const r = gitRemote({ dir, remote: bad, branch: 'build-cache' })
            const o = runPure(r.mergeBase(alphaKey, alphaKey))
            assert(o.length === 1, bad)
            assertEq(codeOf(o[0]), shellArgumentCode, bad)
            const f = runPure(r.fetch())
            assert(f.length === 1, bad)
            assertEq(codeOf(f[0]), shellArgumentCode, bad)
            const p = runPure(r.push(alphaKey))
            assert(p.length === 1, bad)
            assertEq(codeOf(p[0]), shellArgumentCode, bad)
        }
        const windows = gitRemote({ dir: 'C:\\Users\\Jo Doe\\repo\\.git', remote: 'origin', branch: 'build-cache' })
        const o = runPure(windows.mergeBase(alphaKey, alphaKey))
        assertEq(o.length, 0, 'expected a command to run')
        // A branch name Git accepts and a shell would read as two commands:
        // the push's refspec reaches `exec` quoted, so the `;` is an argument's
        // character and not the shell's. The script knows only the quoted
        // spelling, and the push lands through it.
        const odd = gitRemote({ dir, remote: 'origin', branch: 'x;id' })
        const quotedPush = `git --git-dir="repo" push -- "origin" "${hexText(alphaKey)}:refs/heads/x;id"`
        assertEq(assertOk(scripted(ordinary(20, initConfig), new Map([[quotedPush, printed('')]]))(odd.push(alphaKey))[1]), true)
        // A remote name `git remote add -- …` accepts and `git` would read as
        // an option: it follows the `--` in the command, so `ls-remote` is
        // asked about the remote `--upload-pack=x` rather than run with it.
        const dashed = gitRemote({ dir, remote: '--upload-pack=x', branch: 'build-cache' })
        const dashedList = 'git --git-dir="repo" ls-remote -- "--upload-pack=x" "refs/heads/build-cache"'
        assertEq(assertOk(scripted(ordinary(20, initConfig), new Map([[dashedList, printed('')]]))(dashed.fetch())[1]), null)
    },
}
