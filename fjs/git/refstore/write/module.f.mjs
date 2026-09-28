/**
 * Writing the refs a repository holds, over the effects: {@link tryWrite} puts a
 * name at an id and {@link tryDelete} takes one out.
 *
 * [`fjs/git/refstore`](../module.f.mjs) is the reading half, and the rules both
 * halves must agree on live there — which directory a name belongs to, how a
 * name and a path spell each other, which names are refused — so a name this
 * writes is one those readers find. Every rule below was measured against Git
 * 2.43.0 rather than read off a manual page.
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
 * **Deleting one is the half that touches `packed-refs`**, because a name can be
 * in a loose file *and* a `packed-refs` line, and the line comes back as the ref
 * once the file is gone. {@link tryDelete} takes both out, and the reflog, under
 * the two locks Git takes, in the order that never shows a stale value — and it
 * removes the name it is given, never the one a symbolic ref there points to.
 * [`../todo/ref-writing.md`](../todo/ref-writing.md) has the measurements and what
 * is left: the reflog as a thing to append to, and the ways both halves are
 * narrower than Git.
 *
 * @module
 *
 * @import { CreateExclusive, Mkdir, ReadFile, ReadWhole, Rename, Rm, Rmdir, Stat, WriteExclusive } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel, Operation } from '../../../effects/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../../types/nullable/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Bytes, Oid, OidBytes } from '../../types.ts'
 * @import { PackedRef, PackedWithout, Ref } from '../../ref/types.ts'
 * @import { Dirs } from '../types.ts'
 */

import { catchStep, finallyStep, foldStep, history, historyStep, ioError, mapStep, pureError, pureOk, resultStep, step } from '../../../effects/module.f.mjs'
import { createExclusive, isNotFound, mkdir, rename, rm, rmdir, writeExclusive, writeExclusiveUtf8File } from '../../../effects/node/module.f.mjs'
import { byteArray } from '../../../ebnf/byte/module.f.mjs'
import { under } from '../../../path/module.f.mjs'
import { length, maxLengthBytes, u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { hexText, isOidOf } from '../../oid/module.f.mjs'
import { tryPackedWithout, tryRef } from '../../ref/module.f.mjs'
import { isWholeName, lockSuffix } from '../../refname/module.f.mjs'
import { badNameCode, badNameMessage, dirOf, isDirectoryAt, nameForMessage, nameText, packedRefs, refsPrefix, tryBytes, tryPackedRefs, tryWholeBytes, zeroId, zeroIdCode } from '../module.f.mjs'

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
 * It is the writer's half of the gap [`tryResolve`](../module.f.mjs) answers `null` for: a
 * ref name may hold bytes that are no UTF-8 — `refs/heads/` and the byte `0x80`
 * is one `git check-ref-format` accepts and `rev-parse` resolves, measured on
 * Git 2.43.0 — and a path is text to this host, so there is no file to create.
 * A lookup may answer "no such ref" for one, since a caller asked what it
 * resolves to and nothing here can hold it; a write may not, because answering
 * anything but a refusal would claim a ref was written that no file holds.
 *
 * The path API that speaks bytes and closes it is
 * [`todo/byte-ref-names.md`](../todo/byte-ref-names.md).
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
 * wrong answer [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses.
 *
 * A pseudoref is written literally by `update-ref` — measured, `FOO_HEAD`
 * becomes `.git/FOO_HEAD` at exit 0 — so this is narrower than Git and
 * deliberately so: a ref written here is a retention root and nothing else
 * ([`todo/git-name-resolution.md`](../../../../todo/git-name-resolution.md)), and
 * the roots [`tryRoots`](../module.f.mjs) walks are the names under `refs/` plus the one
 * `HEAD` this writer will not touch. What a caller that wants one would need is
 * in [`../todo/ref-writing.md`](../todo/ref-writing.md).
 */
export const outsideRefsCode = /** @type {const} */ ('ERR_OUTSIDE_REFS')

/** @type {(text: string) => string} */
const outsideRefsMessage = text => `${text} is not under ${refsPrefix}`

/**
 * The path spelling of a name a writer may change, or the refusal it gets: one
 * that is no ref name ({@link badNameCode}), one no path spells
 * ({@link unspellableNameCode}), or one outside `refs/` ({@link outsideRefsCode}).
 *
 * Decided from the name alone, so both writers ask it before any effect and each
 * of these refusals leaves the repository as it was. {@link tryWrite} and
 * {@link tryDelete} ask the same three questions because the reasons are the
 * same for both: none of these names has a file either could safely touch.
 *
 * @type {(name: Bytes) => Result<string, IoChannel>}
 */
const refsText = name => {
    const dense = byteArray(name)
    if (!isWholeName(dense)) {
        return error(ioError({ code: badNameCode, message: badNameMessage(nameForMessage(name)) }))
    }
    const text = nameText(dense)
    if (text === null) {
        return error(ioError({ code: unspellableNameCode, message: unspellableNameMessage(name) }))
    }
    return text.startsWith(refsPrefix)
        ? ok(text)
        : error(ioError({ code: outsideRefsCode, message: outsideRefsMessage(text) }))
}

/**
 * The code a write is refused with when the id is not as wide as the
 * repository's ids are.
 *
 * A ref file holds the id as hex and a reader counts the digits: a 32-byte id
 * written into a SHA-1 repository is sixty-four of them, which
 * [`fjs/git/ref`](../../ref/module.f.mjs) reads as no ref at all — so the write
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
 * A scan with one materialisation per line, which is what [`packedId`](../module.f.mjs) costs
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
 * for the reason {@link refPrefixCode} gives — and what could not be done to it,
 * since {@link tryDelete} refuses the same path.
 *
 * @type {(name: Bytes, verb: string) => string}
 */
const refIsDirectoryMessage = (name, verb) => `${nameForMessage(name)} is a directory; cannot ${verb} it`

/**
 * The code a write is refused with when `packed-refs` is there and is no
 * `packed-refs`.
 *
 * The prefix check above cannot be answered without reading that file, so a file
 * that will not parse leaves the collision unknown — and writing anyway is the
 * plausible answer [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses. Git refuses the same write, measured with a control: with
 * `.git/packed-refs` holding one junk line, `git update-ref refs/heads/n <id>`
 * exits 128 with `unexpected line in .git/packed-refs` and writes no file,
 * while the identical write against a well-formed `packed-refs` exits 0 and
 * writes one.
 *
 * It is the same rule the read side follows for the same reason — see
 * [`tryResolve`](../module.f.mjs), where a `packed-refs` Git refuses is every name's answer,
 * the loose ones included.
 */
export const badPackedCode = /** @type {const} */ ('ERR_BAD_PACKED')

/** @type {(dirs: Dirs) => string} */
const badPackedMessage = dirs => `${under(dirs.common, packedRefs)} is no ${packedRefs}`

/**
 * The code a delete is refused with when `packed-refs` claims to be sorted and is
 * not.
 *
 * Git reads such a file by bisection, so which of its lines Git finds depends on
 * where each one sits, and taking one out moves the rest. Measured on Git 2.43.0
 * under a header that claims `sorted`: with `ccc`, `aaa` and `bbb` in that order,
 * `git rev-parse --verify refs/heads/ccc` fails while the other two resolve, and
 * deleting `aa` from `aa`, `zz`, `master` made `zz`, which resolved before, fail
 * after — and `master` the other way round. So a rewrite that keeps such a file's order can lose Git a ref the
 * delete was not asked about, and one that re-sorts it rewrites lines it was not
 * asked about either. Git's own delete is no model: it bisects too, and where it
 * misses the name it exits 0 and removes nothing — measured,
 * `git update-ref -d refs/heads/b07` over 64 lines in reverse order left the file
 * byte-identical.
 *
 * So the file is refused and left as it was, whichever name is asked about —
 * the answer {@link badPackedCode} gives a file that will not parse. Which words
 * of the header make the claim is `fjs/git/ref`'s `tryPackedWithout`.
 */
export const unsortedPackedCode = /** @type {const} */ ('ERR_UNSORTED_PACKED')

/** @type {(dirs: Dirs) => string} */
const unsortedPackedMessage = dirs => `${under(dirs.common, packedRefs)} claims to be sorted and is not`

/**
 * The code a delete is refused with when the name's loose file is there and holds
 * bytes that are no ref — no id, no `ref:` line.
 *
 * Git refuses the same delete and changes nothing. Measured on 2.43.0, for a file
 * holding `not an id`, an empty file and seven hex digits alike,
 * `git update-ref -d refs/heads/x` exits 1 with `cannot lock ref 'refs/heads/x':
 * unable to resolve reference 'refs/heads/x': reference broken`, and leaves the
 * file, its reflog and a `packed-refs` line of the same name where they were —
 * with `--no-deref` too, which is the delete this module does. A symbolic ref
 * whose target is absent, or outside `refs/`, is a ref and is deleted, measured.
 *
 * The readers answer such a name `null` — the file decides it and holds nothing —
 * so its existence is not evidence a ref was there, and answering `true` for
 * removing it would claim one was. Asked under both locks and before anything is
 * removed, since the `packed-refs` line goes first.
 */
export const brokenRefCode = /** @type {const} */ ('ERR_BROKEN_REF')

/** @type {(name: Bytes) => string} */
const brokenRefMessage = name => `${nameForMessage(name)} is no ref`

/**
 * Nothing, or the refusal a packed name colliding with this one is.
 *
 * Its own function because it is a choice and not a link: the packed lines have
 * to have been read before it can be made, and what follows it is an effect
 * either way.
 *
 * @type {(packed: readonly PackedRef[], name: Bytes) => Effect<never, void, IoChannel>}
 */
const collided = (packed, name) => {
    const other = prefixCollision(packed, byteArray(name))
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
 * [`fjs/git/refname`](../../refname/module.f.mjs)'s `lockSuffix`, refused at the
 * end of every component — so the lock of one ref is never the file of another,
 * and the walk of `refs/` skips it as a write in progress.
 *
 * **The bytes are the id's hex digits and an LF**, `oidBytes * 2 + 1` of them
 * and not a fixed 41: the width is the repository's, the same one
 * {@link idWidthCode} refuses an id for missing and
 * [`fjs/git/ref`](../../ref/module.f.mjs) reads back.
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
export const tryWrite = (dirs, oidBytes) => {
    const isOid = isOidOf(oidBytes)
    return name => id => {
        const named = refsText(name)
        if (named[0] === 'error') { return pureError(named[1]) }
        const [, text] = named
        // Before `hexText`, which asserts on a `Vec` that is not whole bytes: an id
        // of the wrong width is a caller's error to be told about, not a panic.
        if (!isOid(id)) {
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
            : collided(packed, name))
        // A directory at the ref's own path, which the `rename` would refuse — unless
        // it is a *symlink* to one, which the `rename` silently replaces. One `stat`
        // covers both, and it is before the lock so a refusal leaves nothing behind.
        // See {@link refPrefixCode}.
        const kind = step(checked, () => isDirectoryAt(path))
        const clear = step(kind, there => there
            ? pureError(ioError({ code: refPrefixCode, message: refIsDirectoryMessage(name, 'create') }))
            : pureOk(/** @type {void} */ (undefined)))
        const made = step(clear, () => mkdir(parentOf(dir, text), { recursive: true }))
        // The cleanup starts *after* the exclusive write and covers the rename alone:
        // that write succeeding is the only evidence the lock is this writer's, and
        // no failure — of it or of anything above it — is evidence of the same. See
        // {@link unlocked}.
        const filled = step(made, () => writeExclusiveUtf8File(lock, `${hexText(id)}\n`))
        return step(filled, () => unlocked(lock, rename(lock, path)))
    }
}

/**
 * `e` with whatever it answers dropped, for a removal whose failure changes
 * nothing a caller asked about.
 *
 * @template {Operation} O
 * @param {Effect<O, unknown, IoChannel>} e
 * @returns {Effect<O, void, never>}
 */
const dropped = e => resultStep(e, () => pureOk(undefined))

/**
 * `e` run holding `lock`: the lock taken by an exclusive create, and given back
 * once `e` is done, whatever it answered.
 *
 * Given back only where it was taken, because the create succeeding is the
 * evidence that the lock is this writer's — the rule {@link unlocked} states. A
 * lock another writer holds answers `EEXIST` and is left where it is.
 *
 * The lock is never written, which is Git's: measured with `strace` on 2.43.0,
 * both of a delete's locks are opened with `O_CREAT|O_EXCL` and closed empty, so
 * they are mutexes and not files being filled — which is why this is
 * `createExclusive` and not {@link tryWrite}'s `writeExclusive`.
 *
 * @template {Operation} O
 * @template T
 * @param {string} lock
 * @param {Effect<O, T, IoChannel>} e
 * @returns {Effect<O | CreateExclusive | Rm, T, IoChannel>}
 */
const holding = (lock, e) => step(createExclusive(lock), () => finallyStep(e, () => rm(lock)))

/**
 * The directories a ref named `text` sits in, from the top: `refs`,
 * `refs/heads`, `refs/heads/a` for `refs/heads/a/b`.
 *
 * @type {(text: string) => readonly string[]}
 */
const ancestors = text => {
    const parts = text.split('/')
    return Array.from({ length: parts.length - 1 }, (_, i) => parts.slice(0, i + 1).join('/'))
}

/**
 * The directories a delete of `text` may leave empty, deepest first: each one
 * between the ref and `refs/<top>/`, which is where Git stops.
 *
 * Measured on Git 2.43.0: deleting `refs/heads/a/b/c` removes `refs/heads/a/b` and
 * `refs/heads/a`, and deleting the last ref under `refs/remotes/origin` removes
 * that directory while `refs/remotes` stays — as does `refs/heads` with nothing in
 * it. The same holds below `logs/`, and for a directory that was empty before the
 * delete began.
 *
 * @type {(text: string) => readonly string[]}
 */
const emptiable = text => {
    const below = ancestors(text).slice(2)
    return below.map((_, i) => below[below.length - 1 - i])
}

/**
 * Removes each directory in turn until one will not go. One that is not empty
 * will not, and then no directory above it is either.
 *
 * @type {(paths: readonly string[]) => Effect<Rmdir, void, never>}
 */
const emptied = paths => dropped(foldStep(
    pureOk(paths),
    /** @type {void} */ (undefined),
    p => () => rmdir(p)))

/**
 * Whether this call made the directory at `path`: `false` where one was there.
 *
 * Not `recursive`, which answers `ok` both ways and so cannot say which it was.
 * A file at the path would be `EEXIST` too, and never reaches this: the `stat`
 * {@link tryDelete} makes first answers `ENOTDIR` through it.
 *
 * @type {(path: string) => Effect<Mkdir, boolean, IoChannel>}
 */
const madeHere = path => catchStep(
    mapStep(mkdir(path), () => true),
    e => e[0] === 'ioError' && e[1].code === 'EEXIST' ? pureOk(false) : pureError(e))

/**
 * The directories above the ref, made one at a time from the top, and those this
 * call made, deepest first.
 *
 * @type {(dir: string, text: string) => Effect<Mkdir, readonly string[], IoChannel>}
 */
const madeFor = (dir, text) => foldStep(
    pureOk(ancestors(text).map(d => under(dir, d))),
    /** @type {readonly string[]} */ ([]),
    path => made => mapStep(madeHere(path), here => here ? [path, ...made] : made))

/**
 * `e` with the directories above the ref made first, and removed again once `e`
 * is done by one of two rules, chosen by how it ended.
 *
 * **A delete that happened prunes as Git does**: every directory it left empty
 * below `refs/<top>/`, and below `logs/` — one that was already empty included,
 * which Git removes too, measured. Git makes them to hold the lock, measured: it
 * creates `refs/heads/feat/deep` to lock a *packed-only*
 * `refs/heads/feat/deep/x`, and removes it once the delete is done.
 *
 * **A refused one removes exactly what it made**, so the repository is as it was.
 * Git does not: measured with `packed-refs.lock` held, it keeps an empty
 * `refs/heads/a` that was there — as this does — and also leaves the
 * `refs/heads/c` it made for `refs/heads/c/d`, which this does not. A directory
 * that was there is never removed on a refusal, which a revision that pruned by
 * the success rule on both paths did; found by review of
 * [#2315](https://github.com/functionalscript/functionalscript/pull/2315).
 *
 * A `mkdir` that fails part-way leaves the directories made before it: the list
 * of what was made is the fold's state, and a failed fold has none.
 *
 * @template {Operation} O
 * @template T
 * @param {string} dir
 * @param {string} text
 * @param {Effect<O, T, IoChannel>} e
 * @returns {Effect<O | Mkdir | Rmdir, T, IoChannel>}
 */
const within = (dir, text, e) => {
    const dirs = emptiable(text)
    const pruned = step(
        emptied(dirs.map(d => under(dir, d))),
        () => emptied(dirs.map(d => under(dir, `logs/${d}`))))
    return step(madeFor(dir, text), made => finallyStep(e, r => r[0] === 'ok' ? pruned : emptied(made)))
}

/**
 * `bytes` as the chunks {@link writeExclusive} takes, each as long as a `Vec` may
 * be. A `packed-refs` passes that length at about 1,870 refs; see
 * {@link tryPackedRefs}.
 *
 * @type {(bytes: readonly number[]) => readonly Vec[]}
 */
const chunked = bytes => {
    const size = Number(maxLengthBytes)
    return Array.from(
        { length: Math.ceil(bytes.length / size) },
        (_, i) => u8ListToVecMsb(bytes.slice(i * size, (i + 1) * size)))
}

/**
 * What taking the name out of `packed-refs` comes to: a refusal, `false` where
 * the file does not name it, or `true` once the file without it has replaced the
 * file with it.
 *
 * The file without it is written to `packed-refs.new`, created exclusively, and
 * renamed over `packed-refs` — Git's own staging name, measured with `strace` —
 * so a reader sees one file or the other and never a half-written one. It is
 * given back where the rename fails, as {@link tryWrite}'s lock is and for the
 * same reason ({@link unlocked}); one already there is another writer's, since
 * this one holds `packed-refs.lock`, and is refused with `EEXIST` and left.
 *
 * @type {(dirs: Dirs) => (without: PackedWithout) => Effect<WriteExclusive | Rename | Rm, boolean, IoChannel>}
 */
const packedRewritten = dirs => without => {
    if (without[0] === 'malformed') {
        return pureError(ioError({ code: badPackedCode, message: badPackedMessage(dirs) }))
    }
    if (without[0] === 'unsorted') {
        return pureError(ioError({ code: unsortedPackedCode, message: unsortedPackedMessage(dirs) }))
    }
    if (without[0] === 'absent') { return pureOk(false) }
    const packed = under(dirs.common, packedRefs)
    const staged = `${packed}.new`
    const written = writeExclusive(staged, chunked(without[1]))
    const renamed = step(written, () => unlocked(staged, rename(staged, packed)))
    return mapStep(renamed, () => true)
}

/**
 * The loose file removed, where there is one: nothing where the name is absent.
 *
 * What it answers is not whether a ref was there, because removing a name does
 * not show one was. A symbolic link that leads nowhere is removed here as Git
 * removes it — measured on 2.43.0, `git update-ref -d` exits 0 and unlinks it,
 * with `--no-deref` or without — and it held no ref: `show-ref` does not list
 * it and `rev-parse --verify` refuses the name. Whether a ref was there is
 * {@link looseRef}'s answer, from the bytes read.
 *
 * A directory at the path never reaches this — {@link tryDelete} refuses it
 * before it takes a lock — so the entry removed is the ref's.
 *
 * @type {(path: string) => Effect<Rm, void, IoChannel>}
 */
const looseRemoved = path => catchStep(
    rm(path),
    e => isNotFound(e) ? pureOk(undefined) : pureError(e))

/**
 * Whether the name's loose file holds a ref: `true` for an id or a `ref:` line,
 * `false` where there is no file to read — absent, or a link that leads nowhere,
 * which reads as absent — and the refusal {@link brokenRefCode} for bytes that
 * are neither. A directory never reaches this; {@link tryDelete} has refused it.
 *
 * @type {(readRef: (bytes: Bytes) => Nullable<Ref>, name: Bytes, path: string) => Effect<ReadFile, boolean, IoChannel>}
 */
const looseRef = (readRef, name, path) => step(
    tryBytes(path),
    bytes => {
        if (bytes === null) { return pureOk(false) }
        return readRef(bytes) === null
            ? pureError(ioError({ code: brokenRefCode, message: brokenRefMessage(name) }))
            : pureOk(true)
    })

/**
 * `packed-refs` read and, where it names the ref, rewritten without it — and
 * whether it named it.
 *
 * @type {(dirs: Dirs, without: (input: Bytes) => PackedWithout) => Effect<ReadWhole | WriteExclusive | Rename | Rm, boolean, IoChannel>}
 */
const packedTaken = (dirs, without) => step(
    mapStep(
        tryWholeBytes(under(dirs.common, packedRefs)),
        b => b === null ? /** @type {PackedWithout} */ (['absent']) : without(b)),
    packedRewritten(dirs))

/**
 * The name taken out, under both locks: its loose file read, then its
 * `packed-refs` line, its loose file and its reflog removed — and whether either
 * file held it.
 *
 * Both files are read here, under the locks, and not before: a read made before
 * a lock was taken is one another writer may have replaced since.
 *
 * @type {(dirs: Dirs, name: Bytes, path: string, log: string, readRef: (bytes: Bytes) => Nullable<Ref>, without: (input: Bytes) => PackedWithout) => Effect<ReadFile | ReadWhole | WriteExclusive | Rename | Rm, boolean, IoChannel>}
 */
const removed = (dirs, name, path, log, readRef, without) => {
    const found = history(looseRef(readRef, name, path))
    const packed = historyStep(found, () => packedTaken(dirs, without))
    const loose = historyStep(packed, () => looseRemoved(path))
    const logged = historyStep(loose, () => dropped(rm(log)))
    return mapStep(logged, ([, , wasPacked, wasLoose]) => wasPacked || wasLoose)
}

/**
 * Deletes `name`: its `packed-refs` line, its loose file and its reflog, under
 * the two locks Git takes, and answers whether there was a ref to delete.
 *
 * **`false` is an answer and not a refusal**: no ref of that name was there and
 * none is now. Git exits 0 and says nothing for both, measured; a caller that
 * wanted the ref gone has it gone either way, and one that expected it to be
 * there can tell.
 *
 * **The protocol is Git's**, measured with `strace` on 2.43.0: `<name>.lock` and
 * then `packed-refs.lock`, each created exclusively, for every delete — an absent
 * name included — and neither ever written. Under both, `packed-refs` is read,
 * and where it names the ref the file without that line is written to
 * `packed-refs.new` and renamed over it; then the loose file goes, the locks are
 * given back, and the directories the name leaves empty are removed. This does
 * the same, in the same order, with the one exception below — and reads the
 * loose file first, under both locks, for the refusal Git makes there.
 * Directories are made one at a time, so that a refused delete can remove exactly
 * the ones it made; see {@link within}.
 *
 * **The packed line goes before the loose file**, because the loose file shadows
 * it: the other order leaves a moment where the file is gone and the packed
 * line, with whatever stale id it holds, is the ref again — and a failure in that
 * moment leaves it the ref for good.
 *
 * **The reflog goes last, where Git removes it before renaming `packed-refs`.** A
 * delete that fails after the rename has taken the packed line and left the loose
 * file, which still decides the name, so the ref is what it was — and in Git's
 * order its history is gone. Here it is kept. Once the ref is gone, what removing
 * the reflog answers is dropped, because a reflog left behind can only keep more
 * objects from being collected, never fewer; and so is what removing the
 * directories answers, because a directory left behind holds no ref.
 *
 * **The name is deleted, never what it points to.** A symbolic ref at `name` is
 * removed as a file, which is `git update-ref --no-deref -d`. Without
 * `--no-deref`, Git deletes the *target* and leaves the symbolic ref dangling —
 * measured, `git fsck` then exits 2 with `invalid sha1 pointer 0000…`. And a name
 * outside `refs/` is {@link outsideRefsCode}, because the one that matters is
 * `HEAD`: measured, `git update-ref --no-deref -d HEAD` exits 0 having removed
 * `.git/HEAD`, and Git no longer sees a repository there.
 *
 * **Every refusal leaves the repository as it was.** Three come from the name
 * alone and are {@link tryWrite}'s too. A directory at the name's path is
 * {@link refPrefixCode}, which Git refuses as well — measured, with
 * `refs/heads/a/b` there, `git update-ref -d refs/heads/a` exits 1 with
 * `'refs/heads/a/b' exists; cannot create 'refs/heads/a'`, and the same where
 * `refs/heads/a` is a symlink to a directory. A file where one of the name's
 * directories would be is the host's `ENOTDIR`, and a lock another writer holds is
 * the host's `EEXIST`. A loose file that holds no ref is {@link brokenRefCode},
 * as Git refuses it. A `packed-refs` that will not parse is
 * {@link badPackedCode}, and one that claims to be sorted and is not is
 * {@link unsortedPackedCode}. The ones decided under the locks leave no
 * directory behind that the delete made, and remove none that was there.
 *
 * **Where it differs from `git update-ref -d`**, each measured:
 *
 * - an **empty** directory at the name's path is refused, where Git removes it —
 *   the same narrowness {@link refPrefixCode} names for a write;
 * - an absent name that is a directory prefix of a packed one answers `false`,
 *   where Git exits 1 with `'refs/heads/a/b' exists; cannot create
 *   'refs/heads/a'` — a refusal about the lock it could not take, for a name that
 *   holds no ref;
 * - a `packed-refs` that names the ref twice loses **every** line of it, where Git
 *   removes one and exits 0 with the ref still resolvable;
 * - the rewrite keeps the file's own header and order, where Git writes its own
 *   header, re-sorts, and adds any `^` line a tag lacks. For a file Git wrote the
 *   two are byte-identical; why the rest are kept is `fjs/git/ref`'s
 *   `tryPackedWithout`.
 *
 * The measurements, and what is left to do:
 * [`../todo/ref-writing.md`](../todo/ref-writing.md).
 *
 * @type {(dirs: Dirs, oidBytes: OidBytes) => (name: Bytes) => Effect<Stat | Mkdir | CreateExclusive | ReadFile | ReadWhole | WriteExclusive | Rename | Rm | Rmdir, boolean, IoChannel>}
 */
export const tryDelete = (dirs, oidBytes) => {
    const readRef = tryRef(oidBytes)
    const packedWithout = tryPackedWithout(oidBytes)
    return name => {
        const named = refsText(name)
        if (named[0] === 'error') { return pureError(named[1]) }
        const [, text] = named
        // One directory of the two, as for a write: see {@link dirOf}.
        const dir = dirOf(dirs, text)
        const path = under(dir, text)
        // A directory at the ref's path, or a symlink to one: refs sit under the
        // name, and removing the link would lose every one of them. Before any
        // lock, so the refusal leaves nothing behind; a file where a directory of
        // the path would be is the same `stat`'s `ENOTDIR`. See {@link refPrefixCode}.
        const kind = isDirectoryAt(path)
        const clear = step(kind, there => there
            ? pureError(ioError({ code: refPrefixCode, message: refIsDirectoryMessage(name, 'delete') }))
            : pureOk(/** @type {void} */ (undefined)))
        const taken = removed(dirs, name, path, under(dir, `logs/${text}`), readRef, packedWithout(name))
        const packedLock = `${under(dirs.common, packedRefs)}${lockSuffix}`
        return step(clear, () => within(dir, text, holding(`${path}${lockSuffix}`, holding(packedLock, taken))))
    }
}
