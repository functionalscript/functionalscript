/**
 * @import { Effect, IoChannel, IoErrorInfo } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Dirent, FileStat, Mkdir, ReadFile, ReadWhole, Readdir, Rename, Rm, Stat, WriteExclusive } from '../../effects/node/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Oid } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Dirs, Root } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run as mockRun } from '../../effects/mock/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { fromCodePointList, fromVec } from '../../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { maxLengthBytes, msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { toHex, tryFromHex } from '../oid/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { badNameCode, badPackedCode, headKindCode, idWidthCode, linkedDirCode, lossyNameCode, lossyNameMessage, maxLookups, outsideRefsCode, packedHeadCode, packedTwiceCode, refPrefixCode, tryResolve, tryRoots, tryWrite, unspellableNameCode, zeroIdCode } from './module.f.mjs'

const toVec = u8ListToVec(msb)

/**
 * A main worktree's two directories, which are one directory: what a caller
 * passes for a repository with no linked worktree, and what every case below
 * uses except the ones about a worktree.
 *
 * @type {(d: string) => Dirs}
 */
const one = d => ({ gitdir: d, common: d })

/** A commit id, and a second one so a shadowed name is told from its shadow. */
const a = /** @type {const} */ ('8dd3225810cee59495e415a45957c2fdc0030e22')

const b = /** @type {const} */ ('b1c209491856b9e26208165c5cafbf07ae2e7937')

/** A tag object's id, which is what a tag ref names. */
const t = /** @type {const} */ ('a48bd2c1bb20c1a3457dfa663047827f1e48ad4e')

/**
 * Sixty-four hex digits, which is an id in a SHA-256 repository and no id at all
 * in a SHA-1 one. The same string is used both ways below — refused at
 * `oidBytes` 20 and written at 32 — so the width is asserted to be the
 * repository's rather than the id's.
 */
const wide = /** @type {const} */ (`${a}${b.slice(0, 24)}`)

/** @type {(s: string) => readonly Vec[]} */
const file = s => [toVec(latin1(s))]

/** A ref file as Git writes one: the id and an LF. */
const ref = /** @type {(hex: string) => readonly Vec[]} */ (hex => file(`${hex}\n`))

/**
 * Runs an effect over a virtual filesystem and answers the filesystem it left
 * beside its result, which is what a *write* has to be asked about: its value is
 * `void` and everything the call did is in the directory.
 *
 * @type {<T>(root: Dir, e: Effect<NodeOp, T, IoChannel>) => readonly [Dir, Result<T, IoChannel>]}
 */
const ran = (root, e) => {
    const [state, r] = virtual({ ...emptyState, root })(e)
    return [state.root, r]
}

/**
 * The same, unwrapped and without the filesystem: what a case about a *read*
 * asks, since it wants the answer rather than the channel or the directory.
 *
 * @type {<T>(root: Dir, e: Effect<NodeOp, T, IoChannel>) => T}
 */
const run = (root, e) => {
    const [, r] = ran(root, e)
    assert(r[0] === 'ok')
    return r[1]
}

/**
 * An id from the hex it is written as, which is how every fixture here spells
 * one.
 *
 * @type {(hex: string) => Oid}
 */
const idOf = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null, hex)
    return i
}

/**
 * Writes `name` at the id `hex` into a copy of `root`, and answers the
 * filesystem left behind beside the outcome.
 *
 * @type {(root: Dir, name: string, hex: string) => readonly [Dir, Result<void, IoChannel>]}
 */
const wrote = (root, name, hex) => ran(root, tryWrite(one(''), 20)(latin1(name))(idOf(hex)))

/**
 * The `IoError` a refused write comes back with: every refusal here has that
 * shape, so a case asserts the code and the message instead of unwrapping three
 * tags.
 *
 * @type {(r: Result<void, IoChannel>) => IoErrorInfo}
 */
const writeRefusal = r => {
    assert(r[0] === 'error')
    const e = r[1]
    assert(e[0] === 'ioError')
    return e[1]
}

/**
 * A root as a name and a hex id, for comparing against a table.
 *
 * The name is decoded as UTF-8 and not a byte per code point, because that is
 * what it is: the bytes of a path, which the walk read from a directory
 * listing. A byte-per-code-point rendering would spell `é` as `Ã©` and put a
 * table of expected names a decoding away from the names Git shows.
 *
 * @type {(r: Root) => readonly [string, string]}
 */
const seen = r => {
    const n = fromVec(toVec(r.name))
    assert(n !== null, r.name)
    return [n, codePointListToString(toHex(r.id))]
}

/**
 * Asserts the roots are exactly these name and id pairs, as a set.
 *
 * As a set and not a sequence, because {@link tryRoots} answers the walk's
 * order and then the file's and that order means nothing — a case asserting
 * it would pin a detail rather than a rule. What *is* a rule is that a name
 * appears once however many files hold it, so that is asserted here too.
 *
 * @type {(rs: Nullable<readonly Root[]>, expected: readonly (readonly [string, string])[]) => void}
 */
const sameRoots = (rs, expected) => {
    assert(rs !== null)
    const got = rs.map(seen)
    const names = got.map(g => g[0])
    assert(names.every((n, i) => names.indexOf(n) === i), ['a name twice', names])
    assertEq(got.length, expected.length)
    for (const [n, h] of expected) {
        assert(got.some(g => g[0] === n && g[1] === h), ['missing', n, h])
    }
}

/**
 * A repository as Git leaves one after `git pack-refs --all` and a later
 * update: everything packed, and `refs/heads/master` written loose again at
 * another id, so the two files disagree the way they do in ordinary use.
 *
 * @type {Dir}
 */
const shadowed = {
    'packed-refs': file(`# pack-refs with: peeled fully-peeled sorted \n${b} refs/heads/master\n${a} refs/heads/other\n${t} refs/tags/v1\n^${a}\n`),
    refs: { heads: { master: ref(a) } },
}

/** A repository with loose refs only, nested one deeper under `remotes`. */
/** @type {Dir} */
const loose = {
    refs: {
        heads: { master: ref(a), other: ref(b) },
        remotes: { origin: { main: ref(a) } },
        tags: { v1: ref(t) },
    },
}

/** @type {(root: Dir, name: string) => Nullable<Oid>} */
const resolved = (root, name) => run(root, tryResolve(one(''), 20)(latin1(name)))

/** @type {(root: Dir, name: string) => string} */
const hexOf = (root, name) => {
    const i = resolved(root, name)
    assert(i !== null, name)
    return codePointListToString(toHex(i))
}

/**
 * A name as its UTF-8 bytes, which is what a name outside ASCII needs and
 * {@link latin1} cannot give: `é` is one byte to `latin1` and the two bytes
 * `0xC3 0xA9` on a filesystem, and those are what Git stores.
 *
 * @type {(s: string) => readonly number[]}
 */
const utf8 = s => toArray(fromCodePointList(stringToCodePointList(s)))

/** @type {(dir: string, root: Dir, name: readonly number[]) => Nullable<Oid>} */
const resolvedIn = (dir, root, name) => run(root, tryResolve(one(dir), 20)(name))

/** @type {(dir: string, root: Dir, name: readonly number[]) => string} */
const hexOfIn = (dir, root, name) => {
    const i = resolvedIn(dir, root, name)
    assert(i !== null, name)
    return codePointListToString(toHex(i))
}

/**
 * A chain of `hops` symbolic refs ending at `refs/heads/master`, so
 * `refs/heads/s1` is `hops` hops away from an id.
 *
 * @type {(hops: number) => Dir}
 */
const chain = hops => {
    /** @type {Dir} */
    let heads = { master: ref(a) }
    for (let i = 1; i <= hops; i += 1) {
        const target = i === hops ? 'refs/heads/master' : `refs/heads/s${i + 1}`
        heads = { ...heads, [`s${i}`]: file(`ref: ${target}\n`) }
    }
    return { refs: { heads } }
}

/**
 * A directory holding one ref of the given name at the given id: under `refs/`
 * where the name has slashes in it, and at the top otherwise.
 *
 * The name is a leading parameter rather than a capture of the loop that walks
 * the names, so this is closed and at module scope (§3.3).
 *
 * @type {(name: string) => (hex: string) => Dir}
 */
const nameAt = name => hex =>
    name.includes('/')
        ? { refs: { [name.split('/')[1]]: { [name.split('/')[2]]: ref(hex) } } }
        : { [name]: ref(hex) }

/** The one file whose size has no bound, and so the one read in windows. */
const packedRefs = /** @type {const} */ ('packed-refs')

/**
 * A handler that says the file is not there.
 *
 * @type {<S, T>(path: string) => (state: S) => readonly [S, Result<T, IoChannel>]}
 */
const missing = path => state => [state, error(ioError({ code: 'ENOENT', message: path }))]

/**
 * A `stat` no case below should reach: the lookup asks one only where a read
 * answered bytes that are no ref, so a case that gets here answers a code its
 * assertions do not take.
 *
 * @type {(path: string) => (state: any) => readonly [any, Result<FileStat, IoChannel>]}
 */
const statUnasked = path => state => [state, error(ioError({ code: 'EIO', message: path }))]


/**
 * What `stat` answers about an entry, as the two questions it is.
 *
 * @type {(isFile: boolean, isDirectory: boolean) => FileStat}
 */
const kind = (isFile, isDirectory) => ({ size: 41, isFile, isDirectory })

/** @type {(name: string, parentPath: string, isFile: boolean, isDirectory: boolean) => Dirent} */
const dirent = (name, parentPath, isFile, isDirectory) => ({ name, parentPath, isFile, isDirectory })

/**
 * A host whose `refs/heads` holds `master` as a real loose ref and `entry` beside
 * it as an entry the listing cannot classify — `isFile: false` and
 * `isDirectory: false`, which is what node answers for a FIFO and for every
 * symlink alike, since `Dirent` does not follow one. `answer` is what a `stat` of
 * it says: a kind, or the code the `stat` fails with.
 *
 * The virtual filesystem has neither links nor FIFOs, which is why these cases
 * use a host rather than a `Dir`.
 *
 * @type {(entry: string, answer: FileStat | string) => MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>}
 */
const kindHost = (entry, answer) => ({
    readWhole: missing,
    readFile: path => log => [
        [...log, `readFile ${path}`],
        // the link's target is a ref file, which is what makes `alias` a root and
        // what a read of the FIFO would never get back to
        path === 'refs/heads/master' || path === `refs/heads/${entry}`
            ? ok(toVec(latin1(`${a}\n`)))
            : error(ioError({ code: 'ENOENT', message: path })),
    ],
    readdir: path => log => [
        [...log, `readdir ${path}`],
        ok(path === 'refs'
            ? [dirent('heads', path, false, true)]
            : path === 'refs/heads'
                ? [dirent('master', path, true, false), dirent(entry, path, false, false)]
                : []),
    ],
    stat: path => log => [
        [...log, `stat ${path}`],
        typeof answer === 'string'
            ? error(ioError({ code: answer, message: path }))
            : ok(answer),
    ],
})

/**
 * The roots such a host answers, and the log of what was asked of it.
 *
 * @type {(entry: string, answer: FileStat | string) => readonly [readonly string[], Result<Nullable<readonly Root[]>, IoChannel>]}
 */
const rootsBy = (entry, answer) =>
    mockRun(kindHost(entry, answer))(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))

/**
 * A host whose gitdir holds `HEAD` and `ORIG_HEAD` as a listing reports them —
 * `HEAD` a file or not, `ORIG_HEAD` never — and answers `bytes` for a read of
 * either, which is what a read of a *link* to a file outside the repository
 * gives back.
 *
 * The bytes lead the kind so this closes over nothing: one function for the whole
 * file instead of a fresh closure per case (`fjs/AGENTS.md` §3.3).
 *
 * @type {(bytes: readonly number[]) => (headIsFile: boolean) => MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>}
 */
const linkedHeadHost = bytes => headIsFile => ({
    stat: statUnasked,
    // the read follows the link, which is the whole problem
    readFile: path => state => [
        state,
        path === 'HEAD' || path === 'ORIG_HEAD'
            ? ok(toVec(bytes))
            : error(ioError({ code: 'ENOENT', message: path })),
    ],
    readWhole: missing,
    readdir: path => state => [
        state,
        ok(path === '' ? [
            dirent('HEAD', path, headIsFile, false),
            dirent('ORIG_HEAD', path, false, false),
        ] : []),
    ],
})

/**
 * The `IoError` a listing refuses with, over the virtual filesystem: every
 * refusal here has that shape, so a case asserts the code and the message
 * instead of unwrapping three tags.
 *
 * @type {(root: Dir, dirs: Dirs) => IoErrorInfo}
 */
const rootsRefusal = (root, dirs) => {
    const [, r] = virtual({ ...emptyState, root })(tryRoots(dirs, 20))
    assert(r[0] === 'error')
    const e = r[1]
    assert(e[0] === 'ioError')
    return e[1]
}

/**
 * Asserts that a listing of `root` refuses with this code and this message: the
 * code leads, so a case binds one and drives several repositories through it.
 *
 * @type {(code: string) => (root: Dir, dirs: Dirs, message: string) => void}
 */
const refusesWith = code => (root, dirs, message) => {
    const e = rootsRefusal(root, dirs)
    assertEq(e.code, code)
    assertEq(e.message, message)
}

/**
 * A host that *reads* a directory instead of failing: `refs/heads` answers bytes
 * a listing of it might hold, `packed-refs` answers `packed`, and a `stat` of
 * anything answers `statted` — a kind, or the failure it comes back with.
 *
 * Both are leading parameters, so this closes over nothing and lives here rather
 * than inside the one case that uses it.
 *
 * @type {(packed: readonly number[], statted: Result<FileStat, IoChannel>) => MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>}
 */
const readsADirectoryHost = (packed, statted) => ({
    readFile: path => log => [
        [...log, `readFile ${path}`],
        path === 'refs/heads'
            ? ok(toVec(latin1('master\n')))
            : error(ioError({ code: 'ENOENT', message: path })),
    ],
    readdir: missing,
    stat: path => log => [[...log, `stat ${path}`], statted],
    readWhole: path => log => [
        [...log, `readWhole ${path}`],
        path === packedRefs
            ? ok([toVec(packed)])
            : error(ioError({ code: 'ENOENT', message: path })),
    ],
})

export const proof = {
    // The loose refs, including one nested two directories down, and no
    // `packed-refs` at all — a repository that has never been packed.
    looseOnly: () => {
        sameRoots(run(loose, tryRoots(one(''), 20)), [
            ['refs/heads/master', a],
            ['refs/heads/other', b],
            ['refs/remotes/origin/main', a],
            ['refs/tags/v1', t],
        ])
    },
    // A loose ref shadows the packed line of the same name, and the name
    // appears once. Measured on Git 2.43.0: with `refs/heads/master` packed
    // at one id and a loose file holding another, `git show-ref` and
    // `git rev-parse` both answer the loose one.
    shadow: () => {
        sameRoots(run(shadowed, tryRoots(one(''), 20)), [
            ['refs/heads/master', a],
            ['refs/heads/other', a],
            ['refs/tags/v1', t],
        ])
    },
    // The shadow is by existing, not by being good. A loose file that is no
    // ref does not fall back to the packed line: Git refuses the whole
    // listing with `bad ref refs/heads/master`, and so does this.
    shadowBroken: () => {
        for (const bytes of ['not an id\n', '', `${a.slice(0, 39)}\n`]) {
            // A good ref after the broken one, so the refusal is the
            // listing's and not just the last word: once a file under
            // `refs/` is no ref, nothing later rescues it.
            /** @type {Dir} */
        /** @type {Dir} */
        const heads = { master: file(bytes), other: ref(b) }
            assertEq(run({ ...shadowed, refs: { heads } }, tryRoots(one(''), 20)), null)
        }
    },
    // A file under `refs/` whose name is no ref name gets one of two answers,
    // and Git gives the same two. Measured on Git 2.43.0 by writing a valid id
    // into each name under `refs/heads/` and asking `git show-ref`: `.hidden`
    // and `x.lock` are skipped and it exits 0, while every other name here
    // exits 128 with `bad ref refs/heads/<name>` — the message a loose file
    // whose *contents* are no ref gets. `check-ref-format` refuses all eight,
    // so it is the wrong line to cut a listing on.
    skipped: () => {
        /** @type {Dir} */
        const heads = { master: ref(a), '.hidden': ref(b), 'x.lock': ref(b) }
        sameRoots(run({ refs: { heads } }, tryRoots(one(''), 20)), [['refs/heads/master', a]])
        // And a *directory* of either name is skipped whole, refs and all, which
        // is Git's too: measured with `refs/heads/.hidden/v1` holding a valid id,
        // `show-ref` and `for-each-ref` list `refs/heads/master` alone at exit 0.
        /** @type {Dir} */
        const dirs = { master: ref(a), '.hidden': { v1: ref(b) }, 'x.lock': { v1: ref(b) } }
        sameRoots(run({ refs: { heads: dirs } }, tryRoots(one(''), 20)), [['refs/heads/master', a]])
        // The name settles it before the directory is *listed*, which is what
        // makes that a skip rather than a walk that happens to find nothing: a
        // child of `.hidden` carries the component too, so judging children alone
        // would answer the same list — but it would read the directory to do it,
        // and a listing of it can refuse on its own account. Here it answers one
        // name twice, which `lossyNameCode` refuses wherever this module looks,
        // and Git skips the subtree without looking at all.
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readWhole: missing,
            readFile: path => log => [
                [...log, `readFile ${path}`],
                path === 'refs/heads/master'
                    ? ok(toVec(latin1(`${a}\n`)))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'refs'
                    ? [dirent('heads', path, false, true)]
                    : path === 'refs/heads'
                        ? [dirent('master', path, true, false), dirent('.hidden', path, false, true)]
                        : path === 'refs/heads/.hidden'
                            // one name twice, which is a refusal where it is read
                            ? [dirent('\uFFFD', path, true, false), dirent('\uFFFD', path, true, false)]
                            : []),
            ],
            stat: statUnasked,
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))
        assert(r[0] === 'ok', r)
        sameRoots(r[1], [['refs/heads/master', a]])
        assert(!log.includes('readdir refs/heads/.hidden'), log)
    },
    // The other six refuse the listing, each naming the file.
    badName: () => {
        for (const bad of ['bad.', 'a..b', 'a@{b', 'has space', 'tilde~x', 'caret^x']) {
            /** @type {Dir} */
            const heads = { master: ref(a), [bad]: ref(b) }
            refusesWith(badNameCode)(
                { refs: { heads } }, one(''), `refs/heads/${bad} is not a ref name`)
        }
        // And the lookup does not refuse: a name that is no ref name is `null`
        // there, before any file is opened. See `resolveBadNameReadsNothing`.
        assertEq(resolved({ refs: { heads: { 'bad.': ref(b) } } }, 'refs/heads/bad.'), null)
    },
    // A symbolic loose ref is answered resolved, which is what
    // `git show-ref` lists for one, and the listing reads `packed-refs` once
    // while doing it: the walk records the ref and the pass after the packed
    // read resolves it against the lines already in hand, rather than each
    // pending ref reading the file for itself.
    symbolicRoot: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                path === 'refs/heads/master'
                    ? ok(toVec(latin1(`${a}\n`)))
                    : path === 'refs/heads/sym'
                        ? ok(toVec(latin1('ref: refs/heads/master\n')))
                        : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'refs'
                    ? [dirent('heads', path, false, true)]
                    : path === 'refs/heads'
                        ? [dirent('master', path, true, false), dirent('sym', path, true, false)]
                        : []),
            ],
            readWhole: path => log => [
                [...log, `readWhole ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            stat: statUnasked,
        }
        const [log, rs] = mockRun(host)(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))
        assert(rs[0] === 'ok')
        sameRoots(rs[1], [['refs/heads/master', a], ['refs/heads/sym', a]])
        assertEq(log.filter(l => l === `readWhole ${packedRefs}`).length, 1)
        // And where the target has no loose file — the case that would send a
        // resolution to the packed lines — it is still one read, because the
        // pass is seeded with the file the listing already read.
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const dangling = {
            ...host,
            readFile: path => log2 => [
                [...log2, `readFile ${path}`],
                path === 'refs/heads/sym'
                    ? ok(toVec(latin1('ref: refs/heads/gone\n')))
                    : path === 'refs/heads/master'
                        ? ok(toVec(latin1(`${a}\n`)))
                        : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readWhole: path => log2 => [
                [...log2, `readWhole ${path}`],
                path === packedRefs
                    ? ok([toVec(latin1(`${b} refs/heads/other\n`))])
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [log2, rs2] = mockRun(dangling)(/** @type {readonly string[]} */ ([]))(
            tryRoots(one(''), 20))
        assert(rs2[0] === 'ok', rs2)
        sameRoots(rs2[1], [['refs/heads/master', a], ['refs/heads/other', b]])
        assertEq(log2.filter(l => l === `readWhole ${packedRefs}`).length, 1)
        /** @type {Dir} */
        const heads = { master: ref(a), sym: file('ref: refs/heads/master\n') }
        sameRoots(run({ refs: { heads } }, tryRoots(one(''), 20)), [
            ['refs/heads/master', a],
            ['refs/heads/sym', a],
        ])
    },
    // A symbolic loose ref whose target is nowhere contributes no root and
    // does not spoil the listing: it is a dangling symref, which Git skips
    // with a warning rather than refusing the file.
    danglingRoot: () => {
        /** @type {Dir} */
        const heads = { master: ref(a), sym: file('ref: refs/heads/gone\n') }
        sameRoots(run({ refs: { heads } }, tryRoots(one(''), 20)), [['refs/heads/master', a]])
    },
    // The three states of `packed-refs` are three answers: absent is a
    // repository with nothing packed, present and malformed is one Git
    // refuses, and an absent `refs/` is a repository whose refs are all
    // packed rather than an error.
    packedStates: () => {
        assertEq(run({ 'packed-refs': file('# hello\n'), refs: {} }, tryRoots(one(''), 20)), null)
        // Everything packed and `refs/` left behind empty, which is what
        // `git pack-refs --all` leaves: the directory stays, measured.
        sameRoots(
            run({ 'packed-refs': file(`${a} refs/heads/master\n`), refs: { heads: {} } }, tryRoots(one(''), 20)),
            [['refs/heads/master', a]])
        // Neither file: a repository with no refs at all.
        sameRoots(run({ refs: {} }, tryRoots(one(''), 20)), [])
    },
    // The id width is the repository's, so a SHA-1 id is no ref in a
    // SHA-256 repository — the same check every header naming an object
    // makes, and here it makes the whole listing refuse.
    width: () => {
        assertEq(run(loose, tryRoots(one(''), 32)), null)
    },
    // Two names of the same length that differ. A ref name is compared as
    // bytes, so the comparison cannot stop at the length, and a fixture
    // whose names all differ in length would never ask it to.
    sameLength: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file(`${b} refs/heads/y\n`), refs: { heads: { x: ref(a) } } }
        sameRoots(run(root, tryRoots(one(''), 20)), [['refs/heads/x', a], ['refs/heads/y', b]])
    },
    // A read that fails for any reason other than the file not being there
    // is the channel's, not an empty answer. The virtual filesystem only
    // ever reports `ENOENT`, so this one case runs over a host that reports
    // something else — once for each of the two reads, which take different
    // shapes: a loose ref file through `readFile`, and `packed-refs` through
    // `readWhole`.
    readError: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        // the loose read refuses, with `packed-refs` simply not there
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const loose = {
            readFile: () => state => [state, error(denied)],
            readWhole: missing,
            readdir: missing,
            stat: statUnasked,
        }
        assertStructurallySame(
            mockRun(loose)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))[1],
            error(denied))
        // and the whole-file read refuses, which the loose read has to reach
        // first: with no loose file the name falls back to `packed-refs`, and a
        // read of it that is not an absence is the channel's — see
        // `tryWholeBytes`.
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const packed = {
            readFile: missing,
            readWhole: () => state => [state, error(denied)],
            readdir: missing,
            stat: statUnasked,
        }
        assertStructurallySame(
            mockRun(packed)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))[1],
            error(denied))
        // and the same where the loose file *answers*: the packed file is read
        // at the end anyway, because a `packed-refs` Git refuses is every name's
        // answer, so its failure is the channel's there too
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const hit = {
            readFile: path => state => [
                state,
                path === 'refs/heads/master'
                    ? ok(toVec(latin1(`${a}\n`)))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readWhole: () => state => [state, error(denied)],
            readdir: missing,
            stat: statUnasked,
        }
        assertStructurallySame(
            mockRun(hit)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))[1],
            error(denied))
    },
    // A `packed-refs` Git refuses is the answer, and nothing after it is read.
    // The listing is four effects in sequence, and the first one refusing has to
    // end it: otherwise `HEAD`'s read comes next, and a failure there — a
    // permission, a broken host — arrives as a channel error in place of the
    // `null` this had already decided on. The host below answers the malformed
    // file and refuses every other read, so a chain that reads on fails.
    // The loose files are read before `packed-refs`, and a `git pack-refs`
    // running underneath is why.
    //
    // That command writes the new packed file and then prunes the loose refs it
    // packed — `git pack-refs -h` marks `--prune` as the default, and `git gc`
    // runs it — so a reader that snapshots `packed-refs` first can see neither
    // copy of a ref that was loose when it started: not the packed file, which
    // predates the pack, and not the loose file, which is gone by the time the
    // walk arrives.
    //
    // The host below is that transition at its worst: the pack completes before
    // the walk reaches `refs/heads`, so the directory lists nothing, and the
    // packed file answers its *new* contents to any read that happens after the
    // listing. Reading the loose files first therefore finds the ref in the
    // packed lines; reading the packed file first would find it in neither.
    packedRefsMovedUnderfoot: () => {
        const packedNow = latin1(`${a} refs/heads/x\n`)
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'refs' ? [dirent('heads', path, false, true)] : []),
            ],
            stat: statUnasked,
            readWhole: path => log => [
                [...log, `readWhole ${path}`],
                path === packedRefs
                    // before the walk it holds nothing; after it, the ref that
                    // was loose when this began
                    ? ok(log.includes('readdir refs/heads') ? [toVec(packedNow)] : [])
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))
        assert(r[0] === 'ok', r)
        sameRoots(r[1], [['refs/heads/x', a]])
        // the order that makes it so, in the log itself
        assert(log.indexOf('readdir refs/heads') < log.indexOf(`readWhole ${packedRefs}`), log)
        // The lookup is the same transition seen through one name: the loose
        // file is gone by the time it is read, and the packed file read after it
        // carries the ref. A snapshot taken first would have neither.
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const one_ = {
            readFile: path => log2 => [
                [...log2, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: missing,
            stat: statUnasked,
            readWhole: path => log2 => [
                [...log2, `readWhole ${path}`],
                path === packedRefs
                    ? ok(log2.includes('readFile refs/heads/x') ? [toVec(packedNow)] : [])
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [log2, r2] = mockRun(one_)(/** @type {readonly string[]} */ ([]))(
            tryResolve(one(''), 20)(latin1('refs/heads/x')))
        assert(r2[0] === 'ok' && r2[1] !== null, r2)
        assertEq(codePointListToString(toHex(r2[1])), a)
        assertStructurallySame(log2, ['readFile refs/heads/x', `readWhole ${packedRefs}`])
    },
    rootsBadPackedStops: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        const badPacked = latin1('# hello\n')
        // A repository whose loose half reads: one symbolic ref, which the walk
        // records and leaves pending, and a `master` whose *read* refuses — so a
        // chain that went on to resolve the pending ref could not answer at all.
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                path === 'refs/heads/sym'
                    ? ok(toVec(latin1('ref: refs/heads/master\n')))
                    // an absent `HEAD` is an answer, so the only refusals this
                    // host has are the ones a chain that read on would hit
                    : path === 'HEAD'
                        ? error(ioError({ code: 'ENOENT', message: path }))
                        : error(denied),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'refs'
                    ? [dirent('heads', path, false, true)]
                    : path === 'refs/heads'
                        ? [dirent('sym', path, true, false)]
                        : []),
            ],
            stat: statUnasked,
            // the malformed file, as the chunks one open answered
            readWhole: path => log => [
                [...log, `readWhole ${path}`],
                path === packedRefs ? ok([toVec(badPacked)]) : error(denied),
            ],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))
        assertStructurallySame(r, ok(null))
        // the refusal is the packed file's, and the resolution after it is not
        // attempted — the pending ref's target is never read
        assert(!log.includes('readFile refs/heads/master'), log)
    },
    // A listing that answers one name twice is refused rather than read. Node
    // decodes a directory entry as UTF-8 and replaces what is not, so a file
    // named by the byte `0x80` and a file named U+FFFD come back as the same
    // name: measured on node 22 in such a directory, `readdir` answered two
    // entries both named U+FFFD and a read of that name answered the same
    // file's bytes both times. Read on, the walk would list that file's id
    // twice under one name and drop the other ref without a word — a retention
    // root missing, which is the answer this module must not give.
    //
    // The state cannot be built in the virtual filesystem, whose directory is a
    // map from a name to a file and so cannot hold a name twice; the host below
    // answers the listing node would.
    lossyNames: () => {
        const twice = '\uFFFD'
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readWhole: missing,
            // an entry the listing calls a file costs no `stat` either
            stat: path => state => [state, error(ioError({ code: 'EIO', message: path }))],
            readdir: path => state => [
                state,
                path === 'refs'
                    ? ok([twice, twice].map(name => ({
                        name,
                        parentPath: path,
                        isFile: true,
                        isDirectory: false,
                    })))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [, r] = mockRun(host)(null)(tryRoots(one(''), 20))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, lossyNameCode)
        assertEq(e[1].message, lossyNameMessage('refs', twice))
    },
    // A `HEAD` that is not a regular file is refused, which is the legacy
    // symlink spelling of a symbolic ref. Git still reads one that points under
    // `refs/` — measured on 2.43.0, `.git/HEAD` linked to `refs/heads/master`
    // answers `rev-parse HEAD` and `symbolic-ref HEAD` — and refuses the
    // repository outright when the link points elsewhere: with `.git/HEAD`
    // linked to a file beside it holding an id, `rev-parse`, `show-ref` and
    // `status` all answer `not a git repository`.
    //
    // `HEAD` is judged on the listing alone, where an entry under `refs/` gets a
    // `stat` — see `linkedRef` below. That is not an inconsistency but Git's own
    // asymmetry: Git validates where `HEAD`'s link points and validates nothing
    // about where a ref's link points, and a `stat` cannot tell a caller where a
    // link went, only what it arrived at. Following `HEAD`'s link is also the one
    // that escapes the repository by name — `.git/HEAD` naming `/etc/passwd`
    // would be a detached `HEAD` if its first line read as an id. See
    // `todo/symlink-head.md`.
    //
    // A FIFO `HEAD` is where this is better than Git rather than narrower: with
    // `.git/HEAD` a writerless FIFO, `git status` and `git rev-parse HEAD` both
    // had to be killed, and this refuses at once.
    symlinkHead: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readWhole: missing,
            readdir: path => state => [
                state,
                ok(path === 'refs' ? [] : [dirent('HEAD', path, false, false)]),
            ],
            // `HEAD`'s kind costs no `stat`, and this says so: a `stat` reached
            // here answers a code the assertions below do not accept.
            stat: path => state => [state, error(ioError({ code: 'EIO', message: path }))],
        }
        const [, r] = mockRun(host)(null)(tryRoots(one(''), 20))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, headKindCode)
        assertEq(e[1].message, 'HEAD is not a regular file')
    },
    // A link to a loose ref file is followed and listed, which is Git's. Measured
    // on Git 2.43.0, `refs/heads/alias` linked to `refs/heads/real`:
    // `show-ref` and `for-each-ref` both list `refs/heads/alias` at the id, and
    // so does `rev-parse --verify`. Git follows a ref's link with no check on
    // where it points — a link to a file *outside* the repository holding an id
    // is listed too.
    //
    // The listing cannot see this: node's `Dirent` does not follow a link, so
    // `alias` arrives as `isFile: false, isDirectory: false` — the same answer a
    // FIFO gives. One `stat` separates them, because it follows the link without
    // opening it.
    linkedRef: () => {
        const [log, r] = rootsBy('alias', kind(true, false))
        assert(r[0] === 'ok')
        sameRoots(r[1], [['refs/heads/master', a], ['refs/heads/alias', a]])
        // the `stat` is asked for the entry the listing could not name, and not
        // for the one it could
        assert(log.includes('stat refs/heads/alias'), log)
        assert(!log.includes('stat refs/heads/master'), log)
    },
    // A FIFO is skipped, and the ref beside it is still listed.
    //
    // This is why the question is asked with `stat` and not by reading: opening a
    // FIFO with no writer does not fail, it *waits*, so a walk that read every
    // non-directory would hang rather than answer wrongly. `stat` follows a link
    // and does not open what it finds — measured on node 22, a `stat` of a
    // writerless FIFO answered in 3 ms.
    //
    // Measured on Git 2.43.0 with a FIFO at `refs/heads/pipe` and no writer:
    // `show-ref`, `for-each-ref`, `status` and `gc --prune=now` all return at
    // once and none of them lists it, and a FIFO inside a subdirectory of `refs/`
    // is skipped with its siblings still listed. `rev-parse --verify` on it blocks
    // until killed, which is the half `tryResolve` shares — see
    // `todo/symlink-head.md`.
    fifoRef: () => {
        const [log, r] = rootsBy('pipe', kind(false, false))
        assert(r[0] === 'ok')
        sameRoots(r[1], [['refs/heads/master', a]])
        assert(!log.includes('readFile refs/heads/pipe'), log)
    },
    // A link to a directory is refused rather than walked into or skipped.
    //
    // Git walks into it: measured on Git 2.43.0 with `refs/heads/up` linked to
    // `..`, `show-ref` lists `refs/heads/up/heads/master`, then
    // `refs/heads/up/heads/up/heads/master`, and on until the path is too long to
    // open — a name per depth out of a repository with one branch. Git streams
    // those; this walk collects them, so following the link is an answer with no
    // bound, built out of one entry of a repository nobody here chose.
    //
    // Skipping would be the other wrong answer: this function's result is what a
    // `gc` keeps, so a silently dropped subtree of refs is objects deleted. The
    // refusal names the entry. See `todo/symlink-head.md`.
    linkedDir: () => {
        const [, r] = rootsBy('linkdir', kind(false, true))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, linkedDirCode)
        assertEq(e[1].message, 'refs/heads/linkdir is a link to a directory')
    },
    // The name rule runs before the kind is asked, which is Git's order. An entry
    // the listing cannot classify would otherwise cost a `stat`, and a link to a
    // directory is refused by it — so a name Git never looks at could refuse a
    // whole repository.
    //
    // Measured on Git 2.43.0 in a repository of `refs/heads/master` and
    // `refs/tags/v1`. With `refs/heads/.hidden` linked to `master`: two refs,
    // exit 0. With the same name linked to `../tags`, a link to a directory:
    // the same two refs, exit 0 — the name is skipped whatever it points at,
    // where `refs/heads/ok` linked to `../tags` lists `refs/heads/ok/v1`
    // instead. `x.lock` behaves as `.hidden` does, by the same rule.
    nameBeforeKind: () => {
        for (const entry of ['.hidden', 'x.lock']) {
            const [log, r] = rootsBy(entry, kind(false, true))
            assert(r[0] === 'ok', entry)
            sameRoots(r[1], [['refs/heads/master', a]])
            // and the `stat` is not paid for at all: the name settled it
            assert(!log.includes(`stat refs/heads/${entry}`), log)
        }
        // A name that fails only the *whole-name* rule is a different case, and
        // the one a skip would lose in silence: `refs/heads/bad.` is no ref name
        // and `refs/heads/bad./v1` is one, so with the first linked to
        // `refs/tags` Git lists the second at exit 0. Here the kind is asked,
        // the entry is a link to a directory, and it is refused *loudly* — the
        // divergence `linkedDirCode` argues, not a subtree dropped quietly.
        const [log, r] = rootsBy('bad.', kind(false, true))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, linkedDirCode)
        assert(log.includes('stat refs/heads/bad.'), log)
    },
    // A link that leads nowhere is skipped, which is Git's. Measured on Git
    // 2.43.0 with `refs/heads/dangling` linked to a name that is not there and
    // `refs/heads/loop` linked to itself: `show-ref` and `for-each-ref` list
    // neither and both exit 0. Node answers `ENOENT` for the first and `ELOOP`
    // for the second.
    linkLeadsNowhere: () => {
        for (const code of ['ENOENT', 'ELOOP']) {
            const [, r] = rootsBy('gone', code)
            assert(r[0] === 'ok', code)
            sameRoots(r[1], [['refs/heads/master', a]])
        }
    },
    // A worktree whose own `refs` is a link to a directory is walked through it,
    // which is Git's. Measured on Git 2.43.0 with a linked worktree's `refs`
    // replaced by a link to a directory holding `bisect/bad`: `show-ref` and
    // `for-each-ref` both list `refs/bisect/bad` and `rev-parse --verify` answers
    // its id.
    //
    // A listing cannot see this — it does not follow a link, so the entry arrives
    // with both kind flags false — and the filter used to ask `isDirectory`,
    // which dropped the worktree's whole ref tree without a word. The root is
    // asked about with a `stat` instead, and followed where a link *below* it is
    // refused: every link inside the tree being refused is what bounds following
    // the root to one level, so `refs` linked to `..` lists the gitdir and is
    // refused at the same entry one level down.
    // Each walk lists only the directories it could take a name from, which is a
    // rule about a *prefix* and not the one about a name: `refs/bisect` is not
    // itself a per-worktree name — the rule is the prefix with its slash — so
    // `isShared` says "mine" about the directory and "not mine" about every ref
    // in it.
    //
    // Measured on Git 2.43.0 with a linked worktree, `refs/bisect/shared-only` in
    // the shared directory and `refs/bisect/own` in the worktree's: the worktree
    // lists its own and `rev-parse --verify refs/bisect/shared-only` there
    // answers `Needed a single revision`, so the shared copy is invisible to it.
    // A walk that listed it anyway could fail over refs it would never answer —
    // another worktree is free to remove that directory while `git bisect reset`
    // runs, and a `readdir` that cannot find what a listing named is the
    // channel's.
    scopedDirectories: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readWhole: missing,
            stat: statUnasked,
            readFile: path => log => [
                [...log, `readFile ${path}`],
                path === 'repo/refs/heads/master' || path === 'repo/refs/bisect/shared-only'
                    ? ok(toVec(latin1(`${a}\n`)))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'repo'
                    ? [dirent('refs', path, false, true)]
                    : path === 'repo/refs'
                        ? [dirent('heads', path, false, true), dirent('bisect', path, false, true)]
                        : path === 'repo/refs/heads'
                            ? [dirent('master', path, true, false)]
                            : path === 'repo/refs/bisect'
                                ? [dirent('shared-only', path, true, false)]
                                : []),
            ],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
        assert(r[0] === 'ok', r)
        // the shared `refs/bisect/` is no ref of this worktree, and it is not
        // listed to find that out
        sameRoots(r[1], [['refs/heads/master', a]])
        assert(!log.includes('readdir repo/refs/bisect'), log)
        // The same question the other way, in a main worktree, where both walks
        // read one directory: no per-worktree name can sit under `refs/heads`,
        // so the worktree's walk does not list it — the tree is listed once
        // rather than twice — while `refs/bisect/` *is* this worktree's there,
        // which is what the main worktree's `show-ref` lists.
        const [mainLog, m] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryRoots(one('repo'), 20))
        assert(m[0] === 'ok', m)
        sameRoots(m[1], [['refs/heads/master', a], ['refs/bisect/shared-only', a]])
        assertEq(mainLog.filter(l => l === 'readdir repo/refs/heads').length, 1)
        assertEq(mainLog.filter(l => l === 'readdir repo/refs/bisect').length, 1)
    },
    linkedWorktreeRefs: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                path === 'wt/refs/bisect/bad'
                    ? ok(toVec(latin1(`${b}\n`)))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'wt'
                    // the worktree's `refs` as node reports a symlink
                    ? [dirent('refs', path, false, false)]
                    : path === 'wt/refs'
                        ? [dirent('bisect', path, false, true)]
                        : path === 'wt/refs/bisect'
                            ? [dirent('bad', path, true, false)]
                            : []),
            ],
            readWhole: missing,
            // the link's target, which is a directory
            stat: path => log => [[...log, `stat ${path}`], ok(kind(false, true))],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
        assert(r[0] === 'ok')
        sameRoots(r[1], [['refs/bisect/bad', b]])
        assert(log.includes('stat wt/refs'), log)
    },
    // The same entry as a link to something that is no directory is a worktree
    // with no refs of its own, which is what most of them are — not a refusal,
    // since the walk has nothing to read either way.
    linkedWorktreeRefsNotADir: () => {
        for (const answer of [kind(true, false), kind(false, false), 'ENOENT', 'ELOOP']) {
            /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
            const host = {
                readFile: path => state => [state, error(ioError({ code: 'ENOENT', message: path }))],
                readdir: path => state => [
                    state,
                    path === 'wt'
                        ? ok([dirent('refs', path, false, false)])
                        // what a host answers for a listing of something that is
                        // no directory — so a walk that went in anyway fails
                        // rather than quietly finding nothing
                        : path === 'wt/refs'
                            ? error(ioError({ code: 'ENOTDIR', message: path }))
                            : ok([]),
                ],
                readWhole: missing,
                stat: path => state => [
                    state,
                    typeof answer === 'string'
                        ? error(ioError({ code: answer, message: path }))
                        : ok(answer),
                ],
            }
            const [, r] = mockRun(host)(null)(tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
            assert(r[0] === 'ok')
            sameRoots(r[1], [])
        }
    },
    // A `refs` the *listing* calls a regular file needs no `stat` at all: the
    // question is only for an entry the listing could not classify.
    ownRefsIsAFile: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'wt' ? [dirent('refs', path, true, false)] : []),
            ],
            readWhole: missing,
            stat: path => log => [[...log, `stat ${path}`], ok(kind(false, true))],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
        assert(r[0] === 'ok')
        sameRoots(r[1], [])
        assert(!log.includes('stat wt/refs'), log)
    },
    // And a `stat` of it that fails for any reason but a link leading nowhere is
    // the channel's, for the reason every other one here is: the listing named
    // the entry, so a host that then cannot describe it is a ref tree this would
    // otherwise drop out of an answer a `gc` reads.
    ownRefsStatRefused: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readWhole: missing,
            readdir: path => state => [
                state,
                ok(path === 'wt' ? [dirent('refs', path, false, false)] : []),
            ],
            stat: path => state => [state, error(ioError({ code: 'EIO', message: path }))],
        }
        const [, r] = mockRun(host)(null)(tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'EIO')
    },
    // Every other `stat` failure is the channel's, and deliberately not forgiven:
    // the listing named the entry, so a host that then cannot describe it is a
    // loose ref this would otherwise drop out of an answer a `gc` reads.
    linkStatRefused: () => {
        const [, r] = rootsBy('alias', 'EIO')
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, 'EIO')
    },
    // One name at a time: a loose ref, a packed one, a loose one shadowing
    // a packed one, and a name nothing is stored under.
    resolve: () => {
        assertEq(hexOf(shadowed, 'refs/heads/master'), a)
        assertEq(hexOf(shadowed, 'refs/heads/other'), a)
        assertEq(hexOf(shadowed, 'refs/tags/v1'), t)
        assertEq(resolved(shadowed, 'refs/heads/nothing'), null)
        // A name outside `refs/` resolves the same way, which is what
        // `tryRoots` does not answer and this does: `HEAD`.
        assertEq(hexOf({ ...loose, HEAD: file('ref: refs/heads/other\n') }, 'HEAD'), b)
    },
    // A name that is no ref name is `null` before anything is read, which is what
    // the export promises and what a caller passing a name from outside depends
    // on. The host below refuses every read, so a chain that opens `packed-refs`
    // first answers the channel's error instead.
    //
    // `../secret` is the case that matters: `..` is one of the byte pairs the
    // name rule refuses, so it is the name that would otherwise be joined below
    // the repository into a path that leaves it.
    resolveBadNameReadsNothing: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [[...log, `readFile ${path}`], error(denied)],
            readWhole: path => log => [[...log, `readWhole ${path}`], error(denied)],
            readdir: path => log => [[...log, `readdir ${path}`], error(denied)],
            stat: path => log => [[...log, `stat ${path}`], error(denied)],
        }
        for (const name of ['../secret', '.hidden', 'x.lock', 'a..b', 'has space']) {
            const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
                tryResolve(one(''), 20)(latin1(name)))
            assertStructurallySame(r, ok(null))
            assertStructurallySame(log, [])
        }
        // and a name that *is* one still reaches a read, so the case above is
        // about the name and not about the host being unreachable. The loose
        // file is what it reaches first — see `fromPacked` for why that order —
        // and this host refuses it, so the chain ends there.
        const [log] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryResolve(one(''), 20)(latin1('refs/heads/master')))
        assertStructurallySame(log, ['readFile refs/heads/master'])
    },
    // The same rule one link further in, and where it is actually enforced: a
    // symbolic ref whose *target* is no ref name never reaches a path, because
    // `fjs/git/ref`'s grammar refuses the target before this module sees it. A
    // target is as much from outside the repository as a name a caller typed —
    // it is whatever bytes a file holds — so this matters as much as the guard on
    // the caller's name.
    //
    // The two rules agree name for name, checked directly rather than assumed:
    // `../secret`, `a..b`, `.hidden`, `x.lock` and `has space` are each refused
    // by `tryRef` *and* by `isWholeName`, and `refs/x` and `UPPER` are accepted
    // by both.
    //
    // So the file is a loose ref that is no ref, and this module's sticky rule
    // applies rather than a `null` for that one name: `git show-ref` refuses the
    // whole listing rather than dropping the name, which is what `shadowBroken`
    // pins and what happens here.
    symbolicTargetNotARefName: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { sym: file('ref: ../secret\n') } }, secret: ref(a) }
        assertEq(resolved(root, 'refs/heads/sym'), null)
        assertEq(run(root, tryRoots(one(''), 20)), null)
    },
    // A target that *is* a ref name and still names no file this host can ask
    // about: `0x80` is a byte the name rule allows and no UTF-8 decoding, so
    // `refs/heads/sym` holding `ref: \x80` passes `fjs/git/ref`'s grammar and
    // `isWholeName`, and then there is no path to read.
    //
    // `null`, not the packed line: a loose file shadows a packed line by
    // existing, so answering the packed line here would be a stale id whenever
    // the loose file is there — and whether it is there is exactly what cannot be
    // asked. See `todo/byte-ref-names.md`.
    //
    // This is the lookup's half of that issue one link in. The caller's own name
    // is caught before anything is read; a target is caught here, because it is
    // whatever bytes a file held.
    symbolicTargetNoPath: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file(`${a} refs/heads/sym\n`),
            refs: { heads: { sym: file('ref: \u0080\n') } },
        }
        assertEq(resolved(root, 'refs/heads/sym'), null)
    },
    // A `packed-refs` Git refuses stops every name, including one whose
    // loose file is perfectly good. Measured: with a good
    // `refs/heads/master` and a `packed-refs` of `# hello`,
    // `git rev-parse refs/heads/master` answers
    // `fatal: unexpected line in .git/packed-refs` rather than the loose
    // id. The file is the repository's, so a reader cannot use half of it.
    resolveBadPacked: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file('# hello\n'), refs: { heads: { master: ref(a) } } }
        assertEq(resolved(root, 'refs/heads/master'), null)
        assertEq(resolved(root, 'refs/heads/nothing'), null)
    },
    // A `packed-refs` larger than a `Vec` reads, which is the ordinary case and
    // not an extreme one. A record is an id, a space, a name and a newline —
    // measured at 70 bytes for `refs/heads/topic/feature-<n>` — so `readFile`'s
    // 131,072 is spent at about 1,870 refs, and a repository of 4,000 branches
    // writes a 282,939-byte file that Git reads without comment. This module's
    // own note at `packedId` is about 20,000 names, five times past the point a
    // `readFile` could open the file at all.
    //
    // The chunks are joined and the lookup answers from the join, so this pins
    // the joining and not only the reading — the last name in the file is in the
    // third chunk.
    bigPackedRefs: () => {
        const lines = Array.from({ length: 4000 }, (_, i) => `${a} refs/heads/topic/feature-${i}\n`)
        const text = latin1(`# pack-refs with: peeled fully-peeled sorted \n${lines.join('')}`)
        const chunk = Number(maxLengthBytes)
        assert(text.length > chunk * 2, text.length)
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: missing,
            stat: statUnasked,
            // what one open answers: the file in `Vec`-sized pieces, which is
            // the only shape that cannot be a join of two different files
            readWhole: path => log => [
                [...log, `readWhole ${path}`],
                path === packedRefs
                    ? ok(Array.from(
                        { length: Math.ceil(text.length / chunk) },
                        (_, k) => toVec(text.slice(k * chunk, (k + 1) * chunk))))
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryResolve(one(''), 20)(latin1('refs/heads/topic/feature-3999')))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(codePointListToString(toHex(r[1])), a)
        // the loose file the name would shadow the packed line with, then one
        // read of the packed file — that order is `fromPacked`'s, and the file
        // is read once
        assertStructurallySame(log, [
            'readFile refs/heads/topic/feature-3999',
            `readWhole ${packedRefs}`,
        ])
    },
    // The *lookup* refuses a symlink `HEAD` too, which it used to follow.
    //
    // Measured on Git 2.43.0, and the rule is `HEAD`'s alone:
    //
    //   $ ln -s /elsewhere/holding-an-id .git/HEAD
    //   $ git rev-parse HEAD        # fatal: not a git repository
    //   $ ln -s /elsewhere/holding-an-id .git/ORIG_HEAD
    //   $ git rev-parse ORIG_HEAD   # the id
    //
    // So Git refuses the repository over `HEAD` and follows the link for every
    // other name in the same directory. Before this, `.git/HEAD` naming a file
    // whose first line reads as an id answered that id — a value from the other
    // side of the boundary this module claims.
    //
    // The listing is what sees it, so the lookup pays one `readdir`, and only
    // for `HEAD`: `readFile` follows the link and `stat` answers for what is at
    // the other end.
    symlinkHeadLookup: () => {
        const host = linkedHeadHost(latin1(`${b}\n`))
        const [, r] = mockRun(host(false))(null)(tryResolve(one(''), 20)(latin1('HEAD')))
        assert(r[0] === 'error')
        const e = r[1]
        assert(e[0] === 'ioError')
        assertEq(e[1].code, headKindCode)
        assertEq(e[1].message, 'HEAD is not a regular file')
        // an ordinary `HEAD` still reads, so the refusal is the kind's
        const [, ok_] = mockRun(host(true))(null)(tryResolve(one(''), 20)(latin1('HEAD')))
        assert(ok_[0] === 'ok' && ok_[1] !== null)
        assertEq(codePointListToString(toHex(ok_[1])), b)
        // and `ORIG_HEAD`, a link in the same listing, is followed — which is
        // Git's answer and why this asks about one name rather than a kind
        const [, orig] = mockRun(host(true))(null)(tryResolve(one(''), 20)(latin1('ORIG_HEAD')))
        assert(orig[0] === 'ok' && orig[1] !== null)
        assertEq(codePointListToString(toHex(orig[1])), b)
    },
    // A gitdir that is not there is no `HEAD` rather than a failure, which is
    // what the plain read this replaced answered.
    symlinkHeadNoGitdir: () => {
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const host = { readFile: missing, readWhole: missing, readdir: missing, stat: statUnasked }
        const [, r] = mockRun(host)(null)(tryResolve(one(''), 20)(latin1('HEAD')))
        assertStructurallySame(r, ok(null))
    },
    // A packed name that is also a directory resolves to the packed id.
    //
    // A ref name can be a prefix of other ref names, so `refs/heads` is both a
    // name a `packed-refs` line may carry and the directory the loose refs live
    // in. Measured on Git 2.43.0 with `<id> refs/heads` packed beside an ordinary
    // `refs/heads/master`: `git rev-parse --verify refs/heads` answers the id and
    // `git show-ref` lists both names. Node answers `EISDIR` for a read of the
    // directory, and forgiving only `ENOENT` made that a channel error — a name
    // Git resolves that this could not resolve at all.
    //
    // The rule the read is stating is "no loose file shadows the packed line",
    // and a directory is not one.
    packedNameIsADirectory: () => {
        const packed = latin1(`${b} refs/heads\n`)
        /** @type {MemOperationMap<ReadWhole | ReadFile | Readdir | Stat, null>} */
        const host = {
            // what node answers for a read of a directory
            readFile: path => state => [
                state,
                path === 'refs/heads'
                    ? error(ioError({ code: 'EISDIR', message: path }))
                    : path === 'refs/heads/master'
                        ? ok(toVec(latin1(`${a}\n`)))
                        : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => state => [
                state,
                ok(path === 'refs'
                    ? [dirent('heads', path, false, true)]
                    : path === 'refs/heads'
                        ? [dirent('master', path, true, false)]
                        : []),
            ],
            stat: missing,
            readWhole: path => state => [
                state,
                path === packedRefs
                    ? ok([toVec(packed)])
                    : error(ioError({ code: 'ENOENT', message: path })),
            ],
        }
        const [, r] = mockRun(host)(null)(tryResolve(one(''), 20)(latin1('refs/heads')))
        assert(r[0] === 'ok' && r[1] !== null, r)
        assertEq(codePointListToString(toHex(r[1])), b)
        // and the loose ref below it still resolves, so the fallback did not
        // swallow the directory's contents
        const [, m] = mockRun(host)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))
        assert(m[0] === 'ok' && m[1] !== null, m)
        assertEq(codePointListToString(toHex(m[1])), a)
    },
    // And the same repository on a host that *reads* a directory instead of
    // failing: the rule is the entry's kind and not the error code, so the
    // packed line answers there too.
    //
    // A read of a directory is `EISDIR` on Linux, macOS and Windows, and a host
    // is free to answer its bytes instead — `fjs/effects/node/virtual` records
    // that FreeBSD does. Forgiving the code alone left such a host answering
    // `null` for a name Git resolves, so the bytes that are no ref cost one
    // `stat`, and what it says is what decides.
    packedNameReadAsBytes: () => {
        const packed = latin1(`${b} refs/heads\n`)
        const [log, r] = mockRun(readsADirectoryHost(packed, ok(kind(false, true))))(
            /** @type {readonly string[]} */ ([]))(tryResolve(one(''), 20)(latin1('refs/heads')))
        assert(r[0] === 'ok' && r[1] !== null, r)
        assertEq(codePointListToString(toHex(r[1])), b)
        assert(log.includes('stat refs/heads'), log)
        // A *file* holding the same bytes is the other repository, and it keeps
        // Git's answer: the loose file shadows the packed line by existing, so
        // the name has no value rather than the packed one.
        const [, f] = mockRun(readsADirectoryHost(packed, ok(kind(true, false))))(
            /** @type {readonly string[]} */ ([]))(tryResolve(one(''), 20)(latin1('refs/heads')))
        assertStructurallySame(f, ok(null))
        // A `stat` that cannot find what the read just answered is a name gone
        // between the two questions, and that is the same `null` — not a failure,
        // since the answer is about what was read. Every other `stat` failure is
        // the channel's, as every other read failure is.
        const gone = ioError({ code: 'ENOENT', message: 'refs/heads' })
        assertStructurallySame(
            mockRun(readsADirectoryHost(packed, error(gone)))(
                /** @type {readonly string[]} */ ([]))(tryResolve(one(''), 20)(latin1('refs/heads')))[1],
            ok(null))
        const denied = ioError({ code: 'EACCES', message: 'refs/heads' })
        assertStructurallySame(
            mockRun(readsADirectoryHost(packed, error(denied)))(
                /** @type {readonly string[]} */ ([]))(tryResolve(one(''), 20)(latin1('refs/heads')))[1],
            error(denied))
    },
    // A loose file that is no ref answers `null` and not the packed line,
    // the same refusal `tryRoots` makes for the whole listing.
    resolveBroken: () => {
        assertEq(resolved({ ...shadowed, refs: { heads: { master: file('not an id\n') } } }, 'refs/heads/master'), null)
    },
    // Four symbolic hops resolve and five do not, which is Git's bound:
    // measured with a chain ending at a real ref, `git rev-parse` answers
    // at four and reports `ignoring dangling symref` at five. Four hops is
    // five lookups counting the ref that holds the id.
    resolveChain: () => {
        assertEq(maxLookups, 5)
        for (const hops of [1, 2, 3, 4]) {
            assertEq(hexOf(chain(hops), 'refs/heads/s1'), a)
        }
        for (const hops of [5, 6, 7]) {
            assertEq(resolved(chain(hops), 'refs/heads/s1'), null)
        }
    },
    // The same bound catches a symbolic ref pointing at itself, which is
    // also how Git answers one: the dangling-symref message rather than a
    // loop.
    resolveLoop: () => {
        assertEq(resolved({ refs: { heads: { loop: file('ref: refs/heads/loop\n') } } }, 'refs/heads/loop'), null)
    },
    // `FETCH_HEAD` is read straight from the file, first record, which is
    // what a loose ref's own grammar does: the id, one whitespace byte,
    // then the rest unread. Measured: a `FETCH_HEAD` whose first record is
    // `not-for-merge` still answers that first line's id to
    // `git rev-parse FETCH_HEAD`.
    resolveSpecial: () => {
        /** @type {Dir} */
        const fetched = {
            ...loose,
            FETCH_HEAD: file(`${b}\tnot-for-merge\tbranch 'dev' of https://example/x\n${a}\t\tbranch 'main' of https://example/x\n`),
        }
        assertEq(hexOf(fetched, 'FETCH_HEAD'), b)
        // A symbolic ref may point at one, and resolving it goes through
        // the same reading — which is why `fjs/git/ref` leaves the
        // question here rather than refusing the target.
        assertEq(hexOf({ ...fetched, refs: { heads: { sym: file('ref: FETCH_HEAD\n') } } }, 'refs/heads/sym'), b)
    },
    // With the file absent, those two names answer nothing even where a
    // `packed-refs` line carries them: Git reads them from the file only,
    // so a packed line named either is no ref to it. Every other name does
    // fall back to its packed line, which the first case above shows.
    resolveSpecialAbsent: () => {
        for (const n of ['FETCH_HEAD', 'MERGE_HEAD']) {
            /** @type {Dir} */
            const root = { 'packed-refs': file(`${a} ${n}\n`), refs: {} }
            assertEq(resolved(root, n), null)
        }
    },
    // A name outside ASCII is UTF-8 on the way to the filesystem and UTF-8 on
    // the way back, so the two halves agree about one file. `é` is the two
    // bytes `0xC3 0xA9`, and reading each of them as a code point would ask
    // the host for `Ã©` — a name no file has — so `tryResolve` would miss the
    // very file `tryRoots` lists.
    utf8Name: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { 'é': ref(a) } } }
        sameRoots(run(root, tryRoots(one(''), 20)), [['refs/heads/é', a]])
        assertEq(hexOfIn('', root, utf8('refs/heads/é')), a)
        // The byte-per-code-point reading of the same name, which is the path
        // `Ã©` and no file: it answers nothing, so the case above is about the
        // decoding and not about any two bytes finding the file.
        assertEq(resolvedIn('', root, latin1('refs/heads/é')), null)
    },
    // A name that is no ref name never reaches the filesystem, and `..` is
    // the case that matters: joined below the repository it names a file
    // outside it, and a file outside a repository that happens to begin with
    // forty hex digits is not a ref. The virtual filesystem folds `..` the
    // way a host does, so without the check this reads `secret` and answers
    // its id.
    resolveEscape: () => {
        /** @type {Dir} */
        const root = { repo: { refs: { heads: { master: ref(a) } } }, a: { b: ref(b) } }
        // The same file read as a ref of the outer directory, so it is there
        // and readable and the refusal below is the name's rather than the
        // absence's.
        assertEq(hexOfIn('', root, utf8('a/b')), b)
        assertEq(resolvedIn('repo', root, utf8('../a/b')), null)
    },
    // A loose symbolic ref whose target is nowhere hides the packed line of
    // the same name, because the shadow is the file existing. Otherwise a
    // name whose loose file replaced a packed one comes back with the stale
    // packed id, which is the opposite of what the loose file says.
    danglingShadowsPacked: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file(`${b} refs/heads/master\n`),
            refs: { heads: { master: file('ref: refs/heads/gone\n') } },
        }
        sameRoots(run(root, tryRoots(one(''), 20)), [])
        assertEq(resolvedIn('', root, utf8('refs/heads/master')), null)
    },
    // `HEAD`'s target must sit under `refs/`. Measured on Git 2.43.0: with
    // `.git/HEAD` holding `ref: a/b` and `.git/a/b` holding a valid id, each
    // of `rev-parse HEAD`, `rev-parse --verify HEAD` and `symbolic-ref HEAD`
    // answers `not a git repository` — the directory is no repository at all,
    // so there is no id to answer. `a/b` is a name
    // `git check-ref-format` accepts, which is why the rule is this
    // function's and not the name grammar's.
    headTarget: () => {
        /** @type {Dir} */
        const root = { HEAD: file('ref: a/b\n'), a: { b: ref(a) } }
        // the target file is there and reads as a ref, so the refusal is the
        // prefix rule's
        assertEq(hexOf(root, 'a/b'), a)
        assertEq(resolved(root, 'HEAD'), null)
        // A `HEAD` under `refs/` resolves, so the rule is the prefix and not
        // the name `HEAD`.
        assertEq(hexOf({ ...loose, HEAD: file('ref: refs/heads/master\n') }, 'HEAD'), a)
        // And the constraint is `HEAD`'s alone: a loose ref may point outside
        // `refs/`, which `resolveSpecial` shows for `FETCH_HEAD`.
        assertEq(hexOf({ ...root, refs: { heads: { sym: file('ref: a/b\n') } } }, 'refs/heads/sym'), a)
        // The *listing* asks the same rule, because Git refuses the whole
        // directory and not just that one name: measured, `show-ref`,
        // `for-each-ref` and `rev-list --all` all answer `not a git repository`
        // for this `HEAD`. A list of the other refs would be a plausible answer
        // for a repository Git will not read at all.
        assertEq(run({ ...root, refs: { heads: { master: ref(b) } } }, tryRoots(one(''), 20)), null)
        // One level under `refs/` is enough, so the rule is the prefix and not a
        // count of components: measured, `ref: refs/x` with `refs/x` present
        // resolves and `show-ref` lists it.
        sameRoots(
            run({ HEAD: file('ref: refs/x\n'), refs: { x: ref(a) } }, tryRoots(one(''), 20)),
            [['refs/x', a]])
        assertEq(hexOf({ HEAD: file('ref: refs/x\n'), refs: { x: ref(a) } }, 'HEAD'), a)
    },
    // A `packed-refs` naming one ref twice is not refused and does not answer
    // twice: measured on Git 2.43.0, `git show-ref` lists both lines and
    // `git rev-parse` answers the **last**, in either order of the two. So
    // the last line is the value and the earlier ones are dead, which keeps
    // the one-entry-per-name `tryRoots` promises.
    packedTwice: () => {
        for (const [first, second] of [[a, b], [b, a]]) {
            /** @type {Dir} */
            const root = {
                'packed-refs': file(`${first} refs/heads/dup\n${second} refs/heads/dup\n`),
                refs: {},
            }
            // The lookup answers the last line, which is `git rev-parse`'s
            // answer in either order of the two.
            assertEq(hexOf(root, 'refs/heads/dup'), second)
            // The listing refuses, because both lines are roots and one entry
            // per name can hold neither answer. Measured on Git 2.43.0:
            // `show-ref` and `for-each-ref` print both lines, `rev-list --all`
            // lists both ids, and `gc --prune=now` with every reflog expired
            // keeps the commit only the *earlier* line names — so taking the
            // last silently dropped a live root.
            refusesWith(packedTwiceCode)(
                root, one(''), 'packed-refs names refs/heads/dup at two ids')
        }
        // One name repeated at *one* id loses nothing, so it is answered once.
        /** @type {Dir} */
        const same = {
            'packed-refs': file(`${a} refs/heads/dup\n${a} refs/heads/dup\n`),
            refs: {},
        }
        sameRoots(run(same, tryRoots(one(''), 20)), [['refs/heads/dup', a]])
        // A name a `packed-refs` may carry and no path can spell is written as
        // its bytes: `refs/heads/\x80` is a name `check-ref-format` accepts,
        // measured, and a message built through the path decoding would say
        // nothing about which ref it was.
        /** @type {Dir} */
        const byteNamed = {
            'packed-refs': file(`${a} refs/heads/\x80\n${b} refs/heads/\x80\n`),
            refs: {},
        }
        assertEq(
            rootsRefusal(byteNamed, one('')).message,
            'packed-refs names 726566732f68656164732f80 at two ids')
    },
    // A ref holding the id no object has refuses the listing, whichever file it
    // sits in. Measured on Git 2.43.0 with `refs/heads/zero` at forty zeros:
    // `show-ref` answers `bad ref refs/heads/zero (0000…)` and exits 128 and
    // `rev-list --all` answers `fatal: bad object`, loose and packed alike —
    // while `rev-parse` prints the zero id and exits 0, which is the lookup's
    // answer here too, and `for-each-ref` warns and skips it.
    zeroIdRoot: () => {
        const zero = '0'.repeat(40)
        /** @type {readonly Dir[]} */
        const roots = [
            { refs: { heads: { master: ref(a), zero: ref(zero) } } },
            { 'packed-refs': file(`${zero} refs/heads/zero\n`), refs: { heads: { master: ref(a) } } },
            { HEAD: ref(zero), refs: {} },
        ]
        for (const root of roots) {
            assertEq(rootsRefusal(root, one('')).code, zeroIdCode)
        }
        // the message names the ref, and `HEAD` is a name like any other here
        assertEq(rootsRefusal({ HEAD: ref(zero), refs: {} }, one('')).message, 'HEAD holds the zero id')
        // And the lookup answers it, as `rev-parse` does.
        assertEq(hexOf({ refs: { heads: { zero: ref(zero) } } }, 'refs/heads/zero'), zero)
    },
    // A ref name is bytes, and Git takes any byte the name rule allows with no
    // encoding requirement: measured on Git 2.43.0, `check-ref-format` accepts
    // `refs/heads/` + 0x80, and `show-ref` and `rev-parse` both handle it. Such
    // a name can only reach a `packed-refs` line here, because a path is text to
    // this host — node hands back U+FFFD for that byte and a read of the decoded
    // string answers `ENOENT`, measured. So the packed line is the only answer
    // available, and refusing would call a ref `tryRoots` lists absent. What
    // that costs is in `todo/byte-ref-names.md`.
    byteName: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file(`${a} refs/heads/\x80\n`), refs: {} }
        const name = /** @type {readonly number[]} */ ([...latin1('refs/heads/'), 0x80])
        // The listing carries the ref, because the walk *looked*: it read every
        // entry of `refs/` and would have failed on a file it could not name, so
        // there is no loose file to shadow this packed line. Asserted by bytes
        // rather than through `sameRoots`, because that helper renders a name as
        // UTF-8 text and this name is none.
        const rs = run(root, tryRoots(one(''), 20))
        assert(rs !== null)
        assertEq(rs.length, 1)
        assertStructurallySame(toArray(rs[0].name), name)
        assertEq(codePointListToString(toHex(rs[0].id)), a)
        // The lookup refuses, because it does *not* look: a loose file of this
        // name shadows the packed line by existing, and no path can be built to
        // ask whether one does. Answering the packed id would be a stale id in
        // exactly the state this host cannot observe — and cannot construct here
        // either, since the virtual filesystem spells a directory entry as a
        // string too. The two answers differ because one half looked and the
        // other cannot, which the docs of both say.
        assertEq(resolvedIn('', root, name), null)
    },
    // The two directories are two, and `HEAD` is the name that tells them apart.
    // Measured on Git 2.43.0: a linked worktree detached at another commit
    // answers its own id where the main worktree answers its branch's, so
    // reading `HEAD` from the shared directory is a plausible wrong commit.
    worktreeHead: () => {
        /** @type {Dirs} */
        const dirs = { gitdir: 'wt', common: 'repo' }
        /** @type {Dir} */
        const root = {
            // the worktree's own directory: its `HEAD` and nothing shared
            wt: { HEAD: ref(b) },
            // the shared directory: `refs/`, `packed-refs`, and the *main*
            // worktree's `HEAD`
            repo: { HEAD: ref(t), refs: { heads: { master: ref(a) } } },
        }
        assertEq(codePointListToString(toHex(/** @type {Oid} */ (
            run(root, tryResolve(dirs, 20)(utf8('HEAD')))))), b)
        // Wrong on purpose, to show the two answers differ: one directory for
        // both is the main worktree's `HEAD`.
        assertEq(codePointListToString(toHex(/** @type {Oid} */ (
            run(root, tryResolve(one('repo'), 20)(utf8('HEAD')))))), t)
        // And a shared name is read from the shared directory even though the
        // worktree's directory is where `HEAD` came from.
        assertEq(codePointListToString(toHex(/** @type {Oid} */ (
            run(root, tryResolve(dirs, 20)(utf8('refs/heads/master')))))), a)
    },
    // Which names are per worktree, measured one at a time on Git 2.43.0 by
    // writing a different id into each directory and asking a linked worktree.
    // `refs/bisect/`, `refs/worktree/` and `refs/rewritten/` are under `refs/`
    // and still the worktree's, so this is not "the names outside `refs/`".
    perWorktree: () => {
        for (const name of [
            'HEAD', 'ORIG_HEAD', 'FETCH_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD',
            'REVERT_HEAD', 'REBASE_HEAD', 'BISECT_HEAD', 'AUTO_MERGE',
            'refs/bisect/good', 'refs/worktree/x', 'refs/rewritten/y',
        ]) {
            const at = nameAt(name)
            /** @type {Dir} */
            const root = { wt: at(b), repo: { ...at(t), refs: { ...at(t).refs, heads: {} } } }
            assertEq(codePointListToString(toHex(/** @type {Oid} */ (
                run(root, tryResolve({ gitdir: 'wt', common: 'repo' }, 20)(utf8(name)))))), b, name)
        }
        // The rule is how a name is *spelled*, not a list of names Git's
        // documentation happens to mention. Measured on Git 2.43.0 in a linked
        // worktree with a different id in each directory: a name of upper-case
        // letters, `-` and `_` answers the worktree's copy and does not resolve
        // at all when only the shared directory has it, while one with a digit
        // or a lower-case letter answers the shared copy and does not resolve
        // when only the worktree has it.
        for (const [name, from] of /** @type {readonly (readonly [string, string])[]} */ ([
            ['BISECT_EXPECTED_REV', b], ['MERGE_AUTOSTASH', b], ['FOO_BAR', b],
            ['FOO-BAR', b], ['_FOO', b], ['FOO_', b], ['F', b],
            ['FOO1', a], ['Foo', a], ['lowercase', a],
        ])) {
            /** @type {Dir} */
            const root = { wt: { [name]: ref(b) }, repo: { [name]: ref(a), refs: { heads: {} } } }
            assertEq(codePointListToString(toHex(/** @type {Oid} */ (
                run(root, tryResolve({ gitdir: 'wt', common: 'repo' }, 20)(utf8(name)))))), from, name)
        }
        // And a name that is shared comes from the shared directory, so the list
        // above is a rule and not "everything comes from the worktree".
        /** @type {Dir} */
        const shared = { wt: { refs: { heads: { x: ref(b) } } }, repo: { refs: { heads: { x: ref(a) } } } }
        assertEq(codePointListToString(toHex(/** @type {Oid} */ (
            run(shared, tryResolve({ gitdir: 'wt', common: 'repo' }, 20)(utf8('refs/heads/x')))))), a)
    },
    // A detached `HEAD` is a retention root and an attached one is not.
    // Measured on Git 2.43.0 in a repository detached with no refs at all:
    // `show-ref` and `for-each-ref` list nothing, while `rev-list --all` lists
    // the commit, `fsck` calls nothing unreachable, and `gc --prune=now` does
    // not prune it. So an empty answer there would lose the only history the
    // repository has.
    detachedHead: () => {
        sameRoots(run({ HEAD: ref(a), refs: {} }, tryRoots(one(''), 20)), [['HEAD', a]])
        // Attached: the branch is the root and `HEAD` adds nothing, since the
        // two name one id.
        sameRoots(
            run({ HEAD: file('ref: refs/heads/master\n'), refs: { heads: { master: ref(a) } } }, tryRoots(one(''), 20)),
            [['refs/heads/master', a]])
        // Attached to a branch that is not there — an unborn `HEAD`, which
        // `git init` leaves — is no root either, because there is no id.
        sameRoots(run({ HEAD: file('ref: refs/heads/master\n'), refs: { heads: {} } }, tryRoots(one(''), 20)), [])
        // No `HEAD` at all contributes no root. Narrower than Git, which calls
        // such a directory no repository at all — measured, `show-ref` answers
        // `not a git repository` — but this module is given a directory rather
        // than finding one.
        sameRoots(run(loose, tryRoots(one(''), 20)), [
            ['refs/heads/master', a],
            ['refs/heads/other', b],
            ['refs/remotes/origin/main', a],
            ['refs/tags/v1', t],
        ])
        // A `HEAD` that is there and is no ref refuses the listing, the way a
        // broken loose ref does: the file exists and what the repository says
        // about its own head is unreadable.
        assertEq(run({ HEAD: file('not an id\n'), refs: {} }, tryRoots(one(''), 20)), null)
        // And it is the worktree's `HEAD` that is read, not the shared one.
        sameRoots(
            run({ wt: { HEAD: ref(b) }, repo: { HEAD: ref(a), refs: {} } }, tryRoots({ gitdir: 'wt', common: 'repo' }, 20)),
            [['HEAD', b]])
    },
    // The walk of `refs/` is two walks that divide the names between them: the
    // shared directory's for the shared names and the worktree's for the per
    // worktree ones. Measured: `show-ref` in a linked worktree lists its own
    // `refs/bisect/good` beside the shared branches, and a `refs/bisect/` left
    // in the *shared* directory is invisible to that worktree entirely.
    worktreeRoots: () => {
        /** @type {Dirs} */
        const dirs = { gitdir: 'wt', common: 'repo' }
        sameRoots(
            run({
                wt: { refs: { bisect: { good: ref(b) } } },
                repo: { refs: { heads: { master: ref(a) }, bisect: { 'only-shared': ref(t) } } },
            }, tryRoots(dirs, 20)),
            [['refs/heads/master', a], ['refs/bisect/good', b]])
        // The worktree's `refs/` is usually not there at all — it appears only
        // while a bisect or a rebase is running — and it is found by listing the
        // worktree's directory, so there is no path read that could be absent.
        sameRoots(
            run({ wt: {}, repo: { refs: { heads: { master: ref(a) } } } }, tryRoots(dirs, 20)),
            [['refs/heads/master', a]])
        // In a main worktree the two directories are one, and each name is
        // still listed once: the shared walk skips the per-worktree names and
        // the second walk takes them.
        sameRoots(
            run({ refs: { heads: { master: ref(a) }, bisect: { good: ref(b) } } }, tryRoots(one(''), 20)),
            [['refs/heads/master', a], ['refs/bisect/good', b]])
    },
    // A `packed-refs` line naming `HEAD` beside a `HEAD` file refuses the
    // listing, because Git keeps *both* and one entry per name can hold neither
    // answer. Measured on Git 2.43.0 with both present: `show-ref --head` prints
    // two `HEAD` lines, `rev-list --all` lists both ids, `fsck` calls neither
    // unreachable, and `gc --prune=now` after
    // `reflog expire --expire=now --expire-unreachable=now --all` keeps the
    // packed line's commit — while `rev-parse HEAD` answers the file and
    // `for-each-ref` lists neither. A shadowed name under `refs/` is the
    // opposite: with `refs/heads/x` loose and packed at two ids, `show-ref` and
    // `rev-list --all` answer only the loose one and that same `gc` prunes the
    // packed commit. So shadowing is right there and drops a live root here.
    //
    // `git pack-refs --all` writes no such line — measured with a detached
    // `HEAD` and an `ORIG_HEAD` set — so the collision is a file made by hand,
    // though `git gc` carries one forward once it is there.
    packedHead: () => {
        const refuses = refusesWith(packedHeadCode)
        refuses(
            { repo: { 'packed-refs': file(`${b} HEAD\n`), HEAD: ref(a), refs: {} } },
            one('repo'),
            'repo/packed-refs names HEAD beside repo/HEAD')
        // An attached `HEAD` is refused too. It adds no root of its own — the
        // branch is the root — and the packed id is still one nothing else
        // names, so answering the branch alone would lose it.
        //
        // The two paths come from the two directories, which is what a linked
        // worktree shows: `packed-refs` is the shared one's and `HEAD` is the
        // worktree's own.
        refuses(
            {
                wt: { HEAD: file('ref: refs/heads/master\n') },
                repo: { 'packed-refs': file(`${b} HEAD\n`), refs: { heads: { master: ref(t) } } },
            },
            { gitdir: 'wt', common: 'repo' },
            'repo/packed-refs names HEAD beside wt/HEAD')
        // With no `HEAD` file there is no collision to refuse: the packed line
        // is all there is about the name, and it is listed.
        sameRoots(run({ 'packed-refs': file(`${b} HEAD\n`), refs: {} }, tryRoots(one(''), 20)), [['HEAD', b]])
        // And a `packed-refs` that does not name `HEAD` is the ordinary
        // repository, answered rather than refused.
        sameRoots(
            run({ 'packed-refs': file(`${b} refs/heads/other\n`), HEAD: ref(a), refs: {} }, tryRoots(one(''), 20)),
            [['HEAD', a], ['refs/heads/other', b]])
        // The lookup is not the listing and does not refuse: it answers the
        // file, which is what `rev-parse HEAD` does.
        assertEq(hexOf({ 'packed-refs': file(`${b} HEAD\n`), HEAD: ref(a), refs: {} }, 'HEAD'), a)
    },
    // ## Writing a ref
    //
    // The whole of a write, asserted on the filesystem it leaves: the
    // directories above the file, the file itself, and no lock beside it. The
    // structural comparison is what says the lock is gone — a lock left behind
    // would be an extra entry — and the read back through `tryResolve` is what
    // says the bytes are a ref and not just bytes. Forty-one of them here
    // because these fixtures are a SHA-1 repository; the file is
    // `oidBytes * 2 + 1` long, which is why `idWidth` in `writeRefuses` refuses
    // an id of the other width rather than writing sixty-five.
    writeRef: () => {
        const [fs, r] = wrote({}, 'refs/heads/master', a)
        assertStructurallySame(r, ok(undefined))
        assertStructurallySame(fs, { refs: { heads: { master: ref(a) } } })
        assertEq(hexOf(fs, 'refs/heads/master'), a)
        // And a name two directories deeper, whose directories are created the
        // way Git creates them: measured on 2.43.0, `git update-ref
        // refs/heads/a/b/c` on a repository holding no `refs/heads/a` writes the
        // file and both directories above it at exit 0. The ref already there is
        // left alone, which is what makes this about creating and not replacing.
        const [deep] = wrote(fs, 'refs/heads/a/b/c', b)
        assertStructurallySame(deep, { refs: { heads: { master: ref(a), a: { b: { c: ref(b) } } } } })
        assertEq(hexOf(deep, 'refs/heads/a/b/c'), b)
        // A name already there is replaced, which is what a rename over it does.
        const [again] = wrote(fs, 'refs/heads/master', b)
        assertStructurallySame(again, { refs: { heads: { master: ref(b) } } })
    },
    // A per-worktree name is written to the worktree's own directory and a
    // shared one to the shared directory, which is the rule both readers follow
    // — see `dirOf`. `refs/heads/master` beside it is the control: without it
    // the case would pass for a writer that always used the gitdir.
    writeWorktree: () => {
        /** @type {Dirs} */
        const dirs = { gitdir: 'wt', common: 'repo' }
        /** @type {Dir} */
        const root = { wt: {}, repo: {} }
        const [own] = ran(root, tryWrite(dirs, 20)(latin1('refs/bisect/good'))(idOf(a)))
        assertStructurallySame(own, { wt: { refs: { bisect: { good: ref(a) } } }, repo: {} })
        const [shared] = ran(root, tryWrite(dirs, 20)(latin1('refs/heads/master'))(idOf(a)))
        assertStructurallySame(shared, { wt: {}, repo: { refs: { heads: { master: ref(a) } } } })
    },
    // A lock already there refuses the write, leaves the ref at the id it had,
    // and leaves the lock — which is not this writer's to remove. Git's answer:
    // measured on 2.43.0, a `refs/heads/y.lock` put there by hand makes
    // `git update-ref refs/heads/y <id>` exit 128 with `cannot lock ref
    // 'refs/heads/y': Unable to create '…/refs/heads/y.lock': File exists` and
    // write no `refs/heads/y`.
    //
    // The lock's name is spelled out rather than built from `lockSuffix`,
    // because the name is what is under test here.
    writeLockHeld: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { master: ref(a), 'master.lock': [] } } }
        const [fs, r] = wrote(root, 'refs/heads/master', b)
        assertEq(writeRefusal(r).code, 'EEXIST')
        assertStructurallySame(fs, root)
    },
    // A directory where the ref's file goes: the rename fails, and the lock is
    // given back rather than left to refuse every later write of that name. Git
    // refuses this direction too — measured on 2.43.0, with `refs/heads/a/b`
    // present, `git update-ref refs/heads/a <id>` exits 128 with
    // `'refs/heads/a' exists; cannot create 'refs/heads/a'` — and leaves no
    // lock either.
    //
    // The comparison against the untouched repository is the assertion: a
    // `refs/heads/a.lock` still there is the failure this case exists for, and
    // `writeLockHeld` above is what keeps the cleanup from being a blanket one
    // that would take another writer's lock.
    writeRefIsADirectory: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { a: { b: ref(b) } } } }
        const [fs, r] = wrote(root, 'refs/heads/a', a)
        const e = writeRefusal(r)
        assertEq(e.code, refPrefixCode)
        assertEq(e.message, 'refs/heads/a is a directory; cannot create it')
        assertStructurallySame(fs, root)
    },
    // The other loose direction: a **file** where the name's parent directory
    // must go. The same `stat` answers it, because the ref's own path leads
    // through that file — measured `ENOTDIR` on node 22.22.2 and here alike, so
    // this is the one prefix case whose refusal is the host's code rather than
    // `refPrefixCode`. Git refuses it too, with
    // `'refs/heads/a' exists; cannot create 'refs/heads/a/b'`.
    //
    // The ref is still there afterwards, which is the point: nothing is created,
    // and the `mkdir` that would replace the file with a directory on this runner
    // (`../../effects/node/virtual/todo/mkdir-over-a-file.md`) is never reached.
    writeLooseIsAFile: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { a: ref(b) } } }
        const [fs, r] = wrote(root, 'refs/heads/a/b', a)
        assertEq(writeRefusal(r).code, 'ENOTDIR')
        assertStructurallySame(fs, root)
    },
    // And the cleanup itself, which now needs a host: the only failure left
    // *after* the exclusive write is the `rename`, and the virtual filesystem
    // cannot produce one — a directory at the path is refused by the `stat` above
    // before the lock is taken, which is what `writeRefIsADirectory` pins.
    //
    // So the lock is taken, the rename fails, and the `rm` has to appear. Without
    // it the name is unwritable until someone removes the file by hand.
    writeGivesTheLockBack: () => {
        /** @type {(rmResult: Result<void, IoChannel>) => MemOperationMap<ReadWhole | Stat | Mkdir | WriteExclusive | Rename | Rm, readonly string[]>} */
        const host = rmResult => ({
            readWhole: missing,
            // logged rather than `missing`, so the order below pins that the
            // `stat` of the ref's path comes before anything is created
            stat: path => log => [[...log, `stat ${path}`], error(ioError({ code: 'ENOENT', message: path }))],
            mkdir: (path, _) => log => [[...log, `mkdir ${path}`], ok(undefined)],
            writeExclusive: path => log => [[...log, `writeExclusive ${path}`], ok(undefined)],
            rename: (src, dst) => log => [
                [...log, `rename ${src} ${dst}`],
                error(ioError({ code: 'EIO', message: dst })),
            ],
            rm: path => log => [[...log, `rm ${path}`], rmResult],
        })
        /** @type {(rmResult: Result<void, IoChannel>) => void} */
        const cleansUp = rmResult => {
            const [log, r] = mockRun(host(rmResult))(/** @type {readonly string[]} */ ([]))(
                tryWrite(one(''), 20)(latin1('refs/heads/master'))(idOf(a)))
            // the rename's error reaches the caller, not the cleanup's outcome
            assertEq(writeRefusal(r).code, 'EIO')
            assertStructurallySame(log, [
                'stat refs/heads/master',
                'mkdir refs/heads',
                'writeExclusive refs/heads/master.lock',
                'rename refs/heads/master.lock refs/heads/master',
                'rm refs/heads/master.lock',
            ])
        }
        cleansUp(ok(undefined))
        // And with the cleanup *itself* failing: still the rename's `EIO`, since
        // that is the reason a caller can act on and the `rm`'s is the reason it
        // could not be undone. A compensation built on `step` rather than
        // `resultStep` would report `EROFS` here.
        cleansUp(error(ioError({ code: 'EROFS', message: 'refs/heads/master.lock' })))
    },
    // Five refusals, each before any effect runs — which is what the untouched
    // filesystem beside each one says.
    writeRefuses: () => {
        // A lock of a name one of these writes targets, so the comparison in
        // `refuses` says these answer before any effect runs at all — not merely
        // that they leave the refs alone.
        /** @type {Dir} */
        const root = { refs: { heads: { master: ref(a), 'zero.lock': [] } } }
        /** @type {(name: string, hex: string, code: string) => IoErrorInfo} */
        const refuses = (name, hex, code) => {
            const [fs, r] = wrote(root, name, hex)
            const e = writeRefusal(r)
            assertEq(e.code, code)
            assertStructurallySame(fs, root)
            return e
        }
        // A name that is no ref name. `x.lock` and `.hidden` are the two
        // file-name conventions a walk of `refs/` skips, so a ref of either name
        // is one no reader would ever answer; `a..b` and `bad.` are the rules
        // Git refuses the whole listing over; `../secret` is the one that would
        // otherwise join below the repository into a path outside it.
        for (const n of ['refs/heads/x.lock', 'refs/heads/.hidden', 'refs/heads/a..b', 'refs/heads/bad.', 'refs/../secret']) {
            refuses(n, a, badNameCode)
        }
        assertEq(refuses('refs/heads/bad.', a, badNameCode).message, 'refs/heads/bad. is not a ref name')
        // A name outside `refs/`, which `update-ref` does write — measured,
        // `FOO_HEAD` becomes `.git/FOO_HEAD` at exit 0 — and this refuses.
        // `HEAD` is the reason: measured on 2.43.0 with `.git/HEAD` holding
        // `ref: refs/heads/master`, `git update-ref HEAD <id>` leaves that file
        // untouched and writes the *branch*, so a writer handed `HEAD` has two
        // answers and no way to know which was meant.
        for (const n of ['HEAD', 'FETCH_HEAD', 'a/b']) {
            refuses(n, a, outsideRefsCode)
        }
        assertEq(refuses('HEAD', a, outsideRefsCode).message, 'HEAD is not under refs/')
        // An id of the wrong width: a 32-byte id in a repository whose ids are
        // 20 bytes is sixty-four hex digits, which `fjs/git/ref` reads as no ref
        // at all — so the file would be one this module's own listing refuses.
        // `writeSha256` writes this very id, at `oidBytes` 32.
        refuses('refs/heads/wide', wide, idWidthCode)
        // And the zero id, which is Git's delete rather than a value.
        const zero = '0'.repeat(40)
        assertEq(
            refuses('refs/heads/zero', zero, zeroIdCode).message,
            'refs/heads/zero would hold the zero id')
        // A name no path spells: `refs/heads/` and the byte `0x80` is a ref name
        // `check-ref-format` accepts and `rev-parse` resolves, measured, and a
        // path is text to this host. `tryResolve` answers `null` for it, which a
        // write may not — see `byteName` above and `todo/byte-ref-names.md`.
        const byteNamed = /** @type {readonly number[]} */ ([...latin1('refs/heads/'), 0x80])
        const [fs, r] = ran(root, tryWrite(one(''), 20)(byteNamed)(idOf(a)))
        const e = writeRefusal(r)
        assertEq(e.code, unspellableNameCode)
        // the hex spelling of the name, since there is no text one
        assertEq(e.message, '726566732f68656164732f80 is no path this host can spell')
        assertStructurallySame(fs, root)
    },
    // A name too long to be a `Vec` at all. `Bytes` is unbounded and
    // `u8ListToVec` asserts past `maxLengthBytes`, so before `nameText` checked
    // the length this escaped as a bare `'assertion failed'` — not an `IoChannel`
    // refusal, not even an `Effect`. Found by review; the bound below is one byte
    // over, and the control is one byte under it, which answers normally.
    //
    // A *write* is refused and a *lookup* answers `null`, which is each side's
    // existing answer for a name no path spells — and true of this one on any
    // host, where a component over 255 bytes is `ENAMETOOLONG`.
    writeNameTooLong: () => {
        /** @type {Dir} */
        const before = { refs: { heads: {} } }
        /** @type {(extra: number) => readonly number[]} */
        const named = extra => [
            ...latin1('refs/heads/'),
            ...Array.from({ length: Number(maxLengthBytes) - 11 + extra }, () => 0x61),
        ]
        const [fs, r] = ran(before, tryWrite(one(''), 20)(named(1))(idOf(a)))
        assertEq(writeRefusal(r).code, unspellableNameCode)
        assertStructurallySame(fs, before)
        assertEq(run(before, tryResolve(one(''), 20)(named(1))), null)
        // The control: one byte *under* the bound converts, so the length test is
        // the only thing the case above can be catching. The write goes through —
        // this runner has no path limit of its own, where a host would answer
        // `ENAMETOOLONG` for a component over 255 bytes.
        const [grown, ok1] = ran(before, tryWrite(one(''), 20)(named(0))(idOf(a)))
        assertEq(ok1[0], 'ok')
        // and it is readable back under that name, so the write landed rather
        // than merely not refusing
        assertStructurallySame(run(grown, tryResolve(one(''), 20)(named(0))), idOf(a))
    },
    // A packed name that is a directory prefix of the name being written, and the
    // other way round. `git update-ref` refuses both — measured on 2.43.0, with
    // `refs/heads/a` packed it exits 128 with `'refs/heads/a' exists; cannot
    // create 'refs/heads/a/b'`, and with `refs/heads/c/d` packed the same
    // command on `refs/heads/c` exits 128 the other way round — and no
    // filesystem answer can stand in for the check, because the packed name has
    // no loose file for the `mkdir` or the `rename` to trip over.
    //
    // The second direction is the one that does harm rather than only differing
    // from Git's policy: with `refs/heads/c/d` packed and a loose `refs/heads/c`
    // beside it, `git rev-parse refs/heads/c/d` answers `ambiguous argument …
    // unknown revision`, because the loose *file* stands where the path's
    // directory would be. `show-ref` still lists it, so a name that resolved
    // before the write does not resolve after it and nothing said so.
    writePackedPrefix: () => {
        const refuses = /** @type {(root: Dir, name: string, message: string) => void} */ (
            (root, name, message) => {
                const [fs, r] = wrote(root, name, b)
                const e = writeRefusal(r)
                assertEq(e.code, refPrefixCode)
                assertEq(e.message, message)
                assertStructurallySame(fs, root)
            })
        // Each fixture holds a lock of the name being written, belonging to
        // another writer, and `refuses` compares the whole filesystem — so a
        // cleanup that reached back past the exclusive write would delete it and
        // fail here. A revision of `unlocked` wrapped the whole sequence and did
        // exactly that.
        refuses(
            { 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: { a: { 'b.lock': [] } } } },
            'refs/heads/a/b',
            'refs/heads/a exists; cannot create refs/heads/a/b')
        refuses(
            { 'packed-refs': file(`${a} refs/heads/c/d\n`), refs: { heads: { 'c.lock': [] } } },
            'refs/heads/c',
            'refs/heads/c/d exists; cannot create refs/heads/c')
        // Three controls, because a check written over text rather than over
        // segments passes the two cases above and fails all of these.
        //
        // A packed name that is a *string* prefix and no directory prefix: the
        // byte after it is not the separator.
        const [wider] = wrote({ 'packed-refs': file(`${a} refs/heads/ab\n`), refs: { heads: {} } }, 'refs/heads/a', b)
        assertStructurallySame(wider, { 'packed-refs': file(`${a} refs/heads/ab\n`), refs: { heads: { a: ref(b) } } })
        // The same name, which is an update of a packed-only ref and what Git
        // does too: measured, `update-ref` writes the loose file and leaves the
        // packed line stale.
        const [same] = wrote({ 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: {} } }, 'refs/heads/a', b)
        assertStructurallySame(same, { 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: { a: ref(b) } } })
        // And a packed name with the separator in the right place but different
        // bytes before it, which is the third way the test can be got wrong.
        const q = { 'packed-refs': file(`${a} refs/heads/q\n`), refs: { tags: {} } }
        const [other] = wrote(q, 'refs/tags/qq/r', b)
        assertStructurallySame(other, { ...q, refs: { tags: { qq: { r: ref(b) } } } })
    },
    // A `packed-refs` that will not parse leaves the prefix question above
    // unanswerable, so the write is refused rather than made anyway. Git refuses
    // it too, measured with a control: with one junk line in the file,
    // `git update-ref refs/heads/n <id>` exits 128 with `unexpected line in
    // .git/packed-refs` and writes nothing, while the identical write against a
    // well-formed `packed-refs` exits 0 and writes the file.
    // The lock in this fixture is another writer's, and the comparison below is
    // what says this refusal leaves it alone: the refusal happens before the
    // exclusive write, so the cleanup must not reach it.
    writeBadPacked: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file('this is not a packed-refs file\n'),
            refs: { heads: { 'master.lock': [] } },
        }
        const [fs, r] = wrote(root, 'refs/heads/master', a)
        const e = writeRefusal(r)
        assertEq(e.code, badPackedCode)
        assertEq(e.message, 'packed-refs is no packed-refs')
        assertStructurallySame(fs, root)
    },
    // The file is the id's hex digits and an LF, which is `oidBytes * 2 + 1`
    // bytes and not a fixed 41 — measured, a repository created with
    // `git init --object-format=sha256` has a 65-byte `refs/heads/x` after
    // `git update-ref`. This writes the same sixty-four-digit id
    // `writeRefuses` refuses at `oidBytes` 20, and here it is the repository's
    // own width and the write succeeds. Without this the doc's claim to support
    // both widths would rest on reading the code.
    writeSha256: () => {
        const [fs, r] = ran({}, tryWrite(one(''), 32)(latin1('refs/heads/master'))(idOf(wide)))
        assertStructurallySame(r, ok(undefined))
        assertStructurallySame(fs, { refs: { heads: { master: ref(wide) } } })
        // and the lookup at the same width reads it back
        const got = run(fs, tryResolve(one(''), 32)(latin1('refs/heads/master')))
        assert(got !== null)
        assertEq(codePointListToString(toHex(got)), wide)
        // The same repository read as a SHA-1 one answers nothing, which is what
        // makes the width the repository's: sixty-five bytes is no 41-byte ref.
        assertEq(run(fs, tryResolve(one(''), 20)(latin1('refs/heads/master'))), null)
    },
    // **An error is never evidence that the lock is this writer's**, and this is
    // the case that says so: a failure of the exclusive write that is *not*
    // `EEXIST` must still leave the lock alone, because the write may never have
    // reached the name at all.
    //
    // `EMFILE` is the measured one. On node 22.22.2 with the process out of file
    // descriptors, a `wx` open of a name another writer holds answers `EMFILE`
    // and not `EEXIST` — checked by exhausting them and trying it, against the
    // same call with descriptors available, which answers `EEXIST`. So a cleanup
    // that treated `EEXIST` as the only "not mine" would unlink a live lock here.
    // The virtual filesystem cannot run out of descriptors, so the host below
    // answers what one does.
    writeNotMineOnAnyError: () => {
        /** @type {MemOperationMap<ReadWhole | Stat | Mkdir | WriteExclusive | Rename | Rm, readonly string[]>} */
        const host = {
            // no `packed-refs`, so there is no prefix collision to refuse
            readWhole: missing,
            // and nothing at the ref's path, so no directory bars it either
            stat: missing,
            mkdir: (path, _) => log => [[...log, `mkdir ${path}`], ok(undefined)],
            writeExclusive: path => log => [
                [...log, `writeExclusive ${path}`],
                error(ioError({ code: 'EMFILE', message: path })),
            ],
            rename: (src, dst) => log => [[...log, `rename ${src} ${dst}`], ok(undefined)],
            rm: path => log => [[...log, `rm ${path}`], ok(undefined)],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryWrite(one(''), 20)(latin1('refs/heads/master'))(idOf(a)))
        assertEq(writeRefusal(r).code, 'EMFILE')
        // the write was attempted and nothing was removed or published
        assert(log.includes('writeExclusive refs/heads/master.lock'), log)
        assert(!log.some(l => l.startsWith('rm ')), log)
        assert(!log.some(l => l.startsWith('rename ')), log)
    },
}
