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
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { catchStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { isNotFound, readFile, stat } from '../../effects/node/module.f.mjs'
import { join } from '../../path/module.f.mjs'
import { fromVec } from '../../text/utf8/module.f.mjs'

/** What a `.git` file says before the directory it names. */
const gitdir = /** @type {const} */ ('gitdir: ')

/**
 * What a file of Git's says, or `null` where its bytes are no UTF-8.
 *
 * Git keeps a path as the bytes it read and hands those same bytes back to
 * the filesystem, so any byte a name may hold is a name it can follow. The
 * effects layer spells a path a string, so a path arrives here decoded and
 * leaves re-encoded, and that round trip is exact for UTF-8 and for nothing
 * else: a lone `0xff` decodes to `U+00FF` and goes back out as `0xc3 0xbf`,
 * naming a different directory that may well exist. So bytes that are no
 * UTF-8 name no directory this module can follow, and it says so rather
 * than following another.
 *
 * @type {(path: string) => Effect<ReadFile, Nullable<string>, IoChannel>}
 */
const textAt = path => mapStep(readFile(path), fromVec)

/**
 * The path a one-line file of Git's names: the text with the line's end
 * taken off and nothing else. Git strips a trailing `\n` and `\r` from
 * both of these files and no other whitespace, so `gitdir: x  ` names the
 * directory `x  ` and not `x`.
 *
 * @type {(text: string) => string}
 */
const named = text => text.endsWith('\n') || text.endsWith('\r')
    ? named(text.slice(0, -1))
    : text

/** A letter, which is what a Windows drive is named by. */
const isDriveLetter = /** @type {(c: string) => boolean} */ (
    c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))

/**
 * Whether a path stands on its own, which is what Git's `is_absolute_path`
 * asks and what decides whether the directory the file sits in is read
 * first.
 *
 * A `/` says so on either host. A drive says so on Windows alone — Git's
 * `has_dos_drive_prefix` is nothing on POSIX, so a POSIX directory really
 * named `C:` is relative there — and it is read as a root here because it
 * is what Windows Git writes into a gitfile and a POSIX directory named
 * after a drive is not a thing that happens. This is the same reading
 * [`fjs/path`](../../path/module.f.mjs) takes of a drive, and the same
 * limitation it records.
 *
 * A `\` is Windows' other root and is *not* read as one: Git writes a
 * gitfile with `/` separators on every host, so no gitfile begins with a
 * `\` that means a root, while a POSIX file may well be named `\x` and
 * would be lost by reading it as one.
 *
 * @type {(path: string) => boolean}
 */
const isAbsolute = path => path.startsWith('/') || (isDriveLetter(path[0]) && path[1] === ':')

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
const against = (dir, path) => isAbsolute(path) ? path : join(dir, path)

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
 * {@link textAt} gives.
 *
 * @type {(repo: string) => Effect<ReadFile, Nullable<string>, IoChannel>}
 */
const commonOf = repo => catchStep(
    mapStep(textAt(`${repo}/commondir`), text => {
        if (text === null || text === '') { return null }
        const line = named(text)
        return line === '' ? repo : against(repo, line)
    }),
    e => isNotFound(e) ? pureOk(repo) : pureError(e))

/**
 * The repository directory a worktree's `.git` file names, or `null` where
 * the bytes are no such file: Git wants `gitdir: ` first and a path after
 * it, and calls anything else `invalid gitfile format` or `no path in
 * gitfile`. A relative path is read against the directory the file sits in.
 *
 * @type {(worktree: string, text: string) => Nullable<string>}
 */
const tryGitdir = (worktree, text) => {
    if (!text.startsWith(gitdir)) { return null }
    const line = named(text.slice(gitdir.length))
    return line === '' ? null : against(worktree, line)
}

/**
 * The common directory of the repository a worktree belongs to, or `null`
 * where its `.git` is a file that is no gitfile. A worktree with no `.git`
 * at all is the channel's, as a directory with no `config` is: both say the
 * caller named no repository rather than that one is malformed.
 *
 * @type {(worktree: string) => Effect<ReadFile | Stat, Nullable<string>, IoChannel>}
 */
export const tryCommonDir = worktree => {
    const path = `${worktree}/.git`
    return step(stat(path), s => {
        if (s.isDirectory) { return commonOf(path) }
        return step(textAt(path), text => {
            const repo = text === null ? null : tryGitdir(worktree, text)
            return repo === null ? pureOk(null) : commonOf(repo)
        })
    })
}
