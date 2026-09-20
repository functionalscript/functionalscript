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
 * That rule holds for every name under `refs/` and for no other, which is
 * measured rather than assumed: a shadowed packed line is unreachable and
 * `git gc --prune=now` prunes its commit, while a packed line named `HEAD`
 * beside the `HEAD` file is a root Git keeps. So the one collision outside
 * `refs/` is refused rather than shadowed — see {@link packedHeadCode}.
 *
 * **A ref name that is no ref name is two answers and not one.** Git's walk of
 * `refs/` skips two *file-name conventions* without a word and refuses the whole
 * listing for every other name it cannot read as a ref. Measured by writing a
 * valid id into each of these under `refs/heads/` and asking `git show-ref`,
 * beside `git check-ref-format` on the same name:
 *
 * | file | `show-ref` | `check-ref-format` |
 * | --- | --- | --- |
 * | `plain` | listed, exit 0 | ok |
 * | `.hidden` | skipped, exit 0 | refused |
 * | `x.lock` | skipped, exit 0 | refused |
 * | `bad.` | `bad ref refs/heads/bad.`, exit 128 | refused |
 * | `a..b`, `a@{b` | `bad ref …`, exit 128 | refused |
 * | `has space`, `tilde~x`, `caret^x` | `bad ref …`, exit 128 | refused |
 *
 * So `check-ref-format` is the wrong line to cut the listing on: the two skipped
 * names are the ones whose *components* no ref name may hold —
 * [`fjs/git/refname`](../refname/module.f.mjs)'s `hasRefComponents` — and every
 * other broken name is `bad ref`, the same answer Git gives a loose file whose
 * *contents* are no ref. This module answers both the same way:
 * {@link badNameCode} refuses the listing where Git does, and the two
 * conventions are skipped.
 *
 * The component rule is also the only one safe to apply before an entry's kind
 * is known. A whole name may fail on its last byte and still be a directory of
 * valid names — `refs/heads/bad.` is no ref name, `refs/heads/bad./v1` is one,
 * and with the first a symlink to `refs/tags` Git lists the second at exit 0 —
 * so skipping it by the whole-name rule would lose a subtree without a word.
 *
 * A name is not the only thing the walk judges an entry on. A listing answers
 * `isFile: false, isDirectory: false` for a FIFO and for every symlink alike,
 * because it does not follow one, and those two want opposite answers: Git skips
 * the FIFO and follows the link. So an entry a listing cannot classify costs one
 * `stat`, which follows the link without opening what it finds. The
 * measurements are at `looseOf` and {@link statted}.
 *
 * The filter runs before a path is built and not after a file is read, which
 * matters for a name a caller passes in rather than one a directory listing
 * handed over: `..` is one of the byte pairs the rule refuses, so a name like
 * `../secret` never becomes a path below the repository and is never opened. A
 * *name* that climbs out of the repository is no ref however the file it would
 * reach reads.
 *
 * That is a rule about names and not about where a file finally sits. A
 * **link** under `refs/` is followed wherever it goes, which is Git's answer:
 * measured on 2.43.0, `refs/heads/o` linked to a file outside the repository
 * holding an id is listed by `show-ref` and `for-each-ref` and answered by
 * `rev-parse`, and this module lists it too. `HEAD` is the one path where a link
 * is refused instead, for the reason {@link headIsFile} argues — there the link
 * is what a repository would use to make this module read a file that is not in
 * it, and nothing in these effects can see where a link points.
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
 * `packed-refs` line, which never becomes a path, and **the two halves answer it
 * differently on purpose**. {@link tryRoots} lists it: the walk read every entry
 * of `refs/` and would have refused a file it could not name, so it knows no
 * loose file shadows that line. {@link tryResolve} answers `null`: it does not
 * look, and no path can be built to ask whether a loose file of that name is
 * there, so the packed id would be a stale answer in exactly the state this host
 * cannot observe. A *loose* file of the name is unreachable either way, because
 * node hands back U+FFFD for the byte and a read of the decoded string is
 * `ENOENT`.
 *
 * That disagreement is the one place the two halves of this module answer one
 * name differently, and it is a gap and not a rule: what it costs each half, and
 * the path API that speaks bytes and would close it, are
 * [`todo/byte-ref-names.md`](./todo/byte-ref-names.md). `byteName` in the proof
 * asserts both answers on one fixture.
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
 * **Every effect is bound at one level, and a branch that reads is not a
 * sequence.** The listing's four links go through `historyStep`, the walk of
 * `refs/` and the walk down a symbolic chain through `walkStep`, and each read
 * is bound to a name before the `step` that consumes it — the shapes
 * [§3.4](../../AGENTS.md) forbids, a `step` inside a `step` and a loop written
 * as a recursion, are not here.
 *
 * What is left inside a continuation is a *choice*, and it cannot be lifted out:
 * a loose file that turns out to be symbolic is resolved and one that holds an
 * id is not, a name with no loose file answers from `packed-refs` instead, and
 * which of those happens is known only once the file has been read. §3.4 says as
 * much where it explains why the combinators themselves nest — a name cannot be
 * bound to an effect that has not been produced yet. Binding one anyway would
 * mean reading a file this module has just decided not to read.
 *
 * **A `packed-refs` may name one ref twice, and the two halves answer that
 * differently.** Measured: `git show-ref` and `git for-each-ref` list both lines
 * while `git rev-parse` answers the last, in either order of the two, and
 * `git gc --prune=now` with every reflog expired keeps the commit only the
 * *earlier* line names. So the last line is the name's *value* and the earlier
 * ones are still retention roots — not dead, as an earlier revision of this
 * paragraph had it. The lookup answers the last; the listing refuses the file,
 * because one entry per name cannot hold both roots — {@link packedTwiceCode}.
 * A name repeated at one id loses nothing and is answered once.
 *
 * **A ref may hold the id no object has, and the listing refuses that too.**
 * Measured with `refs/heads/zero` at forty zeros, loose and packed alike:
 * `show-ref` answers `bad ref refs/heads/zero (0000…)` and exits 128 while
 * `rev-parse` prints the id and exits 0. This module follows each in its own
 * half — {@link zeroIdCode}.
 *
 * **The `sorted` trait is not read, so a lookup here scans.** The file's header
 * may promise that its records are in lexical order, and Git's lookup bisects on
 * that promise: measured with the trait claimed and `refs/heads/z` written before
 * `refs/heads/a`, `git rev-parse --verify refs/heads/z` fails and
 * `git show-ref --verify` calls it not a valid ref, while `show-ref` and
 * `for-each-ref` both list it. A scan finds it, so this module answers what the
 * file says and what Git's own iteration says.
 *
 * That difference is left rather than imitated, because Git's answer on such a
 * file is not a rule: which records a bisection of an unsorted file finds depends
 * on its probe sequence, so two readers that both honour the trait can disagree
 * about the same bytes. What is worth taking from the trait is the lookup that
 * does not scan, and that wants the traits carried out of
 * [`fjs/git/ref`](../ref/module.f.mjs) —
 * [`todo/packed-refs-sorted.md`](./todo/packed-refs-sorted.md).
 *
 * **Writing a ref is one file and a lock, and it is not the mirror of reading
 * one.** {@link tryWrite} writes the loose file below whichever of the two
 * directories the name belongs to, through the `.lock` name Git uses. It reads
 * one file first — `packed-refs`, for the one collision no filesystem can
 * refuse, a packed name that is a directory prefix of the one being written
 * ({@link refPrefixCode}) — and does nothing else: it does not rewrite `packed-refs`, append a reflog line, follow
 * a symbolic ref already at the name, or check that the object is there — nor,
 * for a name under `refs/heads/`, that it is a commit, which Git constrains in
 * that one namespace and nowhere else. Each of
 * those is measured against `git update-ref` and named at {@link tryWrite},
 * because each is a way this writer is *narrower* than Git rather than different
 * from it — the one place it is narrower on purpose is the name, which must be
 * under `refs/` ({@link outsideRefsCode}).
 *
 * Deleting one is the harder half and is not here: a name can be in a loose file
 * *and* a `packed-refs` line, so the loose file must go and the line with it or
 * the line comes back as the ref. [`../todo/ref-writing.md`](../todo/ref-writing.md)
 * has both, and the reflog.
 *
 * @module
 *
 * @import { Dirent, FileStat, Mkdir, ReadFile, ReadWhole, Readdir, Rename, Rm, Stat, WriteExclusive } from '../../effects/node/types.ts'
 * @import { Effect, Operation } from '../../effects/types.ts'
 * @import { IoChannel } from '../../effects/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../types.ts'
 * @import { PackedRef, Ref } from '../ref/types.ts'
 * @import { Dirs, Root } from './types.ts'
 * @import { _Entry, _Found, _Lookup, _Scope, _Walked } from './private.ts'
 */

import { catchStep, foldStep, history, historyStep, ioError, mapStep, pureError, pureOk, resultStep, step, walkStep } from '../../effects/module.f.mjs'
import { isDirectory, isNotFound, leadsNowhere, mkdir, readFile, readWholeBytes, readdir, rename, rm, stat, writeExclusiveUtf8File } from '../../effects/node/module.f.mjs'
import { byteArray } from '../../ebnf/byte/module.f.mjs'
import { under } from '../../path/module.f.mjs'
import { fromCodePointList, fromVec } from '../../text/utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { length, maxLengthBytes, msb, u8List, u8ListToVec, uint } from '../../types/bit_vec/module.f.mjs'
import { concat, toArray } from '../../types/list/module.f.mjs'
import { hexText } from '../oid/module.f.mjs'
import { tryPacked, tryRef } from '../ref/module.f.mjs'
import { hasRefComponents, isWholeName, lockSuffix } from '../refname/module.f.mjs'

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
 * line, where this is one pass and a lookup each: measured over 20,000 names,
 * the pairwise shape is two orders of magnitude slower, and `git pack-refs` on
 * a busy repository writes more lines than that.
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
 * The bytes of a file, or `null` where there is no loose *file* at that name.
 *
 * A missing file is an answer here rather than a failure: a repository with
 * nothing packed has no `packed-refs`, and one whose refs are all packed has
 * an empty `refs/`. Every other error is the channel's.
 *
 * **A directory at the name is that same answer, and not a failure.** A ref name
 * can be a prefix of other ref names, so `refs/heads` is both a name a
 * `packed-refs` line may carry and the directory the loose ones live in.
 * Measured on Git 2.43.0 with `<id> refs/heads` packed: `git rev-parse --verify
 * refs/heads` answers the id and `git show-ref` lists it beside
 * `refs/heads/master`. Forgiving only `ENOENT` turned that into a channel error,
 * so a name Git resolves could not be resolved here at all — and the rule this
 * function is stating is "no loose file shadows the packed line", which a
 * directory does not.
 *
 * `EISDIR` is what node answers for such a read on Linux, macOS and Windows, and
 * it is *not* what this rule rests on. A host is free to hand over the
 * directory's bytes instead — `fjs/effects/node/virtual`'s `resolveFile` records
 * that FreeBSD does — and then nothing here fails and the bytes are simply no
 * ref. So the code is forgiven where it comes, and where bytes arrive that no
 * ref reader takes, {@link lookupOf} asks the entry's kind and treats a
 * directory as this same absence. The rule is the kind; the code is one host's
 * way of saying it.
 *
 * A ref file is one line — an id and a newline, or `ref:` and a name — so this
 * reads it whole through {@link readFile}, whose answer is a `Vec` and so is
 * bounded at 128 KiB. A loose ref larger than that is refused rather than read;
 * Git would read it and call it no ref, so this is narrower by a refusal and not
 * by a wrong answer, and no repository has one by accident. `packed-refs` is the
 * file whose size *is* unbounded, and it is read by {@link tryWholeBytes}.
 *
 * @type {(path: string) => Effect<ReadFile, Nullable<Bytes>, IoChannel>}
 */
const tryBytes = path =>
    catchStep(
        mapStep(readFile(path), toBytes),
        e => isNotFound(e) || isDirectory(e) ? pureOk(null) : pureError(e))

/**
 * The same, for a file with no bound on its size: read in windows rather than
 * through a `Vec`.
 *
 * @type {(path: string) => Effect<ReadWhole, Nullable<Bytes>, IoChannel>}
 */
const tryWholeBytes = path =>
    catchStep(
        readWholeBytes(path),
        e => isNotFound(e) ? pureOk(/** @type {Nullable<Bytes>} */ (null)) : pureError(e))

/** The one file a repository's packed refs are in, beside `refs/` in the shared directory. */
const packedRefs = /** @type {const} */ ('packed-refs')

/**
 * The `packed-refs` entries, `[]` where the file is not there, and `null`
 * where it is there and is one Git refuses.
 *
 * The three answers are distinct on purpose: a repository with nothing
 * packed and one whose `packed-refs` is malformed are not the same, and Git
 * treats them differently — the first is ordinary, the second is
 * `fatal: unexpected line`.
 *
 * **This file does not fit a `Vec`, and an ordinary repository is where it stops
 * fitting.** A record is an id, a space, a name and a newline — 70 bytes at
 * `refs/heads/topic/feature-<n>`, measured — so `readFile`'s 131,072 is spent at
 * about 1,870 refs, and a repository of 4,000 branches writes a 282,939-byte file
 * that Git reads without comment. Reading it through `readFile` therefore failed
 * for a repository this module's own notes are tuned for: the remark at
 * {@link packedId} about 20,000 names is about a file five times past the point
 * this could open. {@link readWholeBytes} reads it in windows instead, into a
 * byte list, which is what `tryPacked` takes.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => Effect<ReadWhole, Nullable<readonly PackedRef[]>, IoChannel>}
 */
export const tryPackedRefs = (dirs, oidBytes) => {
    const parse = tryPacked(oidBytes)
    return mapStep(tryWholeBytes(under(dirs.common, packedRefs)), b => b === null ? [] : parse(b))
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
 * `git rev-parse` answers the last, in either order of the two. So the last line
 * is the name's effective *value*, which is what this function is for.
 *
 * The earlier lines are not *dead*, which is a different question and one this
 * function does not answer: `git gc` keeps the commit an earlier line names, so
 * each is a retention root. That is why the listing refuses such a file rather
 * than taking this value — see {@link packedTwiceCode}.
 *
 * A scan and not a bisection, which the module doc argues: the `sorted` trait
 * that would justify one is not read yet, and a scan finds every record the file
 * holds rather than the ones a bisection's probes happen to reach.
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
 * The two walks of `refs/` divide the names between them, and a *directory* is
 * where that division has to be asked differently: `keep` is a rule about a
 * whole ref name, and a directory is a prefix of names that do not exist yet.
 *
 * `refs/bisect` is the case. It is not itself a per-worktree name — the rule is
 * the prefix `refs/bisect/`, with the slash — so the shared walk's `isShared`
 * says "mine" about the directory and "not mine" about every ref inside it. It
 * listed a subtree it then dropped whole, which is a `readdir` of a directory
 * this walk has no name to take from it, and a directory another worktree is
 * free to remove while a `git bisect reset` runs: a listing that fails there is
 * the channel's, so a lookup could fail over refs it would never have answered.
 *
 * So each walk carries a second rule, about a prefix rather than a name:
 *
 * - the shared walk descends unless **every** name under the prefix is per
 *   worktree, which is {@link holdsPerWorktreeOnly};
 * - the worktree's walk descends only where **some** name under it could be,
 *   which is {@link mayHoldPerWorktree} — so it no longer walks `refs/heads`
 *   and the rest of the tree to drop every leaf, and in a main worktree, where
 *   both walks read one directory, the tree is listed once rather than twice.
 *
 * The pseudoref half of {@link isPerWorktree} is no part of either: a walk that
 * starts at `refs` produces names holding a `/`, and those are never spelled
 * like a pseudoref.
 *
 * @type {(text: string) => boolean}
 */
const holdsPerWorktreeOnly = text => perWorktreePrefixes.some(p => `${text}/`.startsWith(p))

/** @type {(text: string) => boolean} */
const mayHoldPerWorktree = text =>
    perWorktreePrefixes.some(p => p.startsWith(`${text}/`) || `${text}/`.startsWith(p))

/** What the walk of the shared directory owns: every name no worktree keeps for itself. */
const sharedScope = /** @type {_Scope} */ ({
    keep: isShared,
    descend: text => !holdsPerWorktreeOnly(text),
})

/** And what a worktree's own walk owns: the per-worktree names, and nothing else. */
const worktreeScope = /** @type {_Scope} */ ({
    keep: isPerWorktree,
    descend: mayHoldPerWorktree,
})

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
 * **A name past `maxLengthBytes` is `null` too**, and the check has to come
 * before the conversion: `Bytes` is unbounded and `u8ListToVec` asserts, so one
 * byte over escaped both {@link tryWrite} and {@link tryResolve} as a bare
 * `'assertion failed'` rather than as an answer — measured, at 131,073 bytes.
 * Found by review of
 * [#2115](https://github.com/functionalscript/functionalscript/pull/2115).
 *
 * `null` rather than a code of its own because it is the same *kind* of answer:
 * there is no string to build a path from. It is **not** that the name is too
 * long for a filesystem — that is a different refusal and comes from one. A
 * name of 300 bytes converts, spells a path, and is refused by the host with
 * `ENAMETOOLONG`; measured, `git update-ref` is refused the same way and five
 * bytes earlier than `NAME_MAX` would suggest, because the lock file is what
 * fails: a last component of 250 bytes succeeds and 251 gives
 * `Unable to create '….lock': File name too long`. This writer inherits that
 * limit from the same `.lock`, which is parity rather than narrowness. Neither
 * bound is the other's, and only the conversion one is decided here.
 *
 * @type {(name: readonly number[]) => Nullable<string>}
 */
const nameText = name =>
    name.length > Number(maxLengthBytes) ? null : fromVec(toVec(name))

/**
 * A chain that has its answer: the id, and no lookups left to spend and no name
 * left to walk.
 *
 * Every way a resolution can end goes through this, an id and a refusal alike,
 * so a link that answers reads the same whichever it is.
 *
 * The packed lines come with it, because whether they were read is an answer of
 * its own: {@link tryResolve} reads them at the end where no link needed them,
 * and a state that lost them would read a file twice or not at all.
 *
 * @type {(id: Nullable<Oid>, packed: Nullable<readonly PackedRef[]>) => readonly [_Lookup, List<Bytes>]}
 */
const answered = (id, packed) => [{ id, left: 0, packed }, null]

/**
 * The path spelling of a name this module can answer for, or `null` where it
 * cannot — which is one answer and not two, because both reasons mean the same
 * thing to a caller: no file of this repository is that ref's.
 *
 * Asked *before* anything is read, by both callers. {@link tryResolve} promises
 * that a name which is no ref name is `null` "before any file is opened", and
 * that promise was not kept: the `packed-refs` read came first, so a
 * `packed-refs` the host refuses for any reason other than absence made the
 * answer for `../secret` a channel error rather than `null` — a value known not
 * to be a ref, answered out of the filesystem's state.
 *
 * @type {(name: Bytes) => Nullable<string>}
 */
const askable = name => {
    const dense = byteArray(name)
    // A name that is no ref name never reaches the filesystem. `..` is
    // one of the byte pairs `isWholeName` refuses, so this is also what
    // keeps `../secret` from being joined below either directory and read: a path
    // that leaves the repository is not a ref this can answer for, and
    // the file at the other end of it could begin with something that
    // looks like an id.
    if (!isWholeName(dense)) { return null }
    // No path can name this ref's loose file, so whether one exists is not a
    // question this host can put to the filesystem — and a loose file
    // shadows a packed line by existing, so the packed line is the answer
    // only if there is no loose file. Unknowable, not absent: answering the
    // packed line would be a stale id whenever the loose file is there, and
    // that state cannot even be constructed in a proof here, since the
    // virtual filesystem spells a directory entry as a string too.
    // Refused instead. See {@link nameText} and `todo/byte-ref-names.md`.
    return nameText(dense)
}

/**
 * `HEAD`'s bytes, or a refusal where it is not a regular file.
 *
 * **The lookup refuses a symlink `HEAD` because following one reads a file
 * outside the repository.** Measured on Git 2.43.0, and the rule is `HEAD`'s
 * alone:
 *
 * ```
 * $ ln -s /elsewhere/holding-an-id .git/HEAD
 * $ git rev-parse HEAD        # fatal: not a git repository
 * $ ln -s /elsewhere/holding-an-id .git/ORIG_HEAD
 * $ git rev-parse ORIG_HEAD   # the id
 * ```
 *
 * So Git refuses the *repository* over `HEAD` and follows the link for every
 * other name in the same directory — which is why this asks about one name and
 * not about a kind of name. Without it, `.git/HEAD` naming a file whose first
 * line reads as an id answered that id: a plausible value from the other side of
 * the boundary this module's header claims, which is the answer
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) says
 * to refuse.
 *
 * A listing is what sees it, for the reason {@link headIsFile} gives — every
 * other way to ask about a path follows the link. So this is where the lookup
 * pays a `readdir` it otherwise would not, once, and only for `HEAD`:
 * {@link tryRoots} was already paying it, which is why the two halves used to
 * disagree ([`todo/symlink-head.md`](./todo/symlink-head.md)). An `lstat` would
 * answer the same question without the listing.
 *
 * A gitdir that is not there is no `HEAD` rather than a failure, which is what
 * the read it replaces answered.
 *
 * @type {(dirs: Dirs) => Effect<Readdir | ReadFile, Nullable<Bytes>, IoChannel>}
 */
const headBytes = dirs => catchStep(
    step(readdir(dirs.gitdir, {}), entries => headIsFile(entries)
        ? tryBytes(under(dirs.gitdir, head))
        : pureError(ioError({
            code: headKindCode,
            message: headKindMessage(under(dirs.gitdir, head)),
        }))),
    e => isNotFound(e) ? pureOk(/** @type {Nullable<Bytes>} */ (null)) : pureError(e))

/**
 * Whether the path is a directory, for a read that came back with bytes no ref
 * reader can take.
 *
 * A link that leads nowhere between the read and this question is not a
 * directory, and not a failure either: the answer is about what was read, and a
 * name whose file has just gone is one this walk answers `null` for anyway.
 *
 * @type {(path: string) => Effect<Stat, boolean, IoChannel>}
 */
const isDirectoryAt = path => catchStep(
    mapStep(stat(path), s => s.isDirectory),
    e => leadsNowhere(e) ? pureOk(false) : pureError(e))

/**
 * One link of the walk down a symbolic chain: the file the name sits in, read,
 * and then either the id it holds or the next name to look up.
 *
 * The answers are the walk's state and the item it produces. An id ends the
 * chain, and so does every way a name can fail to name one — a name that is no
 * ref name, a name no path can spell, bytes that are no ref, a target `HEAD` may
 * not have, no loose file and no packed line, and a chain that has spent the
 * lookups it was given. A symbolic ref produces its target as the one item to
 * walk next.
 *
 * The loose file decides the name by existing. Where it is there and holds
 * bytes that are no ref, the answer is `null` and **not** the packed line,
 * which is Git's reading: it refuses such a name outright rather than
 * falling back.
 *
 * **A walk and not a recursion**, which is this module's other loop's shape and
 * `fjs/git/walk`'s: one effect per link, all at one level, and the next link is
 * an item rather than a call from inside this one's continuation (§3.4). The
 * bound rides in the state — `left` is how many lookups remain, five at the
 * start, which is Git's own limit and measured: it follows four hops and refuses
 * the fifth. Written as a self-call the effects were flat within a link and
 * nested across links, and the bound made that harmless rather than right;
 * nothing about the loop needed the recursion, so it is gone.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, readRef: (bytes: Bytes) => Nullable<Ref>) => (name: Bytes) => (state: _Lookup) => Effect<Stat | ReadWhole | Readdir | ReadFile, readonly [_Lookup, List<Bytes>], IoChannel>}
 */
const lookupOf = (dirs, oidBytes, readRef) => name => state => {
    if (state.left <= 0) { return pureOk(answered(null, state.packed)) }
    // Every link's name is asked about, not only the caller's: a symbolic ref
    // names its target, and the target is as much from outside the repository as
    // the name a caller typed.
    const text = askable(name)
    if (text === null) { return pureOk(answered(null, state.packed)) }
    // Which directory the name's file sits in is the name's own question,
    // not the caller's: `HEAD` is the worktree's and `refs/heads/master` is
    // the repository's. See {@link dirOf}.
    const path = under(dirOf(dirs, text), text)
    const read = text === head ? headBytes(dirs) : tryBytes(path)
    const noFile = () => fromPacked(dirs, oidBytes, text, name, state)
    // A read that answered *bytes that are no ref* is two different repositories
    // — a loose file Git calls `bad ref`, or a directory a host handed over
    // instead of failing — and only the kind tells them apart. See
    // {@link tryBytes}. `HEAD` is not asked: its kind came from the gitdir's
    // listing before it was read at all.
    return step(read, bytes => bytes === null
        ? noFile()
        : text === head || readRef(bytes) !== null
            ? pureOk(stepped(readRef, text, state, bytes))
            : step(isDirectoryAt(path), dir => dir
                ? noFile()
                : pureOk(stepped(readRef, text, state, bytes))))
}

/**
 * What a name with no loose file resolves to: its `packed-refs` line, or nothing.
 *
 * **The packed file is read here and not before the loose one**, which is the
 * order a `git pack-refs` running underneath makes matter. That command writes
 * the new packed file and then prunes the loose refs it packed — `--prune` is
 * its default and `git gc` runs it — so a lookup that snapshots `packed-refs`
 * first can see neither copy of a ref that existed throughout: not the snapshot,
 * which predates the pack, and not the loose file, which is gone by the time it
 * is read. Read in this order the ref is found either way round, and
 * {@link tryRoots} takes the same order for the same reason.
 *
 * It is read *once* per resolution, not once per link: a `packed-refs` entry is
 * always a direct id, so a link that reads one ends the chain, and the state
 * carries the lines for the only other reader of them — {@link tryResolve}'s
 * check that the file is one Git reads at all. {@link resolveWith} seeds that
 * state, so a listing resolves its symbolic refs against the file it has already
 * read rather than reading it again.
 *
 * `FETCH_HEAD` and `MERGE_HEAD` do not fall back to a packed line of that name,
 * and so do not read the file at all: Git reads those two from their own file —
 * see {@link special}.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, text: string, name: Bytes, state: _Lookup) => Effect<ReadWhole, readonly [_Lookup, List<Bytes>], IoChannel>}
 */
const fromPacked = (dirs, oidBytes, text, name, state) => {
    if (special.includes(text)) { return pureOk(answered(null, state.packed)) }
    if (state.packed !== null) { return pureOk(answered(packedId(state.packed, name), state.packed)) }
    return mapStep(tryPackedRefs(dirs, oidBytes), packed => packed === null
        // a `packed-refs` Git refuses is every name's answer, which is Git's:
        // measured, `git rev-parse refs/heads/master` on a repository with a
        // malformed file answers `unexpected line` and resolves nothing
        ? answered(null, state.packed)
        : answered(packedId(packed, name), packed))
}

/**
 * What one link makes of a loose ref file's bytes: the state the walk carries on
 * with, and the names it has left to walk.
 *
 * The file is there, which is the case this answers — an absent one is
 * {@link fromPacked}, and the two are separate because only that one reads
 * another file.
 *
 * Pure, and at module scope with everything it reads as a parameter, so the link
 * above is one effect and a projection over it rather than a continuation with a
 * body (§3.3).
 *
 * @type {(readRef: (bytes: Bytes) => Nullable<Ref>, text: string, state: _Lookup, bytes: Bytes) => readonly [_Lookup, List<Bytes>]}
 */
const stepped = (readRef, text, state, bytes) => {
    const r = readRef(bytes)
    if (r === null) { return answered(null, state.packed) }
    // The one rule about *which* file a ref was read from, which the
    // grammar over one file's bytes cannot know. See {@link targetAllowed}.
    if (!targetAllowed(text, r)) { return answered(null, state.packed) }
    if (r.kind === 'direct') { return answered(r.id, state.packed) }
    return [{ id: null, left: state.left - 1, packed: state.packed }, [r.target]]
}

/**
 * The id a name resolves to, given the packed refs already read: the walk of
 * {@link lookupOf}, from the name asked about, with the lookups it may spend.
 *
 * The ref reader is bound once here rather than per link, and the walk's state
 * carries the answer, so the id it ends with is the id the chain named.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, packed: Nullable<readonly PackedRef[]>) => (name: Bytes, left: number) => Effect<Stat | ReadWhole | Readdir | ReadFile, Nullable<Oid>, IoChannel>}
 */
const resolveWith = (dirs, oidBytes, packed) => {
    const link = lookupOf(dirs, oidBytes, tryRef(oidBytes))
    return (name, left) => mapStep(
        walkStep(
            pureOk(/** @type {List<Bytes>} */ ([name])),
            /** @type {_Lookup} */ ({ id: null, left, packed }),
            link),
        s => s.id)
}

/**
 * The id one ref name holds, or `null` where the repository has no such ref.
 *
 * `null` covers every way a name can fail to name an id, because to a caller
 * asking "what does this ref point at" they are one answer. Every one of them,
 * so a reader can tell this list from the channel's business:
 *
 * - no loose file and no packed line — the ordinary "no such ref";
 * - a loose file that is no ref, which does **not** fall back to the packed
 *   line, because the loose file decides the name by existing — a *directory*
 *   whose bytes a host handed over is not that case, and costs one `stat` to
 *   tell apart: see {@link tryBytes};
 * - a symbolic ref whose target is none, and a chain that spends
 *   {@link maxLookups} without reaching an id;
 * - `HEAD` pointing outside `refs/`, the one target Git constrains — see
 *   {@link targetAllowed}, and the paragraph below;
 * - a name that is no ref name, answered before any file is opened — the
 *   paragraph below;
 * - a name no path can spell: bytes that are no UTF-8 name a file no host here
 *   can be asked about, so whether one exists is unknowable rather than
 *   answered from the packed line — {@link nameText} and
 *   [`todo/byte-ref-names.md`](./todo/byte-ref-names.md);
 * - `FETCH_HEAD` or `MERGE_HEAD` with no file, which do not fall back to a
 *   packed line of that name: Git reads those two from the file alone —
 *   {@link special};
 * - a `packed-refs` Git refuses, which makes **every** name `null`, including
 *   one whose loose file is perfectly good: a store whose packed file is
 *   `unexpected line` is not one this answers out of by halves;
 * - `HEAD` where the gitdir cannot be listed at all: the listing that would say
 *   what kind the file is answers `ENOENT`, which is read as a `HEAD` that is
 *   not there and then answered like any absent file — see {@link headIsFile}
 *   for why the kind comes from a listing rather than from a `stat`.
 *
 * A file that cannot be read for any other reason is the channel's.
 *
 * **The operation set includes `stat`, and one is asked only where a read
 * answered bytes that are no ref.** That is the one place a host's own answer
 * for a read of a directory would otherwise decide a ref's value — see
 * {@link tryBytes}. An ordinary lookup, hit or miss, asks none.
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
 * @type {(dirs: Dirs, oidBytes: OidBytes) => (name: Bytes) => Effect<Stat | ReadWhole | Readdir | ReadFile, Nullable<Oid>, IoChannel>}
 */
export const tryResolve = (dirs, oidBytes) => name => {
    // Before any read, which is what the paragraph above promises: otherwise a
    // file the host refuses answers `../secret` with a channel error, making a
    // value known not to be a ref depend on the repository's filesystem. See
    // {@link askable}.
    if (askable(name) === null) { return pureOk(/** @type {Nullable<Oid>} */ (null)) }
    // Two effects, one link each. The chain reads the loose files, and
    // `packed-refs` only where a name has none — see {@link fromPacked} for why
    // that order and not the other.
    const chain = walkStep(
        pureOk(/** @type {List<Bytes>} */ ([name])),
        /** @type {_Lookup} */ ({ id: null, left: maxLookups, packed: null }),
        lookupOf(dirs, oidBytes, tryRef(oidBytes)))
    // And where the chain never needed the file, it is read here — because a
    // `packed-refs` Git refuses is every name's answer, the loose ones included:
    // measured, `git rev-parse refs/heads/master` on a repository holding that
    // ref loose answers `unexpected line in .git/packed-refs` and resolves
    // nothing. Once either way, and after the loose read either way.
    return step(chain, s => s.packed !== null
        ? pureOk(s.id)
        : mapStep(tryPackedRefs(dirs, oidBytes), packed => packed === null ? null : s.id))
}

/** @type {(state: Nullable<_Found>, items: Nullable<readonly _Entry[]>) => _Walked} */
const walked = (state, items) => [state, items]

/**
 * The code a listing is refused with when a file under `refs/` has a name no
 * ref name is.
 *
 * Git refuses one the same way, and with the same reach — the whole listing and
 * not the one entry. Measured on Git 2.43.0 by writing a valid id into each of
 * these under `refs/heads/` and asking `git show-ref`: `bad.`, `a..b`, `a@{b`,
 * `has space`, `tilde~x` and `caret^x` each exit 128 with
 * `bad ref refs/heads/<name>`, which is the message a loose file holding bytes
 * that are no ref gets. Only `.hidden` and `x.lock` are skipped, and those two
 * are a file-name convention rather than a name rule — see
 * [`fjs/git/refname`](../refname/module.f.mjs)'s `hasRefComponents`, and the
 * table in this module's header.
 *
 * An earlier revision skipped all eight, on a table that had measured the
 * conventions and generalised from them. That answered a plausible listing for
 * a repository Git will not list at all.
 */
export const badNameCode = /** @type {const} */ ('ERR_BAD_NAME')

/** @type {(path: string) => string} */
const badNameMessage = path => `${path} is not a ref name`

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
    isFile: d.isFile,
    isDirectory: d.isDirectory,
})

/**
 * What the walk of `refs/` makes of a ref it has read: the root a direct one
 * names, or the pair a symbolic one leaves for later.
 *
 * **A symbolic ref is not resolved here**, which is the whole reason this is a
 * projection and not an effect. Resolving reads `packed-refs`, and that file is
 * read *after* the loose ones — see {@link tryRoots}, where the order is what
 * keeps a `git pack-refs` running underneath from hiding a ref from both halves.
 * So the name and its target are recorded and {@link resolvePending} answers
 * them once the packed lines are in hand.
 *
 * The name is in `names` whichever it is, because that is the shadowing rule:
 * the loose file decides the name by existing, resolved or not.
 *
 * Everything it needs is a leading parameter, so it is closed and at module
 * scope: what the walk has found, the name, and the names (§3.3).
 *
 * @type {(found: _Found, name: readonly number[], names: List<readonly number[]>) => (r: Ref) => _Found}
 */
const refOf = (found, name, names) => r => r.kind === 'direct'
    ? { roots: concat(found.roots)([{ name, id: r.id }]), names, pending: found.pending }
    : {
        roots: found.roots,
        names,
        pending: concat(found.pending)([{ name, target: r.target }]),
    }

/**
 * A directory's entries as the walk's next items, or a refusal where the host
 * answered one name twice.
 *
 * @type {(item: _Entry, found: _Found) => Effect<Readdir, _Walked, IoChannel>}
 */
const descendInto = (item, found) =>
    step(readdir(item.path, {}), entries => {
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

/**
 * The root a loose ref file names, and the name it adds to the walk either way.
 *
 * The captures are leading parameters and this sits at module scope (§3.3).
 *
 * @type {(readRef: (bytes: Bytes) => Nullable<Ref>, name: readonly number[], item: _Entry, found: _Found) => Effect<ReadFile, _Walked, IoChannel>}
 */
const readAsRef = (readRef, name, item, found) => {
    // A file whose name is no ref name refuses the listing, which is Git's
    // answer for one — see {@link badNameCode}.
    if (!isWholeName(name)) {
        return pureError(ioError({ code: badNameCode, message: badNameMessage(item.path) }))
    }
    // the name is recorded whatever the file turns out to hold, because
    // that is what shadows the packed line
    const names = concat(found.names)([name])
    const add = refOf(found, name, names)
    return mapStep(mapStep(readFile(item.path), toBytes), bytes => {
        const r = readRef(bytes)
        return walked(r === null ? null : add(r), null)
    })
}

/**
 * The code an entry under `refs/` is refused with when it is a link to a
 * directory.
 *
 * Git walks into one, and this does not, for a reason the walk cannot get around
 * on its own: a link to a directory can name a directory the walk is already
 * inside. Measured on Git 2.43.0 with `refs/heads/up` linked to `..`,
 * `git show-ref` lists `refs/heads/up/heads/master`, then
 * `refs/heads/up/heads/up/heads/master`, and so on until the path grows too long
 * for the host to open — a name for every depth, out of a repository holding one
 * branch. Git streams those names and stops at the path limit; a walk that
 * *collects* them, as this one does, has neither property, so following the link
 * would be an unbounded answer built out of one entry of an untrusted
 * repository.
 *
 * Refused rather than skipped because a skip loses ref names silently, and this
 * function's answer is what a `gc` would keep — see {@link tryRoots}. A refusal
 * says which entry it was. [`todo/symlink-head.md`](./todo/symlink-head.md) is
 * what walking into one needs first.
 */
export const linkedDirCode = /** @type {const} */ ('ERR_LINKED_DIR')

/** @type {(path: string) => string} */
const linkedDirMessage = path => `${path} is a link to a directory`

/**
 * What the walk makes of an entry whose kind the listing could not name.
 *
 * `stat` is the question to ask, and the one thing it does that `readFile` must
 * not is follow the link *without opening it*: a writerless FIFO stats in 3 ms
 * and reads forever. So one `stat` separates the three cases the listing could
 * not — measured on node 22 over a directory holding each, where `readdir`
 * answers `isFile: false, isDirectory: false` for all of them and `stat` answers
 * `isFile` for a link to a ref file, `isDirectory` for a link to a directory, and
 * neither for a FIFO and for a link to one.
 *
 * @type {(readRef: (bytes: Bytes) => Nullable<Ref>, name: readonly number[], item: _Entry, found: _Found) => Effect<Stat | ReadFile, _Walked, IoChannel>}
 */
const statted = (readRef, name, item, found) => step(
    // The catch is around the `stat` and nothing else: a `readFile` below that
    // cannot find what the listing named is a race or a broken host, and this
    // module's rule is that such a read is the channel's.
    catchStep(
        mapStep(stat(item.path), /** @type {(s: FileStat) => Nullable<FileStat>} */ (s => s)),
        e => leadsNowhere(e)
            ? pureOk(/** @type {Nullable<FileStat>} */ (null))
            : pureError(e)),
    s => s === null || !(s.isFile || s.isDirectory)
        // a link that leads nowhere, or a FIFO, a socket or a device — every one
        // of them an entry Git's listing skips, and the FIFO one this must not
        // open
        ? pureOk(walked(found, null))
        : s.isFile
            ? readAsRef(readRef, name, item, found)
            : pureError(ioError({ code: linkedDirCode, message: linkedDirMessage(item.path) })))

/**
 * The body of the walk of `refs/`: a directory gives its entries to walk
 * next, and a file gives a root or nothing.
 *
 * `null` for the state is malformed and sticky, which is Git's reading of a
 * loose file that is no ref: `git show-ref` refuses the whole listing rather
 * than dropping the one name.
 *
 * **Two name rules, asked at two different moments.** The header's table has the
 * measurements; the order is what this function is about.
 *
 * The *component* rule — {@link hasRefComponents} — is asked before anything
 * else, because Git's walk skips those two conventions whatever the entry is and
 * because no valid ref name can sit under such a component. Measured on Git
 * 2.43.0 in a repository of `refs/heads/master` and `refs/tags/v1`: with
 * `refs/heads/.hidden` linked to `master`, `show-ref` lists the two refs and
 * exits 0; with the same name linked to `../tags`, a link to a *directory*, it
 * lists the same two and exits 0 again. Asking the kind first refused that
 * second repository outright, over an entry Git never looks at.
 *
 * Before the *directory* branch too, and not only before the `stat`: a real
 * directory called `.hidden` or `x.lock` may hold ref files, and Git skips the
 * whole subtree — measured, `refs/heads/.hidden/v1` holding a valid id leaves
 * `show-ref` and `for-each-ref` listing `refs/heads/master` alone at exit 0.
 * Descending first reached that child and refused its name, turning a repository
 * Git lists into a channel error.
 *
 * The *whole-name* rule is asked in {@link readAsRef}, after the kind, because
 * it is a rule about a ref and not about a path: `refs/heads/bad.` is no ref
 * name while `refs/heads/bad./v1` is one, so with the first a symlink to
 * `refs/tags` Git lists the second at exit 0. Skipping by the whole-name rule
 * before the kind dropped that subtree in silence, which is the one answer this
 * module must not give; here it reaches {@link statted}, and a link to a
 * directory is refused loudly with {@link linkedDirCode} — the deliberate
 * divergence argued there, and the same one a *valid* name linked to a directory
 * gets.
 *
 * `keep` is asked in between, so an entry the other walk owns costs no `stat`.
 *
 * **The kind is two questions and not one, because `isDirectory` is not
 * `!isFile`.** A FIFO, a socket, a device and a symlink to anything at all are
 * every one of them `isFile: false` and `isDirectory: false` in a listing, which
 * `Dirent` answers without following a link. Reading the second question as the
 * negation of the first would open a FIFO, and reading it as "skip" would drop a
 * symlinked ref — so neither answer is in the listing and {@link statted} asks
 * one more question about exactly those entries. What a listing *can* say it
 * says, so an ordinary file and an ordinary directory cost nothing more.
 *
 * The read here is the plain one and not {@link tryBytes}: the walk has just
 * been told the file is there, so a read that cannot find it is a race or a
 * broken host rather than an absence, and the channel is where that belongs.
 *
 * `scope` says which names this walk owns, so the two walks of a `refs/` — the
 * shared directory's and the worktree's — divide the names between them and
 * neither lists one twice. In a main worktree both walks read the same
 * directory, and the division is still exactly one walk per name. Its `descend`
 * is the same division asked of a *directory*, which is a prefix rather than a
 * name: see {@link holdsPerWorktreeOnly} for why that is a second rule and not
 * the same one.
 *
 * @type {(oidBytes: OidBytes, scope: _Scope) => (item: _Entry) => (state: Nullable<_Found>) => Effect<Stat | Readdir | ReadFile, _Walked, IoChannel>}
 */
const looseOf = (oidBytes, scope) => {
    const readRef = tryRef(oidBytes)
    return item => state => {
        if (state === null) { return pureOk(walked(null, null)) }
        const found = state
        const name = nameBytes(item.name)
        // The two file-name conventions are asked before anything else — before
        // the kind, and before a directory is descended into — and the whole-name
        // rule after the kind: see the doc above.
        if (!hasRefComponents(name)) { return pureOk(walked(found, null)) }
        if (item.isDirectory) {
            // and the scope's own prefix rule, so a walk lists no directory it
            // has no name to take from: see {@link holdsPerWorktreeOnly}
            return scope.descend(item.name)
                ? descendInto(item, found)
                : pureOk(walked(found, null))
        }
        if (!scope.keep(item.name)) { return pureOk(walked(found, null)) }
        return item.isFile
            ? readAsRef(readRef, name, item, found)
            : statted(readRef, name, item, found)
    }
}

/**
 * A name for a message, which a ref name is not always: one that is no UTF-8
 * names no file and cannot be written as a path, so it is written as its bytes
 * in hex instead. See {@link nameText}.
 *
 * @type {(name: Bytes) => string}
 */
const nameForMessage = name => {
    const dense = byteArray(name)
    return nameText(dense) ?? dense.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** The id no object has, which a ref may none the less hold: forty or sixty-four zeros. */
const zeroId = /** @type {(id: Oid) => boolean} */ (id => uint(id) === 0n)

/**
 * The first root whose id is the zero id, or `null` where none is.
 *
 * @type {(roots: readonly Root[]) => Nullable<Root>}
 */
const zeroRoot = roots => roots.find(r => zeroId(r.id)) ?? null

/**
 * A name a `packed-refs` gives two *different* ids, or `null` where every name
 * it repeats repeats one id.
 *
 * @type {(packed: readonly PackedRef[]) => Nullable<Bytes>}
 */
const packedDisagreement = packed => {
    const byName = new Map(packed.map(p => [nameKey(p.name), p.id]))
    const hit = packed.find(p => byName.get(nameKey(p.name)) !== p.id)
    return hit === undefined ? null : hit.name
}

/**
 * Whether the `HEAD` file and `packed-refs` both name `HEAD`.
 *
 * The head's own findings are what say the file is there: {@link tryHeadFound}
 * records the name whichever the file holds, so a non-empty `names` is the file
 * and nothing else. This is the one collision the answer cannot carry, and
 * {@link packedHeadCode} is what it refuses with — the argument, and Git's
 * behaviour on both halves, are at {@link tryHeadFound}.
 *
 * @type {(headFound: _Found, packed: readonly PackedRef[]) => boolean}
 */
const packedHeadCollision = (headFound, packed) =>
    toArray(headFound.names).some(n => sameName(n, headName))
    && packed.some(p => sameName(p.name, headName))

/**
 * The roots the walk found, then the packed lines nothing hides.
 *
 * A packed line is dropped for either of two reasons. A loose file of the same
 * name hides it, by existing — see {@link _Found}. And a *later* packed line of
 * the same name hides it, because a file may name a ref twice and Git takes the
 * last for the name's value: measured on Git 2.43.0, `git show-ref` lists both
 * lines and `git rev-parse` answers the last, in either order.
 *
 * The second is a drop this function is never reached with at two different ids:
 * {@link tryRoots} refuses such a file first, since both lines are retention
 * roots — {@link packedTwiceCode}. What is left here is the harmless case, one
 * name repeated at one id, where taking the last loses nothing.
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
 * Taken from the gitdir's listing rather than by reading `refs/` and forgiving
 * an absence, because a worktree has a `refs/` of its own only while a bisect or
 * a rebase is running — most of the time there is nothing there — and this
 * module's rule everywhere else is that a `readdir` which cannot find what a
 * *listing* named is the channel's. Asking the listing keeps that rule rather
 * than making an exception to it: the directory is there if the listing says so.
 *
 * The listing is the caller's because `HEAD`'s kind comes out of the same one —
 * see {@link headIsFile} — so a walk of a worktree reads the directory once.
 *
 * **The entry's kind is asked for rather than read off the listing, because this
 * one may be a link.** A `$GIT_DIR/refs` that is a symlink to a directory is a
 * worktree Git reads: measured on Git 2.43.0, with a linked worktree's `refs`
 * replaced by a link to a directory holding `bisect/bad`, `git show-ref` and
 * `git for-each-ref` both list `refs/bisect/bad` and `git rev-parse --verify`
 * answers its id. A listing reports that entry with both kind flags false — it
 * does not follow a link — so a filter on `isDirectory` dropped the worktree's
 * whole ref tree without a word.
 *
 * The link is *followed* here, where {@link statted} refuses one below: the
 * difference is what makes it safe. Every link inside the tree is refused, so
 * following the root buys exactly one level and no cycle — `refs` linked to `..`
 * lists the gitdir, whose own `refs` is that same link and is refused there.
 * Following the root also matches the shared walk, which reaches its `refs`
 * through a `readdir` that follows links whatever the entry is.
 *
 * A `refs` that is a regular file, or a link to anything but a directory, is a
 * worktree with no refs of its own — which is what most of them are.
 *
 * @type {(dirs: Dirs, entries: readonly Dirent[]) => Effect<Stat, readonly _Entry[], IoChannel>}
 */
const ownRefs = (dirs, entries) => {
    const d = entries.find(e => e.name === refsDir)
    if (d === undefined) { return pureOk(/** @type {readonly _Entry[]} */ ([])) }
    const path = under(dirs.gitdir, refsDir)
    /** @type {readonly _Entry[]} */
    const walk = [{ path, name: refsDir, isFile: false, isDirectory: true }]
    if (d.isDirectory) { return pureOk(walk) }
    if (d.isFile) { return pureOk(/** @type {readonly _Entry[]} */ ([])) }
    return catchStep(
        mapStep(stat(path), s => s.isDirectory ? walk : /** @type {readonly _Entry[]} */ ([])),
        e => leadsNowhere(e) ? pureOk(/** @type {readonly _Entry[]} */ ([])) : pureError(e))
}

/**
 * The code a repository is refused with when its `HEAD` is not a regular file.
 *
 * The listing is what sees it, because every other way this module can ask about
 * a path follows a link: `readFile` reads what the link names and `stat` answers
 * for the file at the other end, where a directory entry carries the kind of the
 * entry itself.
 */
export const headKindCode = /** @type {const} */ ('ERR_HEAD_KIND')

/** @type {(path: string) => string} */
const headKindMessage = path => `${path} is not a regular file`

/**
 * The code a listing is refused with when `packed-refs` names `HEAD` and a
 * `HEAD` file is there too.
 *
 * Git keeps both — the file is what the name means and the packed line is a
 * retention root of its own — and one entry per name can carry neither answer
 * without losing the other. {@link tryHeadFound} has the measurements, and
 * [`todo/packed-head.md`](./todo/packed-head.md) the representation that would
 * hold both.
 */
export const packedHeadCode = /** @type {const} */ ('ERR_PACKED_HEAD')

/**
 * The code a listing is refused with when a ref holds the id no object has:
 * forty zeros at SHA-1, sixty-four at SHA-256.
 *
 * Git refuses it the same way and in the same half. Measured on Git 2.43.0 with
 * `refs/heads/zero` holding the zero id, loose and packed alike:
 * `git show-ref` answers `bad ref refs/heads/zero (0000…)` and exits 128, and
 * `git rev-list --all` answers `fatal: bad object refs/heads/zero`. So a listing
 * that carried it would be a retention root that cannot name an object, for a
 * repository `rev-list` refuses to walk.
 *
 * The *lookup* keeps Git's other answer: `git rev-parse` prints the zero id and
 * exits 0, and so does {@link tryResolve}. `git for-each-ref` is a third answer
 * again — `warning: ignoring broken ref` and exit 0 — and this module follows
 * `show-ref`, which is the listing it has matched throughout.
 *
 * It is also the code {@link tryWrite} refuses with, for the same condition and
 * one more reason: to `git update-ref` the zero id is not a value at all but the
 * *delete*. Measured on 2.43.0, `git update-ref refs/heads/z 0000…` removes
 * `refs/heads/z` at exit 0, and the same on a name that does not exist is a
 * no-op. So a writer that put those bytes in a file would be doing what no Git
 * command does, and leaving a listing this module refuses.
 */
export const zeroIdCode = /** @type {const} */ ('ERR_ZERO_ID')

/** @type {(name: Bytes) => string} */
const zeroIdMessage = name => `${nameForMessage(name)} holds the zero id`

/**
 * The code a listing is refused with when `packed-refs` gives one name two
 * different ids.
 *
 * Both are roots, which is what this list cannot say twice. Measured on Git
 * 2.43.0 with `refs/heads/dup` written twice at two ids: `git show-ref` and
 * `git for-each-ref` print both lines, `git rev-list --all` lists both, and
 * `git gc --prune=now` with every reflog expired keeps the commit only the
 * *earlier* line names — while `git rev-parse` answers the last, which is the
 * value {@link packedId} takes and {@link tryResolve} answers.
 *
 * So the file holds two roots under one name, and dropping the earlier one lost
 * an id the repository is keeping. It is the same shape as {@link packedHeadCode}
 * and refused for the same reason, with the same way out recorded in
 * [`todo/packed-head.md`](./todo/packed-head.md). A name repeated at *one* id
 * loses nothing and is answered once.
 */
export const packedTwiceCode = /** @type {const} */ ('ERR_PACKED_TWICE')

/** @type {(dirs: Dirs, name: Bytes) => string} */
const packedTwiceMessage = (dirs, name) =>
    `${under(dirs.common, packedRefs)} names ${nameForMessage(name)} at two ids`

/** @type {(dirs: Dirs) => string} */
const packedHeadMessage = dirs =>
    `${under(dirs.common, packedRefs)} names ${head} beside ${under(dirs.gitdir, head)}`

/**
 * Whether the gitdir's listing shows a `HEAD` this module may read: absent is
 * fine, a regular file is fine, and anything else is not.
 *
 * **A symlink `HEAD` is the case this refuses, and Git refuses most of it too.**
 * The legacy spelling of a symbolic ref is a symlink, and Git still reads one
 * that points under `refs/` — measured on 2.43.0, where `.git/HEAD` linked to
 * `refs/heads/master` answers both `rev-parse HEAD` and `symbolic-ref HEAD`. A
 * link pointing anywhere else stops the directory being a repository at all:
 * with `.git/HEAD` linked to a file beside it holding an id, every one of
 * `rev-parse HEAD`, `show-ref` and `status` answers
 * `not a git repository`.
 *
 * This reader cannot tell those two apart, because nothing in the effects it has
 * reads a link's target: `readFile` follows it, and the bytes that come back are
 * the bytes at the other end. So it refuses both, which is narrower than Git for
 * a spelling Git has not written since before 1.5 — and the alternative is worse
 * than narrow. Following the link is how a repository makes this module read a
 * file that is not in it: `.git/HEAD` naming `/etc/passwd` would be answered as
 * a detached `HEAD` if its first line happened to read as an id, which is the
 * boundary this module's header claims two rules earlier and a link walks
 * straight through.
 *
 * [`todo/symlink-head.md`](./todo/symlink-head.md) is what a `readlink` would buy
 * back, and the half of this that the lookup cannot see.
 *
 * @type {(entries: readonly Dirent[]) => boolean}
 */
const headIsFile = entries => entries.every(d => d.name !== head || d.isFile)

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
 * **The name is recorded whichever it holds, and it is what refuses a
 * `packed-refs` line naming `HEAD`.** The module's shadowing rule — a loose file
 * wins by existing — is right for a name under `refs/` and wrong for this one,
 * because Git keeps *both* of these. Measured on Git 2.43.0 with a packed `HEAD`
 * line beside a detached `HEAD` file: `git show-ref --head` prints two `HEAD`
 * lines, `git rev-list --all` lists both ids, `git fsck` calls neither
 * unreachable, and `git gc --prune=now` after
 * `git reflog expire --expire=now --expire-unreachable=now --all` keeps the
 * packed line's commit — while `git rev-parse HEAD` answers the file and
 * `git for-each-ref` lists neither. A `HEAD` file naming a *branch* is the same:
 * both ids survive that `gc`. A loose ref under `refs/` is the opposite, which is
 * what makes the shadowing rule a rule: with `refs/heads/x` loose and packed at
 * two ids, `show-ref` and `rev-list --all` answer only the loose one, `fsck`
 * calls the packed commit unreachable and the same `gc` prunes it.
 *
 * So the file is what the name *means* and the packed line is a root nothing
 * else holds, and one entry per name cannot say both — shadowing dropped an id
 * the repository is keeping. {@link packedHeadCode} refuses the listing instead,
 * and [`todo/packed-head.md`](./todo/packed-head.md) is the representation that
 * would answer both. The collision only arises in a file made by hand:
 * `git pack-refs --all` writes no `HEAD` line, measured with a detached `HEAD`
 * and an `ORIG_HEAD` set — though `git gc` carries one forward once it is there,
 * so a repository does not lose it by being packed again.
 *
 * Its kind comes from the gitdir's listing rather than from another `stat`: see
 * {@link headIsFile}, which is where the refusal is argued.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, entries: readonly Dirent[]) => Effect<ReadFile, Nullable<_Found>, IoChannel>}
 */
const tryHeadFound = (dirs, oidBytes, entries) => {
    const readRef = tryRef(oidBytes)
    if (!headIsFile(entries)) {
        return pureError(ioError({
            code: headKindCode,
            message: headKindMessage(under(dirs.gitdir, head)),
        }))
    }
    return mapStep(tryBytes(under(dirs.gitdir, head)), bytes => {
        if (bytes === null) { return { roots: [], names: [], pending: [] } }
        const r = readRef(bytes)
        if (r === null) { return null }
        // The same rule the lookup asks, and for the same reason: a `HEAD`
        // pointing outside `refs/` is no repository, so there is no list of its
        // refs to answer. See {@link targetAllowed}.
        if (!targetAllowed(head, r)) { return null }
        // A symbolic `HEAD` names no root of its own — the branch it names is one
        // at the same id — so there is nothing pending here either.
        return {
            roots: r.kind === 'direct' ? [{ name: headName, id: r.id }] : [],
            names: [headName],
            pending: [],
        }
    })
}

/**
 * The symbolic loose refs the walk left pending, answered: each one's target
 * resolved against the packed lines and the loose files, and a root added where
 * it resolves.
 *
 * One effect per pending ref, at one level, which is a walk rather than a fold
 * only because the step's answer feeds the next state — see
 * [`fjs/effects`](../../effects/module.f.mjs)' `foldStep`, which is what this is.
 *
 * **A target that resolves nowhere leaves the name recorded and adds no root**,
 * which is the shadowing rule: the loose file decided the name by existing, so
 * the packed line of that name does not come back. The name is already in
 * `names`; this only ever appends roots.
 *
 * Symbolic refs under `refs/` are rare — `refs/remotes/<remote>/HEAD` is the one
 * an ordinary clone has — so this pass is usually empty and always short.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes, packed: readonly PackedRef[], found: _Found) => Effect<Stat | ReadWhole | Readdir | ReadFile, _Found, IoChannel>}
 */
const resolvePending = (dirs, oidBytes, packed, found) => {
    const resolve = resolveWith(dirs, oidBytes, packed)
    return foldStep(
        pureOk(found.pending),
        found,
        p => state => mapStep(
            resolve(p.target, maxLookups - 1),
            id => ({
                roots: id === null
                    ? state.roots
                    : concat(state.roots)([{ name: p.name, id }]),
                names: state.names,
                pending: state.pending,
            })))
}

/**
 * Every ref the repository holds, as a name and the id it effectively
 * names: the ids a search for candidate commits may start from, and the roots
 * a *ref* keeps an object alive by.
 *
 * **Not every root Git has, and so not a prune list.** A ref is one kind of root
 * and there are others, each measured on Git 2.43.0 with every reflog expired
 * first:
 *
 * - a **reflog** entry, until it expires — a commit left only in `HEAD`'s reflog
 *   by `git reset --hard HEAD~1` survives `git gc --prune=now`, and is gone
 *   after `git reflog expire --expire=now --expire-unreachable=now --all` and
 *   another `gc --prune=now`. `git fsck` reads the reflog the same way, which is
 *   what `--no-reflogs` turns off;
 * - the **index** — a blob `git add`ed and never committed survives that same
 *   `gc`, while one written by `git hash-object -w` and never staged is pruned.
 *   No ref names it and `rev-list --all --objects` does not list it, so a list
 *   of refs cannot see it at all.
 *
 * So a caller that deletes what this list does not name deletes work Git would
 * have given back, and this answers refs rather than everything the repository
 * is currently keeping — [`todo/reflog-roots.md`](./todo/reflog-roots.md) is
 * where the other roots and the shape they need are written down.
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
 * One name, one entry, whatever the files do — and where a file would make that
 * impossible, this refuses rather than choose. A `packed-refs` naming one ref at
 * two ids is refused with {@link packedTwiceCode}, because both lines are roots;
 * at one id it is answered once. A ref holding the zero id is refused with
 * {@link zeroIdCode}, because a root that names no object is no root.
 *
 * **`HEAD` is the one name that rule cannot answer, and it refuses rather than
 * answer it wrongly.** A packed line naming `HEAD` beside the `HEAD` file is a
 * root Git keeps — unlike a shadowed line under `refs/`, which it prunes, both
 * measured at {@link tryHeadFound} — so dropping it would leave an id the
 * repository is keeping out of a list whose purpose is to name them. The
 * refusal is the channel's, with {@link packedHeadCode}, because Git reads such
 * a repository and this cannot: it is narrower than Git by a refusal and not by
 * a wrong answer, the way a symlinked `HEAD` is at {@link headKindCode}.
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
 * **The operation set includes `stat` and `readWhole`.** A listing cannot say
 * what a symlink finally is — see {@link looseOf} — so an entry whose kind it
 * could not name costs one `stat`, and an ordinary file or directory costs none;
 * and `packed-refs` is read whole rather than through a `Vec`, for the size
 * reason {@link tryPackedRefs} measures. A program on the node runner notices
 * nothing, since both are `NodeOp`s like the other two; what has to grow is an
 * interpreter written for exactly the old set.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => Effect<Stat | ReadWhole | Readdir | ReadFile, Nullable<readonly Root[]>, IoChannel>}
 */
export const tryRoots = (dirs, oidBytes) => {
    /** @type {_Entry} */
    const shared = { path: under(dirs.common, refsDir), name: refsDir, isFile: false, isDirectory: true }
    /** @type {Nullable<_Found>} */
    const init = { roots: [], names: [], pending: [] }
    // Six effects, one link each and all at one level, so the order they run in
    // is the order they are written: the shared walk of `refs/`, the gitdir's
    // listing, the worktree's own walk, `HEAD`, `packed-refs`, and the symbolic
    // refs the walk left pending. Each link carries the earlier values forward
    // through `historyStep` rather than nesting to reach them, and each is
    // skipped once something before it has refused, which is what the `null`s in
    // front of them are for.
    //
    // **The loose files are read before `packed-refs`, and that order is the
    // answer to `git pack-refs` running underneath.** That command writes the
    // new packed file and then prunes the loose ones it packed — `--prune` is
    // its default — so a reader that snapshots `packed-refs` first can see
    // neither copy of a ref that was loose when it started: not the packed file,
    // which predates the pack, and not the loose file, which is gone by the time
    // the walk reaches it. Reading the loose files first cannot lose it either
    // way round: the walk finds the file, or the pack has already happened and
    // the packed lines read afterwards carry it. A ref created or deleted while
    // this runs is a snapshot's business, not a gap; a root silently missing
    // from a repository that held it throughout is the answer this module must
    // not give.
    //
    // The shared walk takes the shared names and the worktree's walk takes the
    // per-worktree ones, so a name is listed once whether the two directories
    // are one or two. The worktree's `refs/` is usually not there at all — a
    // linked worktree has one only while a bisect or a rebase is running — so it
    // is found by listing the worktree's directory rather than by reading a path
    // that may not be there. See {@link ownRefs}.
    const walk = history(walkStep(pureOk([shared]), init, looseOf(oidBytes, sharedScope)))
    // The refusals are tested oldest first, which is not a style choice: a later
    // one implies every earlier one, so asking about an earlier refusal after a
    // later one is a question with only one answer — a branch no input reaches.
    // The gitdir's listing is a link of its own because two of them need it: the
    // worktree's walk takes the `refs` entry from it, and `HEAD`'s kind is in it
    // too — see {@link headIsFile}, which is the only way this module can ask
    // whether a path is a link rather than what it points at. A skipped listing
    // is no entries rather than `null`, because the links after it are skipped by
    // the same refusal that skipped this one — the walk's `null` reaches them on
    // its own — and a `null` here would add a test nothing can reach.
    const listed = historyStep(walk, found => found === null
        ? pureOk(/** @type {readonly Dirent[]} */ ([]))
        : readdir(dirs.gitdir, {}))
    const ownWalk = historyStep(listed, (entries, found) => found === null
        ? pureOk(found)
        : walkStep(ownRefs(dirs, entries), found, looseOf(oidBytes, worktreeScope)))
    const headRead = historyStep(ownWalk, (found, entries) => found === null
        ? pureOk(/** @type {Nullable<_Found>} */ (null))
        : tryHeadFound(dirs, oidBytes, entries))
    // A refused listing skips the file rather than answering `[]`, because `[]`
    // is "no packed refs" and this is "no answer": the two differ where a name
    // is packed and the walk already refused.
    const packedRead = historyStep(headRead, h => h === null
        ? pureOk(/** @type {Nullable<readonly PackedRef[]>} */ (null))
        : tryPackedRefs(dirs, oidBytes))
    // And the last link is the one the order above bought: every symbolic loose
    // ref the walk recorded, answered against the packed lines just read.
    const resolved = historyStep(packedRead, (packed, h, found) =>
        packed === null || h === null || found === null
            ? pureOk(/** @type {Nullable<_Found>} */ (null))
            : resolvePending(dirs, oidBytes, packed, found))
    // newest first, and the shared walk's own answer is skipped because the
    // worktree's walk carried it forward as its starting state
    return step(resolved, ([found, packed, h]) => {
        if (packed === null || found === null || h === null) {
            return pureOk(/** @type {Nullable<readonly Root[]>} */ (null))
        }
        // The one collision that is neither a shadow nor an answer. See
        // {@link packedHeadCollision}.
        if (packedHeadCollision(h, packed)) {
            return pureError(ioError({
                code: packedHeadCode,
                message: packedHeadMessage(dirs),
            }))
        }
        // The other two ways one name would stand for two roots, or one root for
        // no object. Both are asked of the finished list rather than of each
        // reader, so a loose file, a `HEAD` and a packed line are judged by one
        // rule: see {@link zeroIdCode} and {@link packedTwiceCode}.
        const twice = packedDisagreement(packed)
        if (twice !== null) {
            return pureError(ioError({
                code: packedTwiceCode,
                message: packedTwiceMessage(dirs, twice),
            }))
        }
        const roots = combine({
            roots: concat(found.roots)(h.roots),
            names: concat(found.names)(h.names),
            pending: [],
        }, packed)
        const zero = zeroRoot(roots)
        return zero === null
            ? pureOk(roots)
            : pureError(ioError({ code: zeroIdCode, message: zeroIdMessage(zero.name) }))
    })
}

/**
 * The directory a ref's loose file sits in, which a write has to make before it
 * can take the lock.
 *
 * Git makes it too, rather than refusing a name whose directories are not
 * there: measured on Git 2.43.0, `git update-ref refs/heads/a/b/c` on a
 * repository holding no `refs/heads/a` writes the file and both directories
 * above it, at exit 0.
 *
 * There is always a slash to cut at, because {@link tryWrite} has already
 * refused a name that does not begin with `refs/` — so this answers no name of
 * one component and has no second case.
 *
 * @type {(dir: string, text: string) => string}
 */
const parentOf = (dir, text) => under(dir, text.slice(0, text.lastIndexOf('/')))

/**
 * The compensation {@link unlocked} runs: remove `lock`, drop whatever that
 * answers, and report `err`.
 *
 * The `rm`'s own outcome is dropped because reporting it would replace the
 * reason the write failed with the reason it could not be undone, and the first
 * is the one a caller can act on.
 *
 * @type {(lock: string) => (err: IoChannel) => Effect<Rm, never, IoChannel>}
 */
const givenBack = lock => err => resultStep(rm(lock), () => pureError(err))

/**
 * `e` with the lock given back where it fails.
 *
 * A lock left behind refuses every later write of that name, and nothing tells
 * one a writer is holding from one a writer abandoned: both are `EEXIST` from
 * the exclusive write. Git leaves none either — measured on Git 2.43.0, there is
 * no `refs/heads/z.lock` after `git update-ref refs/heads/z`, and a `y.lock` put
 * there by hand makes the next `update-ref refs/heads/y` exit 128 with
 * `cannot lock ref 'refs/heads/y': Unable to create '…/refs/heads/y.lock':
 * File exists` and write no `refs/heads/y`.
 *
 * **What it wraps is the whole of its correctness, and two revisions of this got
 * it wrong in the same way — by inferring from an error whether the lock was
 * ours.** It wraps the `rename` and nothing else, because the `rename` is the
 * only thing {@link tryWrite} does *after* an operation that proves the lock is
 * this writer's.
 *
 * The first wrong revision wrapped the whole sequence, on the reasoning that the
 * links above either create this writer's lock or create nothing — false
 * whenever the lock is there and is somebody else's, which
 * {@link badPackedCode} and {@link refPrefixCode} both reach. The second kept
 * the exclusive write inside the span and carved out `EEXIST`, on the reasoning
 * that `EEXIST` is the one error meaning "not mine" — also false: measured on
 * node 22.22.2 with descriptors exhausted, a `wx` open of a name another writer
 * holds answers `EMFILE`, so the carve-out let the cleanup through and it
 * unlinked a live lock. Both were review findings on
 * [#2115](https://github.com/functionalscript/functionalscript/pull/2115).
 *
 * The rule that survives both is that **an error code is never evidence of
 * ownership**. `O_EXCL` succeeding is, and it is the runner that holds it — so
 * the rollback for a write that fails after its open lives in
 * `fjs/effects/node`'s `writeExclusive`, whose contract is that the file either
 * holds the data or is not there. Nothing here has to ask which, and the foreign
 * lock in every refusal fixture keeps a future revision from putting the question
 * back.
 *
 * The two effects are never both in one sequence — the `rm` runs only where `e`
 * failed — so this is {@link catchStep}'s branch and not a chain to flatten, and
 * the compensation is named beside it rather than spelled inline.
 *
 * @template {Operation} O
 * @param {string} lock
 * @param {Effect<O, void, IoChannel>} e
 * @returns {Effect<O | Rm, void, IoChannel>}
 */
const unlocked = (lock, e) => catchStep(e, givenBack(lock))

/**
 * The code a write is refused with when no path spells the name.
 *
 * It is the writer's half of the gap {@link tryResolve} answers `null` for: a
 * ref name may hold bytes that are no UTF-8 — `refs/heads/` and the byte `0x80`
 * is one `git check-ref-format` accepts and `rev-parse` resolves, measured on
 * Git 2.43.0 — and a path is text to this host, so there is no file to create.
 * A lookup may answer "no such ref" for one, since a caller asked what it
 * resolves to and nothing here can hold it; a write may not, because answering
 * anything but a refusal would claim a ref was written that no file holds.
 *
 * The path API that speaks bytes and closes it is
 * [`todo/byte-ref-names.md`](./todo/byte-ref-names.md).
 */
export const unspellableNameCode = /** @type {const} */ ('ERR_UNSPELLABLE_NAME')

/** @type {(name: Bytes) => string} */
const unspellableNameMessage = name => `${nameForMessage(name)} is no path this host can spell`

/**
 * The code a write is refused with when the name is not under `refs/`.
 *
 * Every such name is one Git itself writes differently, and `HEAD` is why this
 * is a refusal rather than a narrower doc line. Measured on Git 2.43.0 with
 * `.git/HEAD` holding `ref: refs/heads/master`: `git update-ref HEAD <id>`
 * leaves `.git/HEAD` exactly as it was and writes the *branch*, and
 * `git symbolic-ref` is what writes `HEAD` itself. So a writer handed `HEAD`
 * has two answers to pick from — update the file, which is `update-ref
 * --no-deref` and detaches the checkout, or update what it names — and neither
 * is the one a caller obviously meant. Picking one silently is the plausible
 * wrong answer [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses.
 *
 * A pseudoref is written literally by `update-ref` — measured, `FOO_HEAD`
 * becomes `.git/FOO_HEAD` at exit 0 — so this is narrower than Git and
 * deliberately so: a ref written here is a retention root and nothing else
 * ([`todo/git-name-resolution.md`](../../../todo/git-name-resolution.md)), and
 * the roots {@link tryRoots} walks are the names under `refs/` plus the one
 * `HEAD` this writer will not touch. What a caller that wants one would need is
 * in [`../todo/ref-writing.md`](../todo/ref-writing.md).
 */
export const outsideRefsCode = /** @type {const} */ ('ERR_OUTSIDE_REFS')

/** @type {(text: string) => string} */
const outsideRefsMessage = text => `${text} is not under ${refsPrefix}`

/**
 * The code a write is refused with when the id is not as wide as the
 * repository's ids are.
 *
 * A ref file holds the id as hex and a reader counts the digits: a 32-byte id
 * written into a SHA-1 repository is sixty-four of them, which
 * [`fjs/git/ref`](../ref/module.f.mjs) reads as no ref at all — so the write
 * would leave a file this module's own listing refuses. The width is the
 * repository's, out of `extensions.objectFormat`, and not the id's to decide.
 */
export const idWidthCode = /** @type {const} */ ('ERR_ID_WIDTH')

/** @type {(oidBytes: OidBytes, id: Oid) => string} */
const idWidthMessage = (oidBytes, id) =>
    `this repository's ids are ${oidBytes * 8} bits and this one is ${length(id)}`

/** @type {(name: Bytes) => string} */
const zeroIdWriteMessage = name => `${nameForMessage(name)} would hold the zero id`

/** The byte a ref name's components are separated by. */
const slash = /** @type {const} */ (0x2F)

/**
 * Whether `a` names the directory `b` sits in, at any depth: `refs/heads/a` is a
 * prefix of `refs/heads/a/b` and of `refs/heads/a/b/c`, and of `refs/heads/ab`
 * it is not. The byte after `a` has to be the separator, which is the whole
 * difference between a prefix of a *name* and a prefix of a string — and the one
 * a check written over text rather than segments gets wrong.
 *
 * @type {(a: readonly number[], b: readonly number[]) => boolean}
 */
const isNamePrefix = (a, b) =>
    b.length > a.length && b[a.length] === slash && a.every((v, i) => b[i] === v)

/**
 * The packed name that collides with `name` as a directory prefix, either way
 * round, or `null` where none does.
 *
 * A scan with one materialisation per line, which is what {@link packedId} costs
 * for the same file, and both directions in one pass: a packed `refs/heads/a`
 * bars `refs/heads/a/b`, and a packed `refs/heads/a/b` bars `refs/heads/a`.
 *
 * @type {(packed: readonly PackedRef[], name: readonly number[]) => Nullable<Bytes>}
 */
const prefixCollision = (packed, name) => packed.find(e => {
    const n = toArray(e.name)
    return isNamePrefix(n, name) || isNamePrefix(name, n)
})?.name ?? null

/**
 * The code a write is refused with when a ref would sit under this name, or this
 * name under a ref. Git allows neither, and refuses with one message for both:
 * `'<other>' exists; cannot create '<name>'`.
 *
 * Three things can put a ref there, and a write has to ask about each:
 *
 * - a **packed** name, which no filesystem answer reveals — the `packed-refs`
 *   read is for this, and {@link badPackedCode} is what a file that will not
 *   parse leaves behind;
 * - a **directory** at the ref's own path, or a **symlink to one**, which
 *   {@link isDirectoryAt} answers before the lock is taken. The symlink is why
 *   the `stat` exists rather than relying on the `rename`: measured, `fs.rename`
 *   over such a link succeeds and leaves every ref inside the linked directory
 *   unreachable, where a real directory is `EISDIR`. **An *empty* directory is
 *   refused here where `git update-ref` removes it and publishes the ref**,
 *   which is narrower than Git and is the one refusal of these that a caller
 *   could reasonably want gone —
 *   [`../todo/ref-writing.md`](../todo/ref-writing.md) has the measurements and
 *   what removing it needs;
 * - a **loose file** where a parent directory must go, which the *same* `stat`
 *   answers `ENOTDIR` for, since the ref's own path leads through that file.
 *   That one refusal carries the host's code rather than this one, and the
 *   `mkdir` below it is never reached.
 *
 * Where the code is this one, the message names the *path* and not the ref in
 * the way, unlike Git's, because knowing which ref that is means walking the
 * directory.
 *
 * **It is a snapshot, and a concurrent `git pack-refs` can invalidate it —
 * under `git update-ref` too, which takes its lock before it verifies the name
 * and is no better protected.** Closing that would mean holding
 * `packed-refs.lock` across the check and the rename, which `update-ref`
 * deliberately does not.
 *
 * This module's own readers answer every one of these states the way `show-ref`
 * does, so the refusal is about the repository this writer leaves for Git rather
 * than anything read back here.
 *
 * Every measurement behind the four paragraphs above, the interleaving table for
 * the race, and which of them have fixtures and which rest on a node measurement
 * alone: [`../todo/ref-writing.md`](../todo/ref-writing.md).
 */
export const refPrefixCode = /** @type {const} */ ('ERR_REF_PREFIX')

/**
 * Git's own wording, which names both refs and neither path: the ref in the way
 * and the one that cannot be created.
 *
 * @type {(other: Bytes, name: Bytes) => string}
 */
const refPrefixMessage = (other, name) =>
    `${nameForMessage(other)} exists; cannot create ${nameForMessage(name)}`

/**
 * The same refusal reached through the filesystem rather than through
 * `packed-refs`: something at the ref's own path is a directory, so refs sit
 * under the name. Git's wording names the ref in the way and this names the path,
 * for the reason {@link refPrefixCode} gives.
 *
 * @type {(name: Bytes) => string}
 */
const refIsDirectoryMessage = name => `${nameForMessage(name)} is a directory; cannot create it`

/**
 * The code a write is refused with when `packed-refs` is there and is no
 * `packed-refs`.
 *
 * The prefix check above cannot be answered without reading that file, so a file
 * that will not parse leaves the collision unknown — and writing anyway is the
 * plausible answer [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses. Git refuses the same write, measured with a control: with
 * `.git/packed-refs` holding one junk line, `git update-ref refs/heads/n <id>`
 * exits 128 with `unexpected line in .git/packed-refs` and writes no file,
 * while the identical write against a well-formed `packed-refs` exits 0 and
 * writes one.
 *
 * It is the same rule the read side follows for the same reason — see
 * {@link tryResolve}, where a `packed-refs` Git refuses is every name's answer,
 * the loose ones included.
 */
export const badPackedCode = /** @type {const} */ ('ERR_BAD_PACKED')

/** @type {(dirs: Dirs) => string} */
const badPackedMessage = dirs => `${under(dirs.common, packedRefs)} is no ${packedRefs}`

/**
 * Nothing, or the refusal a packed name colliding with this one is.
 *
 * Its own function because it is a choice and not a link: the packed lines have
 * to have been read before it can be made, and what follows it is an effect
 * either way.
 *
 * @type {(packed: readonly PackedRef[], name: Bytes, dense: readonly number[]) => Effect<never, void, IoChannel>}
 */
const collided = (packed, name, dense) => {
    const other = prefixCollision(packed, dense)
    return other === null
        ? pureOk(undefined)
        : pureError(ioError({ code: refPrefixCode, message: refPrefixMessage(other, name) }))
}

/**
 * Writes `name` at `id`: the loose file, under a lock, and nothing else.
 *
 * **The lock is the write.** Git creates `<name>.lock` with `O_CREAT|O_EXCL`,
 * fills it, and renames it over the ref, so a second writer fails to take the
 * lock rather than interleaving and a reader sees the old file or the new one
 * and never a half-written one. This does the same, in five effects:
 * `packed-refs`, a `stat` of the ref's path, the directories above the file, the
 * exclusive write, the rename.
 *
 * The create and the fill are **one** effect, `fjs/effects/node`'s
 * `writeExclusive`, and that is a hole closed rather than a round trip saved: a
 * `createExclusive` that closes its descriptor and a `writeFile` that reopens the
 * pathname let a symlink in between be followed and its target overwritten. No
 * runner here can see the difference, so the `@type` below is what holds it —
 * the two calls put `CreateExclusive | WriteFile` in the operation set and this
 * one names `WriteExclusive`, so `tsc` refuses the revision.
 *
 * `.lock` is the suffix because no ref is named that —
 * [`fjs/git/refname`](../refname/module.f.mjs)'s `lockSuffix`, refused at the
 * end of every component — so the lock of one ref is never the file of another,
 * and the walk of `refs/` skips it as a write in progress.
 *
 * **The bytes are the id's hex digits and an LF**, `oidBytes * 2 + 1` of them
 * and not a fixed 41: the width is the repository's, the same one
 * {@link idWidthCode} refuses an id for missing and
 * [`fjs/git/ref`](../ref/module.f.mjs) reads back.
 *
 * **Every refusal comes before any effect that writes**, so a name or an id this
 * cannot write leaves no file behind. Five are decided from the name and the id
 * alone — a name that is no ref name ({@link badNameCode}), one no path spells
 * ({@link unspellableNameCode}), one outside `refs/` ({@link outsideRefsCode}),
 * an id of the wrong width ({@link idWidthCode}), and the zero id, which is
 * Git's *delete* rather than a value and so {@link zeroIdCode} on this side too.
 * Two more need the filesystem: a ref under the name or the name under a ref
 * ({@link refPrefixCode}), and a `packed-refs` that will not parse and so cannot
 * answer the first ({@link badPackedCode}).
 *
 * **Where it is narrower than `git update-ref`**, each measured and none of them
 * a wrong answer: it does not check that the object is there, nor — under
 * `refs/heads/`, where Git constrains it and nowhere else — that the object is a
 * commit; it does not honour `core.sharedRepository`, so on a group repository
 * the directories it creates lack the group-write bit and the *next* writer's
 * lock fails with `EACCES`; it writes no reflog line; it does not rewrite
 * `packed-refs`, so a packed line of the same name is shadowed by the new loose
 * file, which is what Git leaves too; and it does not dereference a symbolic ref
 * already at the name, which is `update-ref --no-deref`.
 *
 * **What the lock protects against is a concurrent *writer*, not a process that
 * can write in the ref's directory.** Every check here is made before the
 * `rename`, and the `rename` names a path, so a process able to create files
 * beside the ref can replace either the lock or the destination in between and
 * this will publish what it left. No check closes that — the window can be
 * narrowed and not removed, since nothing in `fjs/effects/node` publishes an
 * inode rather than a name — and such a process needs no race in any case: a ref
 * file it writes directly is one Git reads. The damage is bounded to `refs/` by
 * the `rename` replacing a symlink rather than following it. The measurements,
 * and what an operation that closed it would have to be:
 * [`../todo/ref-writing.md`](../todo/ref-writing.md).
 *
 * Every measurement behind all of this, what each divergence would cost to
 * close, and which claims have fixtures and which rest on a measurement alone:
 * that same file.
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => (name: Bytes) => (id: Oid) => Effect<ReadWhole | Stat | Mkdir | WriteExclusive | Rename | Rm, void, IoChannel>}
 */
export const tryWrite = (dirs, oidBytes) => name => id => {
    const dense = byteArray(name)
    if (!isWholeName(dense)) {
        return pureError(ioError({ code: badNameCode, message: badNameMessage(nameForMessage(name)) }))
    }
    const text = nameText(dense)
    if (text === null) {
        return pureError(ioError({ code: unspellableNameCode, message: unspellableNameMessage(name) }))
    }
    if (!text.startsWith(refsPrefix)) {
        return pureError(ioError({ code: outsideRefsCode, message: outsideRefsMessage(text) }))
    }
    // Before `hexText`, which asserts on a `Vec` that is not whole bytes: an id
    // of the wrong width is a caller's error to be told about, not a panic.
    if (length(id) !== BigInt(oidBytes) * 8n) {
        return pureError(ioError({ code: idWidthCode, message: idWidthMessage(oidBytes, id) }))
    }
    if (zeroId(id)) {
        return pureError(ioError({ code: zeroIdCode, message: zeroIdWriteMessage(name) }))
    }
    // The directory the name's file belongs in, which is one of the two and not
    // both: a per-worktree name is the worktree's own, the same rule the two
    // readers follow. See {@link dirOf}.
    const dir = dirOf(dirs, text)
    const path = under(dir, text)
    const lock = `${path}${lockSuffix}`
    // Five effects, one link each and all at one level, so the order they run
    // in is the order they are written. The cleanup is not a sixth link but a
    // wrapper around the last one, for the reason {@link unlocked} gives.
    //
    // The read comes first and is the only one that reads: a name barred by a
    // packed line must not reach the `mkdir`, because the directory the `mkdir`
    // makes *is* one half of the collision — there is no loose file for the
    // filesystem to refuse. See {@link refPrefixCode}.
    const read = tryPackedRefs(dirs, oidBytes)
    const checked = step(read, packed => packed === null
        ? pureError(ioError({ code: badPackedCode, message: badPackedMessage(dirs) }))
        : collided(packed, name, dense))
    // A directory at the ref's own path, which the `rename` would refuse — unless
    // it is a *symlink* to one, which the `rename` silently replaces. One `stat`
    // covers both, and it is before the lock so a refusal leaves nothing behind.
    // See {@link refPrefixCode}.
    const kind = step(checked, () => isDirectoryAt(path))
    const clear = step(kind, there => there
        ? pureError(ioError({ code: refPrefixCode, message: refIsDirectoryMessage(name) }))
        : pureOk(/** @type {void} */ (undefined)))
    const made = step(clear, () => mkdir(parentOf(dir, text), { recursive: true }))
    // The cleanup starts *after* the exclusive write and covers the rename alone:
    // that write succeeding is the only evidence the lock is this writer's, and
    // no failure — of it or of anything above it — is evidence of the same. See
    // {@link unlocked}.
    const filled = step(made, () => writeExclusiveUtf8File(lock, `${hexText(id)}\n`))
    return step(filled, () => unlocked(lock, rename(lock, path)))
}
