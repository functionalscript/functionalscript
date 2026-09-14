/**
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { NodeOp } from '../../effects/node/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { ReadFile, Readdir } from '../../effects/node/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Oid } from '../types.ts'
 * @import { Dirs, Root } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run as mockRun } from '../../effects/mock/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { fromCodePointList, fromVec } from '../../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { msb, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { toHex } from '../oid/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { lossyNameCode, lossyNameMessage, maxLookups, tryResolve, tryRoots } from './module.f.mjs'

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
    // something else.
    readError: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        /** @type {MemOperationMap<ReadFile, null>} */
        const host = { readFile: () => state => [state, error(denied)] }
        const [, r] = mockRun(host)(null)(tryResolve(one(''), 20)(latin1('refs/heads/master')))
        assertStructurallySame(r, error(denied))
    },
    // A `packed-refs` Git refuses is the answer, and nothing after it is read.
    // The listing is four effects in sequence, and the first one refusing has to
    // end it: otherwise `HEAD`'s read comes next, and a failure there — a
    // permission, a broken host — arrives as a channel error in place of the
    // `null` this had already decided on. The host below answers the malformed
    // file and refuses every other read, so a chain that reads on fails.
    rootsBadPackedStops: () => {
        const denied = ioError({ code: 'EACCES', message: 'permission denied' })
        // Every read but the malformed file fails, and so does every listing, so
        // a chain that goes on after the refusal cannot answer at all.
        /** @type {MemOperationMap<ReadFile | Readdir, null>} */
        const host = {
            readFile: path => state => [
                state,
                path === 'packed-refs' ? ok(toVec(latin1('# hello\n'))) : error(denied),
            ],
            readdir: () => state => [state, error(denied)],
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
        /** @type {MemOperationMap<ReadFile | Readdir, null>} */
        const host = {
            readFile: path => state => [state, error(ioError({ code: 'ENOENT', message: path }))],
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
