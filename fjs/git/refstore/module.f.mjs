/**
 * The refs a repository holds, over the effects: which ids it keeps
 * reachable, and what one ref name resolves to.
 *
 * [`fjs/git/ref`](../ref/module.f.mjs) reads the bytes of one ref file and
 * has no effects. This module finds and opens the files, which is the half
 * that needs a filesystem, and it is where every rule lives that no reader of
 * a single file can decide: which of two files holding the same name wins,
 * when a symbolic ref stops being followed, how a name and a path spell each
 * other, and which names a target may take.
 *
 * Every rule below was measured against Git 2.43.0 rather than read off a
 * manual page.
 *
 * **A loose ref shadows a packed one, by existing rather than by being
 * good.** `git pack-refs` leaves the loose file until it is safe to drop,
 * and a later update writes the loose file and leaves the packed line
 * stale, so the two disagree in normal operation. Measured: with
 * `refs/heads/master` packed at one id and a loose file holding another,
 * `git show-ref` and `git rev-parse` both answer the loose one. And with
 * the loose file holding bytes that are no id, Git does **not** fall back
 * to the packed line — `git show-ref` refuses the whole listing with
 * `bad ref refs/heads/master`. So the loose file decides the name once it
 * is there, and this module reads it the same way: a loose file that is no
 * ref leaves the name with no value rather than with the packed one.
 *
 * **A ref name that is no ref name is not a ref.** Git's own walk of
 * `refs/` skips such a file without a word, and the rule it skips by is the
 * ref-name rule. Measured by writing each of these into `refs/heads/` and
 * asking `git show-ref`, beside `git check-ref-format` on the same name:
 *
 * | file | `show-ref` | `check-ref-format` |
 * | --- | --- | --- |
 * | `plain` | listed | ok |
 * | `.hidden` | skipped | refused |
 * | `x.lock` | skipped | refused |
 * | `bad.` | skipped | refused |
 * | `a..b`, `a@{b` | skipped | refused |
 * | `has space`, `tilde~x`, `caret^x` | skipped | refused |
 *
 * The two agree on every one, so the filter here is
 * [`fjs/git/refname`](../refname/module.f.mjs)'s `isWholeName` and not a
 * list of file-name conventions.
 *
 * The filter runs before a path is built and not after a file is read, which
 * matters for a name a caller passes in rather than one a directory listing
 * handed over: `..` is one of the byte pairs the rule refuses, so a name like
 * `../secret` never becomes a path below the repository and is never opened.
 * A file outside a repository is not a ref however its first bytes read.
 *
 * **A ref name is bytes and a path is text, joined by UTF-8 in both
 * directions.** A directory entry called `é` is the name `0xC3 0xA9`, and that
 * name reads back as the path `é`. Reading a byte as a code point instead
 * spells the same name `Ã©`, which is a file no repository has — so the
 * listing and the lookup would disagree about one ref, each right about its
 * own half.
 *
 * The join is lossless only for a name that *is* UTF-8, and Git requires no
 * such thing: `refs/heads/\x80` is a name `git check-ref-format` accepts and
 * `rev-parse` resolves, measured. Such a name can only arrive here in a
 * `packed-refs` line, which never becomes a path, and both halves answer it —
 * but a *loose* file of that name is unreachable, because node hands back
 * U+FFFD for the byte and a read of the decoded string is `ENOENT`. What that
 * costs each half is measured in
 * [`todo/byte-ref-names.md`](./todo/byte-ref-names.md); the fix is a path API
 * that speaks bytes and belongs to the effects, not here.
 *
 * **Two entries of one listing with the same name are refused**, which is the
 * case where that unreachability stops announcing itself. One such file alone
 * fails its read and the channel carries it. Beside a file whose name really is
 * U+FFFD, it does not fail at all: node decodes the byte to U+FFFD and the two
 * entries come back as one name twice, so the walk would read the *valid* file
 * for both, list its id under that name twice, and drop the other ref without a
 * word. Measured on node 22 in a directory holding a file named by the byte
 * `0x80` and a file named `0xEF 0xBF 0xBD`: `readdir` answers two entries both
 * named U+FFFD, and a read of that name answers the second file's bytes both
 * times. A retention root silently missing is the one answer this module must
 * not give — a ref is what keeps an object from being collected — so the
 * listing is refused with {@link lossyNameCode}. No filesystem holds two
 * entries whose names are the same bytes, so a name twice in one listing means
 * the bytes of at least one of them are not what the name says, and which ref
 * is which is not knowable from here.
 *
 * **`HEAD`'s target must sit under `refs/`, and it is the only name with such
 * a rule.** Measured: with `.git/HEAD` holding `ref: a/b` and `.git/a/b`
 * holding a valid id, each of `git rev-parse HEAD`,
 * `git rev-parse --verify HEAD` and `git symbolic-ref HEAD` answers
 * `not a git repository` — the directory stops being one rather than `HEAD`
 * holding an odd value. `a/b` is a name `git check-ref-format` accepts, so the
 * rule is not the name's; and an ordinary ref may point outside `refs/`, which
 * a symbolic ref onto `FETCH_HEAD` is the everyday case of. A rule about
 * *which* name is being resolved cannot live in a reader of one file's bytes,
 * which is why it is here.
 *
 * **A `packed-refs` may name one ref twice, and the last line wins.**
 * Measured: `git show-ref` lists both lines and `git rev-parse` answers the
 * last, in either order of the two. Git neither refuses the file nor takes the
 * first, so the earlier lines are dead and one name still has one value.
 *
 * @module
 *
 * @import { Dirent, ReadFile, Readdir } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { PackedRef, Ref } from '../ref/types.ts'
 * @import { Dirs, Root } from './types.ts'
 * @import { _Entry, _Found, _Walked } from './private.ts'
 */

import { catchStep, history, historyStep, ioError, mapStep, pureError, pureOk, step, walkStep } from '../../effects/module.f.mjs'
import { isNotFound, readFile, readdir } from '../../effects/node/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { under } from '../../path/module.f.mjs'
import { fromCodePointList, fromVec } from '../../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { tryPacked, tryRef } from '../ref/module.f.mjs'
import { isWholeName } from '../refname/module.f.mjs'

const toBytes = u8List(msb)

const toVec = u8ListToVec(msb)

/**
 * A ref name as the bytes Git stores it as, from the text a path is.
 *
 * A loose ref's name is a file name, which the host hands over as a string
 * because node decodes a directory entry as UTF-8. A `packed-refs` name
 * never leaves the byte world. Encoding back to UTF-8 here makes the two one
 * name, which is what lets a loose ref shadow a packed one, and it
 * round-trips for every name node decoded from valid UTF-8 bytes.
 *
 * @type {(s: string) => readonly number[]} */
const nameBytes = s => toArray(fromCodePointList(stringToCodePointList(s)))

/**
 * A ref name as a string that stands for its bytes, for use as a key.
 *
 * One code unit per byte, which is **not** a decoding and never becomes a path —
 * {@link nameText} is the decoding, and it is UTF-8. This is only an injective
 * encoding: two names give the same key exactly when they are the same bytes, so
 * a `Map` or a `Set` over it answers what {@link sameName} answers, in one
 * lookup rather than a pass per name.
 *
 * That matters at the size a repository reaches. Comparing every packed line
 * against every other is quadratic in the count and allocates a tail array per
 * line: in isolation over 20,000 names the pairwise shape takes 1636 ms and this
 * one 8 ms, and `git pack-refs` on a busy repository writes more lines than
 * that.
 *
 * @type {(name: Bytes) => string}
 */
const nameKey = name => codePointListToString(toArray(name))

/** @type {(a: Bytes, b: Bytes) => boolean} */
const sameName = (a, b) => {
    const x = toArray(a)
    const y = toArray(b)
    return x.length === y.length && x.every((v, i) => y[i] === v)
}

/**
 * The bytes of a file, or `null` where there is none.
 *
 * A missing file is an answer here rather than a failure: a repository with
 * nothing packed has no `packed-refs`, and one whose refs are all packed has
 * an empty `refs/`. Every other error is the channel's.
 *
 * @type {(path: string) => Effect<ReadFile, Nullable<Bytes>, IoChannel>}
 */
const tryBytes = path =>
    catchStep(
        mapStep(readFile(path), toBytes),
        e => isNotFound(e) ? pureOk(null) : pureError(e))

/**
 * The `packed-refs` entries, `[]` where the file is not there, and `null`
 * where it is there and is one Git refuses.
 *
 * The three answers are distinct on purpose: a repository with nothing
 * packed and one whose `packed-refs` is malformed are not the same, and Git
 * treats them differently — the first is ordinary, the second is
 * `fatal: unexpected line`.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => Effect<ReadFile, Nullable<readonly PackedRef[]>, IoChannel>}
 */
export const tryPackedRefs = (dirs, oidBytes) => {
    const parse = tryPacked(oidBytes)
    return mapStep(tryBytes(under(dirs.common, 'packed-refs')), b => b === null ? [] : parse(b))
}

/**
 * How many lookups one resolution may make, symbolic hops included.
 *
 * Measured on Git 2.43.0 with a chain of symbolic refs ending at a real one:
 * a chain of four hops resolves and one of five is refused as
 * `ignoring dangling symref`. Four hops is five lookups counting the ref
 * that finally holds an id, so five is the bound, and it is the same bound
 * that catches a symbolic ref pointing at itself — Git answers that one with
 * the same message rather than looping.
 */
export const maxLookups = /** @type {const} */ (5)

/**
 * The two refs Git reads straight from the file instead of through a ref
 * store, because each may hold more than one record.
 *
 * `FETCH_HEAD` holds a line per fetched ref and `MERGE_HEAD` a line per
 * merge head, so neither is a ref a backend can hold. Git reads the first
 * record of the file, which is what a loose ref file's own grammar already
 * does — the id, one whitespace byte, then the rest unread. Measured: a
 * `FETCH_HEAD` whose first record is `not-for-merge` and whose second is the
 * merge record answers the *first* line's id to `git rev-parse FETCH_HEAD`,
 * so there is nothing to choose between the records here.
 *
 * This is why [`fjs/git/ref`](../ref/module.f.mjs) takes both as symbolic
 * targets and leaves the question to this module: whether such a target
 * resolves depends on the file being there, which the bytes of the ref
 * naming it cannot say.
 */
const special = /** @type {readonly string[]} */ (['FETCH_HEAD', 'MERGE_HEAD'])

/**
 * The id a `packed-refs` line gives a name, taking the **last** of them where
 * the file names one twice.
 *
 * A file can hold a name twice, and Git neither refuses it nor takes the
 * first: measured on Git 2.43.0, `git show-ref` lists both lines and
 * `git rev-parse` answers the last, in either order of the two. So the last
 * line is the effective value and the ones above it are dead.
 *
 * @type {(packed: readonly PackedRef[], name: Bytes) => Nullable<Oid>}
 */
const packedId = (packed, name) => {
    const hits = packed.filter(e => sameName(e.name, name))
    return hits.length === 0 ? null : hits[hits.length - 1].id
}

/** The one ref name whose target Git constrains. */
const head = /** @type {const} */ ('HEAD')

/** The prefix `HEAD`'s target must carry. */
const refsPrefix = /** @type {const} */ ('refs/')

/**
 * Whether a name is spelled the way Git spells a *pseudoref*: every character an
 * upper-case letter, `-` or `_`, and at least one of them.
 *
 * This is a rule about spelling and not a list of names, which an earlier
 * revision had it as — nine names Git's own documentation calls the ones the
 * rule is "usually useful" for. Measured on Git 2.43.0 by writing a different id
 * into each directory and asking a linked worktree:
 *
 * | name | both present | shared only | worktree only |
 * | --- | --- | --- | --- |
 * | `ORIG_HEAD` | the worktree's | no such ref | the worktree's |
 * | `BISECT_EXPECTED_REV` | the worktree's | no such ref | the worktree's |
 * | `MERGE_AUTOSTASH` | the worktree's | no such ref | the worktree's |
 * | `FOO_BAR`, `FOO-BAR`, `_FOO`, `FOO_`, `F` | the worktree's | no such ref | the worktree's |
 * | `FOO1`, `Foo`, `lowercase` | the shared one | the shared one | no such ref |
 *
 * So a name nobody has ever heard of is per worktree if it is spelled like one,
 * and a name with a digit in it is not. The last row is what makes it a syntax
 * rule rather than a longer list: `FOO1` differs from `FOO_BAR` only in a
 * character class.
 *
 * The other direction matters too. A pseudoref-shaped name is read from the
 * worktree's directory *only* — the shared-only column is "no such ref", not a
 * fallback — which is why {@link dirOf} chooses one directory rather than trying
 * both.
 *
 * @type {(text: string) => boolean}
 */
const isPseudoref = text =>
    text.length !== 0
    && [...text].every(c => (c >= 'A' && c <= 'Z') || c === '-' || c === '_')

/**
 * The prefixes under `refs/` that are per worktree.
 *
 * Not pseudorefs — they are lower-case and hold a `/` — and still the
 * worktree's: measured, a linked worktree answers its own `refs/bisect/good`,
 * and one left in the *shared* directory is invisible to that worktree
 * entirely. So "per worktree" is these two rules and neither alone.
 */
const perWorktreePrefixes = /** @type {readonly string[]} */ ([
    'refs/bisect/', 'refs/worktree/', 'refs/rewritten/',
])

/** @type {(text: string) => boolean} */
const isPerWorktree = text =>
    isPseudoref(text) || perWorktreePrefixes.some(p => text.startsWith(p))

/** @type {(text: string) => boolean} */
const isShared = text => !isPerWorktree(text)

/**
 * Which of the two directories a name's loose file sits in.
 *
 * For a main worktree the answer is the same either way, since a caller passes
 * one directory twice. For a linked worktree it is the whole difference between
 * its own `HEAD` and the main worktree's — see {@link Dirs}.
 *
 * One directory and not both, because Git reads one: a pseudoref-shaped name
 * present only in the shared directory is no ref at all to a linked worktree,
 * measured — see {@link isPseudoref}.
 *
 * @type {(dirs: Dirs, text: string) => string}
 */
const dirOf = (dirs, text) => isPerWorktree(text) ? dirs.gitdir : dirs.common

/** @type {(name: readonly number[]) => boolean} */
const isUnderRefs = name => nameText(name)?.startsWith(refsPrefix) === true

/**
 * Whether a ref read from the file called `text` is one Git allows to be there.
 *
 * Only `HEAD` is constrained, and only in its symbolic spelling: its target must
 * sit under `refs/`. A `HEAD` that points elsewhere does not make an odd ref — it
 * stops the directory being a repository at all. Measured on Git 2.43.0 with
 * `.git/HEAD` holding `ref: a/b` and `.git/a/b` holding a valid id, every one of
 * these answers `not a git repository`:
 *
 * ```
 * git rev-parse HEAD     git symbolic-ref HEAD     git show-ref
 * git rev-parse --verify HEAD                      git for-each-ref
 *                                                  git rev-list --all
 * ```
 *
 * The first column is a lookup and the second a listing, so both halves of this
 * module have to ask — which is why the rule is a function rather than a line in
 * one of them. It was a line in the lookup, and the listing was added without it:
 * `tryRoots` answered a plausible list of the other refs for a directory Git will
 * not read at all.
 *
 * One level under `refs/` is enough — `ref: refs/x` with `refs/x` present
 * resolves and is listed, measured — so the rule is the prefix and not a count of
 * components. A name that is no UTF-8 cannot start with `refs/`, so it is refused
 * here as it is everywhere else.
 *
 * @type {(text: string, r: Ref) => boolean}
 */
const targetAllowed = (text, r) =>
    r.kind !== 'symbolic' || text !== head || isUnderRefs(byteArray(r.target))

/**
 * The text of a ref name, for the path its loose file sits at, or `null` where
 * the bytes are no UTF-8.
 *
 * Decoded as UTF-8 and not a byte per code point, which is the inverse of
 * {@link nameBytes} and has to be: a name of the two bytes `0xC3 0xA9` is the
 * one character `é` on the filesystem, and reading each byte as a code point
 * would ask the host for `Ã©` instead and miss the file. Bytes that are no
 * UTF-8 name no file node could have handed us, so they answer `null` rather
 * than a path built from replacement characters.
 *
 * `null` means *no path can be built*, not that the name is bad. A ref name is
 * bytes and Git takes any byte the name rule allows —
 * `git check-ref-format refs/heads/\x80` is accepted, and `show-ref` and
 * `rev-parse` both handle such a ref, measured. What cannot carry one is this
 * host's path: node reads a directory entry as UTF-8 with replacement, so the
 * same byte comes back as U+FFFD and a `readFile` of that string answers
 * `ENOENT`, measured. The consequence for a *lookup* is
 * {@link resolveWith}'s to state, and it is a refusal;
 * [`todo/byte-ref-names.md`](./todo/byte-ref-names.md) has the rest.
 *
 * @type {(name: readonly number[]) => Nullable<string>}
 */
const nameText = name => fromVec(toVec(name))

/**
 * One lookup of a name, and the lookup after it where what was read is a
 * symbolic ref: the loose file where there is one, its `packed-refs` line where
 * there is not, and `null` for everything else — a name that is no ref name, a
 * name no path can spell, bytes that are no ref, a target `HEAD` may not have,
 * and a chain longer than the `left` it was given.
 *
 * The loose file decides the name by existing. Where it is there and holds
 * bytes that are no ref, the answer is `null` and **not** the packed line,
 * which is Git's reading: it refuses such a name outright rather than
 * falling back.
 *
 * **One effect per lookup, and the lookup after it is a self-call.** Everything
 * this needs is a parameter, so it is closed and at module scope (§3.3) and the
 * recursion is a plain self-call rather than one inside a closure. It stays a
 * recursion rather than becoming a `walkStep` because the number of lookups is
 * bounded by the format at {@link maxLookups} — Git follows four hops and
 * refuses the fifth, measured — so a resolution performs at most five reads and
 * nests at most five deep. That is the difference from the two loops in this
 * module and the two in [`fjs/git/walk`](../walk/module.f.mjs), which are walks
 * because their lengths are the repository's: a `refs/` of any size, a tag chain
 * Git puts no bound on. If the bound here ever stops being a small constant,
 * this has to become a walk for the reason `_walkLoop` exists — a `Read` that
 * answers values resumes inside its own caller, so depth follows the chain.
 *
 * @type {(dirs: Dirs, packed: readonly PackedRef[], readRef: (bytes: Bytes) => Nullable<Ref>, name: Bytes, left: number) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
const lookupIn = (dirs, packed, readRef, name, left) => {
    if (left <= 0) { return pureOk(null) }
    const dense = byteArray(name)
    // A name that is no ref name never reaches the filesystem. `..` is
    // one of the byte pairs `isWholeName` refuses, so this is also what
    // keeps `../secret` from being joined below either directory and read: a path
    // that leaves the repository is not a ref this can answer for, and
    // the file at the other end of it could begin with something that
    // looks like an id.
    if (!isWholeName(dense)) { return pureOk(null) }
    const text = nameText(dense)
    // No path can name this ref's loose file, so whether one exists is not a
    // question this host can put to the filesystem — and a loose file
    // shadows a packed line by existing, so the packed line is the answer
    // only if there is no loose file. Unknowable, not absent: answering the
    // packed line would be a stale id whenever the loose file is there, and
    // that state cannot even be constructed in a proof here, since the
    // virtual filesystem spells a directory entry as a string too.
    // Refused instead. See {@link nameText} and `todo/byte-ref-names.md`.
    if (text === null) { return pureOk(null) }
    // Which directory the name's file sits in is the name's own question,
    // not the caller's: `HEAD` is the worktree's and `refs/heads/master` is
    // the repository's. See {@link dirOf}.
    return step(tryBytes(under(dirOf(dirs, text), text)), bytes => {
        if (bytes === null) { return pureOk(special.includes(text) ? null : packedId(packed, name)) }
        const r = readRef(bytes)
        if (r === null) { return pureOk(null) }
        // The one rule about *which* file a ref was read from, which the
        // grammar over one file's bytes cannot know. See {@link targetAllowed}.
        if (!targetAllowed(text, r)) { return pureOk(null) }
        if (r.kind === 'direct') { return pureOk(r.id) }
        return lookupIn(dirs, packed, readRef, r.target, left - 1)
    })
}

/**
 * The id a name resolves to, given the packed refs already read: {@link lookupIn}
 * with the repository's directories, its packed lines and a reader of one ref
 * file bound once, so a resolution builds the reader once rather than per lookup.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, packed: readonly PackedRef[]) => (name: Bytes, left: number) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
const resolveWith = (dirs, oidBytes, packed) => {
    const readRef = tryRef(oidBytes)
    return (name, left) => lookupIn(dirs, packed, readRef, name, left)
}

/**
 * The id one ref name holds, or `null` where the repository has no such ref.
 *
 * `null` covers every way a name can fail to name an id, because to a caller
 * asking "what does this ref point at" they are one answer: no loose file
 * and no packed line, a loose file that is no ref, a symbolic ref whose
 * target is none, and a chain longer than {@link maxLookups}. A file that
 * cannot be read for any other reason is the channel's.
 *
 * The name is bytes and not text, and it is a whole ref name: `HEAD`,
 * `refs/heads/master`, `FETCH_HEAD`. One that is no ref name answers `null`
 * before any file is opened, which is the same answer a name nothing is stored
 * under gets and the only safe one: the name comes from outside — `HEAD` for a
 * checkout, a ref a person typed — and `..` is one of the byte pairs the rule
 * refuses, so `../secret` would otherwise join below the repository into a
 * path that leaves it. A file on the other side of that boundary is not a ref
 * however its first bytes read.
 *
 * `HEAD` is the one name whose target Git constrains, and this is where that
 * is enforced, because this is the half that knows which name it was asked
 * about. The module doc has the measurement.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => (name: Bytes) => Effect<ReadFile, Nullable<Oid>, IoChannel>}
 */
export const tryResolve = (dirs, oidBytes) => name =>
    step(tryPackedRefs(dirs, oidBytes), packed =>
        packed === null
            ? pureOk(null)
            : resolveWith(dirs, oidBytes, packed)(name, maxLookups))

/** @type {(state: Nullable<_Found>, items: Nullable<readonly _Entry[]>) => _Walked} */
const walked = (state, items) => [state, items]

/**
 * The code a listing is refused with when it carries one name twice: the host
 * decoded two different names to the same string, so the walk cannot tell which
 * file a name means. The module doc has the measurement and why this is a
 * refusal rather than a listing with one entry dropped.
 */
export const lossyNameCode = /** @type {const} */ ('ERR_LOSSY_NAME')

/**
 * The message beside {@link lossyNameCode}: the directory listed, and the name
 * it answered twice.
 *
 * @type {(path: string, name: string) => string}
 */
export const lossyNameMessage = (path, name) => `${path} lists two entries named ${name}`

/**
 * The name a listing carries twice, or `null` where every name in it is its
 * own.
 *
 * One pass and a map of last positions, as {@link combine} compares names: the
 * first name that is not the last of its own kind is a name that repeats. A
 * `refs/heads` of a busy repository holds tens of thousands of entries, so
 * comparing each against every other is not an option here for the same reason
 * it is not one there.
 *
 * @type {(entries: readonly Dirent[]) => Nullable<string>}
 */
const twiceNamed = entries => {
    const names = entries.map(d => d.name)
    const last = new Map(names.map((n, i) => [n, i]))
    const twice = names.find((n, i) => last.get(n) !== i)
    return twice === undefined ? null : twice
}

/** @type {(parent: _Entry) => (d: Dirent) => _Entry} */
const childOf = parent => d => ({
    path: under(parent.path, d.name),
    name: `${parent.name}/${d.name}`,
    isDirectory: d.isDirectory,
})

/**
 * The body of the walk of `refs/`: a directory gives its entries to walk
 * next, and a file gives a root or nothing.
 *
 * `null` for the state is malformed and sticky, which is Git's reading of a
 * loose file that is no ref: `git show-ref` refuses the whole listing rather
 * than dropping the one name.
 *
 * A file whose name is no ref name is skipped without a word, which is also
 * Git's — see this module's header for the table the two agree on.
 *
 * The read here is the plain one and not {@link tryBytes}: the walk has just
 * been told the file is there, so a read that cannot find it is a race or a
 * broken host rather than an absence, and the channel is where that belongs.
 *
 * `keep` says which names this walk owns, so the two walks of a `refs/` — the
 * shared directory's and the worktree's — divide the names between them and
 * neither lists one twice. In a main worktree both walks read the same
 * directory, and the division is still exactly one walk per name.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, packed: readonly PackedRef[], keep: (text: string) => boolean) => (item: _Entry) => (state: Nullable<_Found>) => Effect<Readdir | ReadFile, _Walked, IoChannel>}
 */
const looseOf = (dirs, oidBytes, packed, keep) => {
    const readRef = tryRef(oidBytes)
    const resolve = resolveWith(dirs, oidBytes, packed)
    return item => state => {
        if (state === null) { return pureOk(walked(null, null)) }
        const found = state
        if (item.isDirectory) {
            return step(readdir(item.path, {}), entries => {
                // a name the host answered twice is two files it cannot tell
                // apart; see the module doc
                const twice = twiceNamed(entries)
                return twice === null
                    ? pureOk(walked(found, entries.map(childOf(item))))
                    : pureError(ioError({
                        code: lossyNameCode,
                        message: lossyNameMessage(item.path, twice),
                    }))
            })
        }
        if (!keep(item.name)) { return pureOk(walked(found, null)) }
        const name = nameBytes(item.name)
        if (!isWholeName(name)) { return pureOk(walked(found, null)) }
        // the name is recorded whatever the file turns out to hold, because
        // that is what shadows the packed line
        const names = concat(found.names)([name])
        /** @type {(bytes: Bytes) => Effect<ReadFile, _Walked, IoChannel>} */
        const cont = bytes => {
            const r = readRef(bytes)
            if (r === null) { return pureOk(walked(null, null)) }
            if (r.kind === 'direct') {
                return pureOk(walked({ roots: concat(found.roots)([{ name, id: r.id }]), names }, null))
            }
            return mapStep(
                resolve(r.target, maxLookups - 1),
                id => walked(
                    { roots: id === null ? found.roots : concat(found.roots)([{ name, id }]), names },
                    null))
        }
        return step(mapStep(readFile(item.path), toBytes), cont)
    }
}

/**
 * The roots the walk found, then the packed lines nothing hides.
 *
 * A packed line is dropped for either of two reasons. A loose file of the same
 * name hides it, by existing — see {@link _Found}. And a *later* packed line of
 * the same name hides it, because a file may name a ref twice and Git takes
 * the last: measured on Git 2.43.0, `git show-ref` lists both lines and
 * `git rev-parse` answers the last, in either order. Keeping both would break
 * the one-entry-per-name this function promises.
 *
 * @type {(found: _Found, packed: readonly PackedRef[]) => readonly Root[]}
 */
const combine = (found, packed) => {
    const shadowed = new Set(toArray(found.names).map(nameKey))
    // The last line of each name, as one pass: the `Map` constructor keeps the
    // later entry for a repeated key, which is the rule this needs.
    const last = new Map(packed.map((p, i) => [nameKey(p.name), i]))
    return [
        ...toArray(found.roots),
        ...packed
            .filter((p, i) => {
                const k = nameKey(p.name)
                return !shadowed.has(k) && last.get(k) === i
            })
            .map(p => ({ name: p.name, id: p.id })),
    ]
}

/** The one directory name refs live under, in either of the two directories. */
const refsDir = /** @type {const} */ ('refs')

/**
 * A worktree's own `refs/` as the walk's first item, or nothing where it has
 * none.
 *
 * Found by listing the worktree's directory rather than by reading `refs/`
 * and forgiving an absence, because a worktree has a `refs/` of its own only
 * while a bisect or a rebase is running — most of the time there is nothing
 * there — and this module's rule everywhere else is that a `readdir` which
 * cannot find what a *listing* named is the channel's. Asking the listing keeps
 * that rule rather than making an exception to it: the directory is there if the
 * listing says so.
 *
 * @type {(dirs: Dirs) => Effect<Readdir, readonly _Entry[], IoChannel>}
 */
const ownRefs = dirs =>
    mapStep(
        readdir(dirs.gitdir, {}),
        entries => entries
            .filter(d => d.isDirectory && d.name === refsDir)
            .map(d => ({ path: under(dirs.gitdir, d.name), name: d.name, isDirectory: true })))

/** The ref name `HEAD` is, as the bytes the rest of this module compares. */
const headName = nameBytes(head)

/**
 * What `HEAD` contributes to the walk's findings: one root where it holds an id,
 * none where it names a branch, and `null` where it is there and is no ref or
 * points outside `refs/`.
 *
 * A branch `HEAD` adds no root — the branch is already one at the same id — so
 * only the detached spelling is a root, and `tryRoots`' doc has the measurements
 * for both.
 *
 * **The name is recorded whichever it holds, so the file shadows a `packed-refs`
 * line naming `HEAD`.** That is the module's shadowing rule — a loose file wins
 * by existing — applied to the one name that is not under `refs/`, and without it
 * the listing carried two entries called `HEAD`. Git has both: measured on Git
 * 2.43.0 with a packed `HEAD` line beside a detached `HEAD` file,
 * `git show-ref --head` prints two `HEAD` lines and `git rev-list --all` keeps
 * both ids, while `git rev-parse HEAD` answers the file and `git for-each-ref`
 * lists neither. So the file is what the name *means*, which is the winner this
 * defines; and `git pack-refs` never writes such a line, so the collision only
 * arises in a file made by hand.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => Effect<ReadFile, Nullable<_Found>, IoChannel>}
 */
const tryHeadFound = (dirs, oidBytes) => {
    const readRef = tryRef(oidBytes)
    return mapStep(tryBytes(under(dirs.gitdir, head)), bytes => {
        if (bytes === null) { return { roots: [], names: [] } }
        const r = readRef(bytes)
        if (r === null) { return null }
        // The same rule the lookup asks, and for the same reason: a `HEAD`
        // pointing outside `refs/` is no repository, so there is no list of its
        // refs to answer. See {@link targetAllowed}.
        if (!targetAllowed(head, r)) { return null }
        return {
            roots: r.kind === 'direct' ? [{ name: headName, id: r.id }] : [],
            names: [headName],
        }
    })
}

/**
 * Every ref the repository holds, as a name and the id it effectively
 * names: the retention roots, and the ids a search for candidate commits
 * may start from.
 *
 * `null` where the ref files are ones Git refuses — a `packed-refs` it
 * would call `unexpected line`, or a loose file under `refs/` that is no
 * ref, which it calls `bad ref` and refuses the whole listing for.
 *
 * A `refs/` that cannot be listed is the channel's rather than an empty
 * answer, because a directory without one is no repository: `git init`
 * makes it, `git pack-refs --all` leaves it behind empty rather than
 * removing it, and a bare repository has it too — all three measured. A
 * `packed-refs` that is not there *is* an answer, on the other hand, since
 * a repository that has never been packed has no such file.
 *
 * A loose ref shadows the packed line of the same name, so a name in both
 * places appears once, with the loose value. It shadows by existing: a loose
 * symbolic ref whose target is nowhere yields no root and the packed line
 * still does not come back, since the loose file is what the repository now
 * says about that name. A symbolic loose ref that does resolve is answered
 * resolved, which is what `git show-ref` lists for one.
 *
 * One name, one entry, whatever the files do: a `packed-refs` naming a ref
 * twice contributes its last line and not both.
 *
 * The order is the walk's and then the file's, and it means nothing: Git
 * sorts its own listing and this does not, because a caller that wants an
 * order has one to apply and no rule here depends on it. The one ordering
 * question that *is* a rule — which of two files holding a name wins — is
 * settled before the list is built, not by where an entry sits in it.
 *
 * The id a ref names need not be a commit's: a tag ref names an annotated
 * tag object, so a caller after commits peels through
 * [`fjs/git/tag`](../tag/module.f.mjs) rather than assuming.
 *
 * **A detached `HEAD` is here, and an attached one is not.** `HEAD` is not a
 * root when it names a branch, because the branch is one and the two name the
 * same id. When it holds an id itself, nothing else names that commit and it is
 * a root on its own — measured on Git 2.43.0 in a repository detached with no
 * refs at all, where `show-ref` and `for-each-ref` list nothing while
 * `rev-list --all` lists the commit, `fsck` calls nothing unreachable, and
 * `gc --prune=now` does not prune it. Returning nothing for that repository
 * would be a plausible empty answer for the very purpose this list has.
 *
 * `HEAD` that is not there contributes no root rather than refusing, and that
 * is a narrower claim than Git's: a directory with no `HEAD` is no repository
 * to Git, which answers `not a git repository` for `show-ref` as readily as for
 * `rev-list`, measured — and it answers the same for a `HEAD` holding bytes
 * that are no ref. But this module is *given* a directory rather than finding
 * one, and whether a repository is there is what
 * [`fjs/git/repo`](../repo/module.f.mjs) and `fjs/git/store`'s `config` read
 * say. A `HEAD` that is there and is no ref *is* this function's business, and
 * refuses the listing the way a broken loose ref does.
 *
 * Every other name outside `refs/` stays out: {@link tryResolve} answers one by
 * name for a caller that wants it.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => Effect<Readdir | ReadFile, Nullable<readonly Root[]>, IoChannel>}
 */
export const tryRoots = (dirs, oidBytes) => {
    /** @type {_Entry} */
    const shared = { path: under(dirs.common, refsDir), name: refsDir, isDirectory: true }
    /** @type {Nullable<_Found>} */
    const init = { roots: [], names: [] }
    // Four effects, one link each and all at one level, so the order they run
    // in is the order they are written: the packed file, the shared walk of
    // `refs/`, the worktree's own walk, and `HEAD`. Each link carries the
    // earlier values forward through `historyStep` rather than nesting to reach
    // them, and each is skipped once something before it has refused, which is
    // what the `null`s in front of them are for.
    //
    // The shared walk takes the shared names and the worktree's walk takes the
    // per-worktree ones, so a name is listed once whether the two directories
    // are one or two. The worktree's `refs/` is usually not there at all — a
    // linked worktree has one only while a bisect or a rebase is running — so it
    // is found by listing the worktree's directory rather than by reading a path
    // that may not be there. See {@link ownRefs}.
    const read = history(tryPackedRefs(dirs, oidBytes))
    // A refusal is `null` at every link, including the first: answering `init`
    // here instead — a `_Found` of nothing, which unifies with the walk's own
    // answer — let the chain continue past a `packed-refs` Git refuses, and the
    // `HEAD` read at the end then had a whole file's worth of ways to fail in
    // place of an answer this function had already decided.
    const sharedWalk = historyStep(read, packed => packed === null
        ? pureOk(/** @type {Nullable<_Found>} */ (null))
        : walkStep(pureOk([shared]), init, looseOf(dirs, oidBytes, packed, isShared)))
    // The refusals are tested oldest first, which is not a style choice: a later
    // one implies every earlier one, so asking about an earlier refusal after a
    // later one is a question with only one answer — a branch no input reaches.
    const ownWalk = historyStep(sharedWalk, (found, packed) => packed === null || found === null
        ? pureOk(found)
        : walkStep(ownRefs(dirs), found, looseOf(dirs, oidBytes, packed, isPerWorktree)))
    const headRead = historyStep(ownWalk, found => found === null
        ? pureOk(/** @type {Nullable<_Found>} */ (null))
        : tryHeadFound(dirs, oidBytes))
    // newest first, and the shared walk's own answer is skipped because the
    // worktree's walk carried it forward as its starting state
    return mapStep(headRead, ([h, found, , packed]) =>
        packed === null || found === null || h === null
            ? null
            : combine({
                roots: concat(found.roots)(h.roots),
                names: concat(found.names)(h.names),
            }, packed))
}
