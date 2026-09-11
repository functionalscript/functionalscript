/**
 * From a worktree to the repository directory that holds its objects: the
 * step [`fjs/git/store`](../store/module.f.mjs) and
 * [`fjs/git/walk`](../walk/module.f.mjs) leave to their caller, since both
 * take that directory as it is given rather than finding it.
 *
 * Git reaches it by one rule whatever kind of worktree it starts from, and
 * {@link tryCommonDir} is that rule:
 *
 * - `.git` in the worktree is either a directory, which is the
 *   repository, or a file whose `gitdir: ` line names one. `git init`
 *   makes the first; `git init --separate-git-dir` and `git worktree add`
 *   make the second.
 * - That directory is the repository unless it holds a `commondir` file,
 *   whose line names the repository instead. A linked worktree's directory
 *   sits under the main repository's `worktrees/` and has one; a main
 *   repository has none.
 *
 * So `objects/`, `packed-refs` and the shared refs live at the answer, and
 * a linked worktree's own directory — which holds its `HEAD` and its index
 * and no objects — is passed through rather than searched. The parent of a
 * `.git` file holds no objects either and is never looked at.
 *
 * The answer is where Git would look and not a promise that a repository
 * is there: reading `config` at it is what says whether one is, and that is
 * `fjs/git/store`'s `oidBytes`.
 *
 * Two things about a path Git has and this does not, and both are answered
 * by refusing rather than by guessing. A path is bytes to Git and a string
 * to the effects layer, so one that is no UTF-8 names no directory here —
 * see {@link textAt}. And whether a path stands on its own is the host's
 * question, which a reader of text cannot put to it — see
 * {@link isAbsolute}.
 *
 * @module
 *
 * @import { IoChannel, ReadFile, Stat } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { catchStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { isNotFound, readFile, stat } from '../../effects/node/module.f.mjs'
import { join } from '../../path/module.f.mjs'
import { fromVec } from '../../text/utf8/module.f.mjs'
import { msb, u8List, u8ListToVec } from '../../types/bit_vec/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/** What a `.git` file says before the directory it names. */
const gitdir = /** @type {const} */ ('gitdir: ')

/**
 * A file of Git's read as Git reads one: `size` the bytes it holds after
 * the line's end is taken off, and `text` what stands before the first NUL
 * of those, decoded, or `null` where those bytes are no UTF-8.
 *
 * Three of Git's steps, in Git's order, and the order is what makes them
 * agree with it.
 *
 * The line's end comes off the bytes first, and it is a `\n` and a `\r`
 * and no other whitespace, so `gitdir: x  ` names the directory `x  `. The
 * run is found once and cut once rather than a step per byte: a file's
 * length is whatever wrote it, and Git reads a gitfile padded with two
 * hundred thousand newlines, where a step per byte gives out an order of
 * magnitude below the 131072 a `Vec` carries. `size` is what is left, which
 * is the length Git asks `no path in gitfile` of.
 *
 * The NUL comes next, because Git reads a path out of those bytes as a C
 * string: `gitdir: /r\\0junk` names `/r` and opens it. It comes after the
 * line's end for a reason a case shows — `gitdir: /r\n\\0` names `/r\n`
 * to Git, since the last byte is the NUL and no line's end is there to
 * take off.
 *
 * The decoding comes last, and only of what survives, which is the point of
 * doing it here rather than to the file whole. Git keeps a path as the
 * bytes it read and hands those same bytes back to the filesystem, so any
 * byte a name may hold is a name it can follow; the effects layer spells a
 * path a string, so a path arrives decoded and leaves re-encoded, and that
 * round trip is exact for UTF-8 and nothing else — a lone `0xff` decodes to
 * `U+00FF` and goes back out as `0xc3 0xbf`, naming a different directory
 * that may well exist. So bytes that are no UTF-8 name no directory here.
 * But bytes past the first NUL are no part of the path at all, so junk
 * there is nothing to refuse a good path over.
 *
 * @type {(v: Vec) => { readonly raw: number, readonly size: number, readonly text: Nullable<string> }}
 */
const read = v => {
    const bs = /** @type {readonly number[]} */ (toArray(u8List(msb)(v)))
    const end = bs.slice(0, bs.findLastIndex(b => b !== 0x0A && b !== 0x0D) + 1)
    const nul = end.indexOf(0)
    return {
        raw: bs.length,
        size: end.length,
        text: fromVec(u8ListToVec(msb)(nul === -1 ? end : end.slice(0, nul))),
    }
}

/**
 * The same at a path, over the effects.
 *
 * @type {(path: string) => Effect<ReadFile, { readonly raw: number, readonly size: number, readonly text: Nullable<string> }, IoChannel>}
 */
const readAt = path => mapStep(readFile(path), read)

/** A letter, which is what a Windows drive is named by. */
const isDriveLetter = /** @type {(c: string) => boolean} */ (
    c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))

/**
 * Whether a path stands on its own, which is what Git's `is_absolute_path`
 * asks and what decides whether the directory the file sits in is read
 * first.
 *
 * A `/` says so on either host. A drive with a `/` after it says so on
 * Windows alone — Git's `has_dos_drive_prefix` is nothing on POSIX, so a
 * POSIX directory really named `C:` is relative there — and it is read as a
 * root here because `C:/…` is what Windows Git writes into a gitfile and a
 * POSIX directory named after a drive is not a thing that happens. This is
 * the same reading [`fjs/path`](../../path/module.f.mjs) takes of a drive,
 * and the same limitation it records.
 *
 * The `/` is required. `C:r` names a directory under drive C's *current*
 * directory rather than a directory of its own, so Windows Git writes no
 * such gitfile, and on POSIX it is an ordinary relative path Git reads
 * against the worktree — which is what it is read as here.
 *
 * A `\` is Windows' other root and is *not* read as one either: Git
 * writes a gitfile with `/` separators on every host, so no gitfile begins
 * with a `\` that means a root, while a POSIX file may well be named
 * `\x` and would be lost by reading it as one.
 *
 * @type {(path: string) => boolean}
 */
const isAbsolute = path =>
    path.startsWith('/') || (isDriveLetter(path[0]) && path[1] === ':' && path[2] === '/')

/**
 * A path below a directory. A `/` joins them, except where the directory is
 * a bare drive, which takes what is below it with no separator at all:
 * `C:` names the current directory on drive C and `C:.git` is the `.git`
 * in it, where `C:/.git` is the one at the drive's root — two directories,
 * and Windows resolves each per drive from the process. Joining the two
 * with a `/` would quietly turn the first into the second.
 *
 * This is the drive reading {@link isAbsolute} takes, applied to the path
 * the caller spells rather than the one a file holds, and it carries the
 * same limitation: on POSIX a directory really named `C:` takes its `.git`
 * below a separator like any other, and this would name `C:.git` instead.
 * A POSIX directory named after a drive is not a thing that happens; a
 * Windows caller standing on one is.
 *
 * @type {(dir: string, name: string) => string}
 */
const under = (dir, name) =>
    dir.length === 2 && isDriveLetter(dir[0]) && dir[1] === ':' ? `${dir}${name}` : join(dir, name)

/**
 * A path one of these files names, read where it was found: an absolute
 * one stands on its own and a relative one is joined to the directory the
 * file sits in.
 *
 * Joined and not folded. A `..` is left for the filesystem to resolve, as
 * Git leaves it: where a component is a symbolic link, `..` climbs out of
 * what the link points at rather than out of the link's own parent, and a
 * reader that collapsed `/alias/w/../r` to `/alias/r` would name a
 * directory that need not exist. So the answer names the directory rather
 * than spelling it the shortest way, which is what a caller that reads at
 * it needs.
 *
 * @type {(dir: string, path: string) => string}
 */
const against = (dir, path) => isAbsolute(path) ? path : under(dir, path)

/**
 * The directory `<repo>/commondir` names, read against `repo`, or `repo`
 * itself where there is no such file. An absolute line replaces `repo` and
 * a relative one is taken from it — `../..` under `worktrees/<name>` is the
 * repository that owns them — and a line naming nothing is `repo`, which is
 * the path Git builds from it.
 *
 * A file of no bytes at all is `null`, where a file of one newline is not:
 * Git reads the file and dies where the read gives it nothing, so the two
 * are a malformed repository and a repository whose common directory is
 * its own. Bytes that are no UTF-8 are `null` as well, for the reason
 * {@link read} gives.
 *
 * @type {(repo: string) => Effect<ReadFile, Nullable<string>, IoChannel>}
 */
const commonOf = repo => catchStep(
    mapStep(readAt(under(repo, 'commondir')), ({ raw, text }) => {
        // The file of no bytes is the file as it was read, before the
        // line's end came off it: that is the one Git dies on, where a file
        // of one newline is a repository whose common directory is its own.
        if (raw === 0 || text === null) { return null }
        return text === '' ? repo : against(repo, text)
    }),
    e => isNotFound(e) ? pureOk(repo) : pureError(e))

/**
 * The repository directory a worktree's `.git` file names, or `null` where
 * the bytes are no such file: Git wants `gitdir: ` first and a path after
 * it, and calls anything else `invalid gitfile format` or `no path in
 * gitfile`. A relative path is read against the directory the file sits in.
 *
 * @type {(worktree: string, size: number, text: string) => Nullable<string>}
 */
const tryGitdir = (worktree, size, text) => {
    if (!text.startsWith(gitdir)) { return null }
    // `no path in gitfile` is what Git asks of the bytes it read, before a
    // path is taken out of them, so it is the size that answers it and a
    // line that is nothing but a NUL gets past it and names the worktree.
    return size <= gitdir.length ? null : against(worktree, text.slice(gitdir.length))
}

/**
 * The common directory of the repository a worktree belongs to, or `null`
 * where what it finds names no directory. Four things are that, and the
 * last two are reached with `.git` a directory as readily as a file:
 *
 * - a `.git` that is neither a directory nor a regular file — a FIFO, a
 *   socket, a device — which Git will not open as a gitfile;
 * - a `.git` file that is no gitfile, which Git calls `invalid gitfile
 *   format` or `no path in gitfile`;
 * - a `commondir` of no bytes at all, which Git dies on, where a
 *   `commondir` of one newline is a repository whose common directory is
 *   its own;
 * - bytes in either file, before its first NUL, that are no UTF-8, for the
 *   reason {@link read} gives.
 *
 * A worktree with no `.git` at all is the channel's, as a directory with no
 * `config` is: both say the caller named no repository rather than that one
 * is malformed.
 *
 * @type {(worktree: string) => Effect<ReadFile | Stat, Nullable<string>, IoChannel>}
 */
export const tryCommonDir = worktree => {
    const path = under(worktree, '.git')
    return step(stat(path), s => {
        if (s.isDirectory) { return commonOf(path) }
        // A `.git` that is neither is no gitfile and is not read. Git asks
        // `S_ISREG` before it opens one, and the question is not idle: a
        // FIFO stats without being either, and reading one waits for a
        // writer that a worktree has no reason to have, so a malformed
        // checkout would hang the caller where Git refuses it at once.
        if (!s.isFile) { return pureOk(null) }
        return step(readAt(path), ({ size, text }) => {
            const repo = text === null ? null : tryGitdir(worktree, size, text)
            return repo === null ? pureOk(null) : commonOf(repo)
        })
    })
}
