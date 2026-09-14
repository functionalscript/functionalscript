/**
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Dirent, FileStat, ReadBytes, ReadFile, Readdir, Stat } from '../../effects/node/types.ts'
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
import { toHex } from '../oid/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { headKindCode, linkedDirCode, lossyNameCode, lossyNameMessage, maxLookups, tryResolve, tryRoots } from './module.f.mjs'

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

/** @type {(s: string) => readonly Vec[]} */
const file = s => [toVec(latin1(s))]

/** A ref file as Git writes one: the id and an LF. */
const ref = /** @type {(hex: string) => readonly Vec[]} */ (hex => file(`${hex}\n`))

/**
 * Runs an effect over a virtual filesystem and unwraps it, since every case
 * below asks about the answer rather than about the channel.
 *
 * @type {<T>(root: Dir, e: Effect<NodeOp, T, IoChannel>) => T}
 */
const run = (root, e) => {
    const [, r] = virtual({ ...emptyState, root })(e)
    assert(r[0] === 'ok')
    return r[1]
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
 * A `stat` for a repository with nothing packed: `packed-refs` is not there, and
 * every other path is the host's own business.
 *
 * Each case below that is about something else says this, because
 * {@link tryPackedRefs} reads that one file in windows and so asks for its length
 * before anything else — see its doc for why a `Vec` cannot hold it.
 *
 * @type {<S>(f: (path: string) => (state: S) => readonly [S, Result<FileStat, IoChannel>]) => (path: string) => (state: S) => readonly [S, Result<FileStat, IoChannel>]}
 */
const noPacked = f => path =>
    path === packedRefs || path.endsWith(`/${packedRefs}`) ? missing(path) : f(path)

/**
 * What `stat` answers about an entry, as the two questions it is.
 *
 * @type {(isFile: boolean, isDirectory: boolean) => FileStat}
 */
const kind = (isFile, isDirectory) => ({ size: 41, isFile, isDirectory })

/**
 * A regular file of a given length, for the one read that asks how long a file
 * is before reading it.
 *
 * @type {(size: number) => FileStat}
 */
const kindOf = size => ({ size, isFile: true, isDirectory: false })

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
 * @type {(entry: string, answer: FileStat | string) => MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, readonly string[]>}
 */
const kindHost = (entry, answer) => ({
    readBytes: missing,
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
    stat: noPacked(path => log => [
        [...log, `stat ${path}`],
        typeof answer === 'string'
            ? error(ioError({ code: answer, message: path }))
            : ok(answer),
    ]),
})

/**
 * The roots such a host answers, and the log of what was asked of it.
 *
 * @type {(entry: string, answer: FileStat | string) => readonly [readonly string[], Result<Nullable<readonly Root[]>, IoChannel>]}
 */
const rootsBy = (entry, answer) =>
    mockRun(kindHost(entry, answer))(/** @type {readonly string[]} */ ([]))(tryRoots(one(''), 20))

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
    // A file under `refs/` whose name is no ref name is skipped without a
    // word, which is Git's own walk: each of these is refused by
    // `git check-ref-format` and missing from `git show-ref`.
    skipped: () => {
        /** @type {Dir} */
        const heads = {
            master: ref(a),
            '.hidden': ref(b), 'x.lock': ref(b), 'bad.': ref(b),
            'a..b': ref(b), 'a@{b': ref(b), 'has space': ref(b),
            'tilde~x': ref(b), 'caret^x': ref(b),
        }
        sameRoots(run({ refs: { heads } }, tryRoots(one(''), 20)), [['refs/heads/master', a]])
    },
    // A symbolic loose ref is answered resolved, which is what
    // `git show-ref` lists for one.
    symbolicRoot: () => {
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
    // shapes: a loose ref file is read whole, and `packed-refs` in windows.
    readError: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        // the loose read refuses, with `packed-refs` simply not there
        /** @type {MemOperationMap<ReadBytes | ReadFile | Stat, null>} */
        const loose = {
            readFile: () => state => [state, error(denied)],
            stat: missing,
            readBytes: missing,
        }
        assertStructurallySame(
            mockRun(loose)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))[1],
            error(denied))
        // and the windowed read refuses, at the `stat` that asks for the length
        /** @type {MemOperationMap<ReadBytes | ReadFile | Stat, null>} */
        const packed = {
            readFile: () => state => [state, error(denied)],
            stat: () => state => [state, error(denied)],
            readBytes: () => state => [state, error(denied)],
        }
        assertStructurallySame(
            mockRun(packed)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))[1],
            error(denied))
    },
    // A `packed-refs` Git refuses is the answer, and nothing after it is read.
    // The listing is four effects in sequence, and the first one refusing has to
    // end it: otherwise `HEAD`'s read comes next, and a failure there — a
    // permission, a broken host — arrives as a channel error in place of the
    // `null` this had already decided on. The host below answers the malformed
    // file and refuses every other read, so a chain that reads on fails.
    rootsBadPackedStops: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        const badPacked = latin1('# hello\n')
        // Every read but the malformed file fails, and so does every listing, so
        // a chain that goes on after the refusal cannot answer at all.
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: () => state => [state, error(denied)],
            readdir: () => state => [state, error(denied)],
            // the malformed file, answered the way `tryPackedRefs` asks for it:
            // a length, then the bytes. The length is the file's own, because a
            // window shorter than the `stat` promised is refused as a short read.
            stat: path => state => [
                state,
                path === packedRefs ? ok({ ...kind(true, false), size: badPacked.length }) : error(denied),
            ],
            readBytes: path => state => [
                state,
                path === packedRefs ? ok(toVec(badPacked)) : error(denied),
            ],
        }
        const [, r] = mockRun(host)(null)(tryRoots(one(''), 20))
        assertStructurallySame(r, ok(null))
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
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readBytes: missing,
            // an entry the listing calls a file costs no `stat` either
            stat: noPacked(path => state => [state, error(ioError({ code: 'EIO', message: path }))]),
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
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readBytes: missing,
            readdir: path => state => [
                state,
                ok(path === 'refs' ? [] : [dirent('HEAD', path, false, false)]),
            ],
            // `HEAD`'s kind costs no `stat`, and this says so: a `stat` reached
            // here answers a code the assertions below do not accept.
            stat: noPacked(path => state => [state, error(ioError({ code: 'EIO', message: path }))]),
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
    linkedWorktreeRefs: () => {
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, readonly string[]>} */
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
            readBytes: missing,
            // the link's target, which is a directory
            stat: noPacked(path => log => [[...log, `stat ${path}`], ok(kind(false, true))]),
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
            /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, null>} */
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
                readBytes: missing,
                stat: noPacked(path => state => [
                    state,
                    typeof answer === 'string'
                        ? error(ioError({ code: answer, message: path }))
                        : ok(answer),
                ]),
            }
            const [, r] = mockRun(host)(null)(tryRoots({ gitdir: 'wt', common: 'repo' }, 20))
            assert(r[0] === 'ok')
            sameRoots(r[1], [])
        }
    },
    // A `refs` the *listing* calls a regular file needs no `stat` at all: the
    // question is only for an entry the listing could not classify.
    ownRefsIsAFile: () => {
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            readdir: path => log => [
                [...log, `readdir ${path}`],
                ok(path === 'wt' ? [dirent('refs', path, true, false)] : []),
            ],
            readBytes: missing,
            stat: noPacked(path => log => [[...log, `stat ${path}`], ok(kind(false, true))]),
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
        /** @type {MemOperationMap<ReadBytes | ReadFile | Readdir | Stat, null>} */
        const host = {
            readFile: missing,
            readBytes: missing,
            readdir: path => state => [
                state,
                ok(path === 'wt' ? [dirent('refs', path, false, false)] : []),
            ],
            stat: noPacked(path => state => [state, error(ioError({ code: 'EIO', message: path }))]),
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
        /** @type {MemOperationMap<ReadBytes | ReadFile | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [[...log, `readFile ${path}`], error(denied)],
            stat: path => log => [[...log, `stat ${path}`], error(denied)],
            readBytes: path => log => [[...log, `readBytes ${path}`], error(denied)],
        }
        for (const name of ['../secret', '.hidden', 'x.lock', 'a..b', 'has space']) {
            const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
                tryResolve(one(''), 20)(latin1(name)))
            assertStructurallySame(r, ok(null))
            assertStructurallySame(log, [])
        }
        // and a name that *is* one still reaches the read, so the case above is
        // about the name and not about the host being unreachable. The read is a
        // `stat` because `packed-refs` is taken in windows — see `tryPackedRefs`.
        const [log] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryResolve(one(''), 20)(latin1('refs/heads/master')))
        assertStructurallySame(log, ['stat packed-refs'])
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
    // The windows are asked for in order and the lookup answers from the joined
    // bytes, so this pins the joining and not only the reading.
    bigPackedRefs: () => {
        const lines = Array.from({ length: 4000 }, (_, i) => `${a} refs/heads/topic/feature-${i}\n`)
        const text = latin1(`# pack-refs with: peeled fully-peeled sorted \n${lines.join('')}`)
        const window = Number(maxLengthBytes)
        assert(text.length > window, text.length)
        /** @type {MemOperationMap<ReadBytes | ReadFile | Stat, readonly string[]>} */
        const host = {
            readFile: path => log => [
                [...log, `readFile ${path}`],
                error(ioError({ code: 'ENOENT', message: path })),
            ],
            stat: path => log => [
                [...log, `stat ${path}`],
                path === packedRefs ? ok(kindOf(text.length)) : error(ioError({ code: 'ENOENT', message: path })),
            ],
            readBytes: (path, at, size) => log => [
                [...log, `readBytes ${path} ${at} ${size}`],
                ok(toVec(text.slice(at, at + size))),
            ],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryResolve(one(''), 20)(latin1('refs/heads/topic/feature-3999')))
        assert(r[0] === 'ok' && r[1] !== null)
        assertEq(codePointListToString(toHex(r[1])), a)
        // three windows, in order, and then the loose file the name would shadow
        // the packed line with
        assertStructurallySame(log, [
            `stat ${packedRefs}`,
            `readBytes ${packedRefs} 0 ${window}`,
            `readBytes ${packedRefs} ${window} ${window}`,
            `readBytes ${packedRefs} ${window * 2} ${window}`,
            'readFile refs/heads/topic/feature-3999',
        ])
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
            sameRoots(run(root, tryRoots(one(''), 20)), [['refs/heads/dup', second]])
            assertEq(hexOf(root, 'refs/heads/dup'), second)
        }
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
    // A `packed-refs` line naming `HEAD` is shadowed by the `HEAD` file, which is
    // this module's shadowing rule applied to the one name outside `refs/`.
    // Measured on Git 2.43.0 with both present: `show-ref --head` prints two
    // `HEAD` lines and `rev-list --all` keeps both ids, while `rev-parse HEAD`
    // answers the file and `for-each-ref` lists neither — so Git does hold two,
    // and the file is what the name means. `git pack-refs` never writes such a
    // line, so this is a file made by hand either way.
    packedHead: () => {
        /** @type {Dir} */
        const detached = { 'packed-refs': file(`${b} HEAD\n`), HEAD: ref(a), refs: {} }
        sameRoots(run(detached, tryRoots(one(''), 20)), [['HEAD', a]])
        // The file wins even when it adds no root of its own: an attached `HEAD`
        // shadows the packed line and contributes nothing, so the name is gone
        // rather than stale.
        /** @type {Dir} */
        const attached = {
            'packed-refs': file(`${b} HEAD\n`),
            HEAD: file('ref: refs/heads/master\n'),
            refs: { heads: { master: ref(t) } },
        }
        sameRoots(run(attached, tryRoots(one(''), 20)), [['refs/heads/master', t]])
        // With no `HEAD` file the packed line is all there is, so it is listed:
        // the shadow is the file existing, here as everywhere else.
        sameRoots(run({ 'packed-refs': file(`${b} HEAD\n`), refs: {} }, tryRoots(one(''), 20)), [['HEAD', b]])
        // And the lookup answers the file, which is what `rev-parse` does.
        assertEq(hexOf(detached, 'HEAD'), a)
    },
}
