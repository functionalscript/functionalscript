/**
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { ReadFile, Stat } from '../../effects/node/types.ts'
 * @import { State } from '../../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { vec } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryCommonDir } from './module.f.mjs'

/** A file of one line of text, as the virtual filesystem holds one. */
const file = /** @type {(text: string) => readonly [import('../../types/bit_vec/types.ts').Vec]} */ (
    text => [utf8(text)])

/** A file of bytes a text has no spelling for. */
const raw = /** @type {(bits: bigint, n: bigint) => readonly [import('../../types/bit_vec/types.ts').Vec]} */ (
    (bits, n) => [vec(bits)(n)])

/** What every repository directory holds, so the shapes below read alike. */
const repo = /** @type {State['root'][string]} */ ({ config: file('[core]\n\trepositoryformatversion = 0\n'), objects: {} })

/**
 * The answer, or `null` where the walk refused, over a virtual filesystem.
 *
 * @type {(root: State['root']) => (worktree: string) => unknown}
 */
const at = root => worktree => {
    const [, result] = virtual({ ...emptyState, root })(tryCommonDir(worktree))
    const [tag, value] = result
    return tag === 'error' ? result : value
}

export const proof = {
    // `git init`: `.git` is the directory, and it holds no `commondir`, so
    // it is the repository and the common directory both.
    plain: () => {
        assertEq(at({ w: { '.git': repo } })('w'), 'w/.git')
    },
    // `git init --separate-git-dir`: `.git` is a file naming the
    // repository, which holds no `commondir` either.
    separate: () => {
        const root = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /r\n') }, r: repo })
        assertEq(at(root)('w'), '/r')
    },
    // `git worktree add`: `.git` names the worktree's own directory under
    // the main repository's `worktrees/`, whose `commondir` names the
    // repository that owns `objects/`. The worktree's directory holds no
    // objects and is passed through.
    linked: () => {
        const root = /** @type {State['root']} */ ({
            m: { '.git': { ...repo, worktrees: { l: { commondir: file('../..\n'), HEAD: file('ref: refs/heads/x\n') } } } },
            w: { '.git': file('gitdir: /m/.git/worktrees/l\n') },
        })
        assertEq(at(root)('w'), '/m/.git/worktrees/l/../..')
    },
    // A `gitdir:` line is read against the directory the file sits in where
    // it names a relative path, as Git reads one — joined and not folded,
    // so the `..` is the filesystem's to resolve. A `..` folded here would
    // climb out of a symbolic link's own parent where the filesystem climbs
    // out of what the link points at, and name a directory that need not
    // exist.
    relative: () => {
        const root = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: ../r\n') }, r: repo })
        assertEq(at(root)('w'), 'w/../r')
    },
    // A `commondir` line is read against the repository directory, and an
    // absolute one replaces it.
    common: () => {
        const abs = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('/m/.git\n') }, m: { '.git': repo } })
        assertEq(at(abs)('w'), '/m/.git')
        // A line naming nothing is the repository directory, which is the
        // path Git builds from it; a file of no bytes at all is `null`,
        // since Git dies where the read gives it nothing.
        const none = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('\n') } })
        assertEq(at(none)('w'), '/d')
        const empty = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('') } })
        assertEq(at(empty)('w'), null)
        // A relative line is joined to the repository directory, unfolded.
        const rel = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /m/.git/worktrees/l\n') }, m: { '.git': { ...repo, worktrees: { l: { commondir: file('../..\n') } } } } })
        assertEq(at(rel)('w'), '/m/.git/worktrees/l/../..')
    },
    // Only the line's end comes off, as Git takes only that. A file written
    // without a newline reads the same as one with; a path ending in a
    // space names a directory ending in a space; and a second space after
    // the colon is the path's first character, which makes the path
    // relative — `git rev-parse --git-dir` there names
    // `<worktree>/ <path>`, and so does this.
    ends: () => {
        assertEq(at({ w: { '.git': file('gitdir: /r') } })('w'), '/r')
        assertEq(at({ w: { '.git': file('gitdir: /r\r\n') } })('w'), '/r')
        assertEq(at({ w: { '.git': file('gitdir: /r \n') } })('w'), '/r ')
        assertEq(at({ w: { '.git': file('gitdir:  /r\n') } })('w'), 'w/ /r')
    },
    // A `.git` file that is no gitfile is `null`: Git calls the first
    // `invalid gitfile format` and the second `no path in gitfile`.
    refused: () => {
        assertEq(at({ w: { '.git': file('notgitdir: /r\n') } })('w'), null)
        assertEq(at({ w: { '.git': file('gitdir: \n') } })('w'), null)
        assertEq(at({ w: { '.git': file('') } })('w'), null)
    },
    // Whether a path stands on its own is the host's question and this
    // reads text, so it answers the one reading that is right wherever Git
    // writes such a path. A drive with a `/` after it is a root: `C:/...` is
    // what Windows Git puts in a gitfile, and no POSIX directory is named
    // after a drive. `C:r` is not, in either case its letter is written: it
    // names a directory under drive C's current directory, which Windows
    // Git never writes, and POSIX Git reads it against the worktree. A
    // leading `\` is not either: Git writes a gitfile with `/` separators
    // on every host, so a `\` at the front is a POSIX file's name rather
    // than Windows' other root, and POSIX Git indeed reads `\bs` against
    // the worktree. Nor is a plain letter, where a drive's name would have
    // stood.
    hosts: () => {
        assertEq(at({ w: { '.git': file('gitdir: C:/r\n') }, 'C:': { r: repo } })('w'), 'C:/r')
        assertEq(at({ w: { '.git': file('gitdir: c:/r\n') }, 'c:': { r: repo } })('w'), 'c:/r')
        assertEq(at({ w: { '.git': file('gitdir: C:r\n'), 'C:r': repo } })('w'), 'w/C:r')
        assertEq(at({ w: { '.git': file('gitdir: r\n'), r: repo } })('w'), 'w/r')
        assertEq(at({ w: { '.git': file('gitdir: \\bs\n'), '\\bs': repo } })('w'), 'w/\\bs')
    },
    // A path reaches the filesystem as the bytes before its first NUL, so
    // that is where a line's path ends, in either file. `no path in
    // gitfile` is what Git says of the bytes it read, before a path is
    // taken out of them, so a line that is nothing but a NUL gets past it
    // and names the worktree.
    nul: () => {
        assertEq(at({ w: { '.git': file('gitdir: /r\0junk\n') }, r: repo })('w'), '/r')
        assertEq(at({ w: { '.git': file('gitdir: \0junk\n') } })('w'), 'w/')
        const root = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('/m/.git\0junk\n') }, m: { '.git': repo } })
        assertEq(at(root)('w'), '/m/.git')
    },
    // The bytes past the first NUL are no part of the path, so what they
    // are is nothing to refuse a good path over: the decoding sees only
    // what survives the cut. Junk that is no UTF-8 after a NUL is the case,
    // and `gitdir: /r\xff` with the `\xff` before the NUL is still refused.
    nulThenJunk: () => {
        // `gitdir: /r`, a NUL, then `\xff` — 12 bytes.
        assertEq(at({ w: { '.git': raw(96n, 0x6769746469723a202f7200ffn) }, r: repo })('w'), '/r')
        const root = /** @type {State['root']} */ ({
            w: { '.git': file('gitdir: /d\n') },
            d: { commondir: raw(72n, 0x2f6d2f2e67697400ffn) },
            m: { '.git': repo },
        })
        assertEq(at(root)('w'), '/m/.git')
    },
    // A bare drive is the one path this refuses for being a path rather
    // than for what is at it. `C:` names the current directory on drive C
    // to Windows and a directory called `C:` to POSIX, so its `.git` is
    // `C:.git` on one host and `C:/.git` on the other — two directories,
    // not two spellings, and a reader of text cannot ask which host it is
    // on. Either guess could name a repository the caller did not mean, so
    // neither is made.
    bareDrive: () => {
        assertEq(at({ 'C:.git': file('gitdir: /r\n'), r: repo })('C:'), null)
        assertEq(at(/** @type {State['root']} */ ({ 'C:': { '.git': repo } }))('C:'), null)
        assertEq(at({ 'c:.git': file('gitdir: /r\n'), r: repo })('c:'), null)
        // A drive with anything after it is an ordinary path again, and a
        // `gitdir` line of a bare drive is relative, so it is read against
        // the worktree like any other.
        assertEq(at({ 'C:x': { '.git': repo } })('C:x'), 'C:x/.git')
        assertEq(at({ w: { '.git': file('gitdir: C:\n'), 'C:': repo } })('w'), 'w/C:')
    },
    // A worktree of no characters is the caller's own directory, so its
    // `.git` is `.git` and not `/.git`: joining those with a separator
    // would read at the filesystem's root, which is a repository the
    // caller never named.
    here: () => {
        assertEq(at({ '.git': repo })(''), '.git')
        assertEq(at({ '.git': file('gitdir: r\n'), r: repo })(''), 'r')
    },
    // The line's end is a run of any length, and a file's length is
    // whatever wrote it. Git reads a gitfile padded with two hundred
    // thousand newlines; a `Vec` holds 131072 bytes, so that is as long a
    // file as the effects layer can carry, and a hundred thousand of them
    // is an order of magnitude past where a step per character gives out.
    padded: () => {
        assertEq(at({ w: { '.git': file(`gitdir: /r${'\n'.repeat(100000)}`) }, r: repo })('w'), '/r')
    },
    // A path is bytes to Git and a string to the effects layer, and the
    // round trip is exact for UTF-8 alone: a lone `0xff` would go back out
    // as `0xc3 0xbf` and name another directory. So bytes that are no UTF-8
    // name none here, in either file. `gitdir: \xff` is 9 bytes.
    bytes: () => {
        assertEq(at({ w: { '.git': raw(72n, 0x6769746469723a20ffn) } })('w'), null)
        const root = /** @type {State['root']} */ ({ w: { '.git': file('gitdir: /d\n') }, d: { commondir: raw(8n, 0xffn) } })
        assertEq(at(root)('w'), null)
    },
    // A `.git` that is neither a directory nor a regular file is no
    // gitfile and is not read. Git asks `S_ISREG` before it opens one, and
    // a FIFO is the reason: it stats as neither, and a read of one waits
    // for a writer a worktree has no reason to have, so a checkout with one
    // would hang a caller where Git refuses it at once. The virtual
    // filesystem holds files and directories and nothing else, so the stat
    // comes from a host of this proof's own, whose `readFile` fails the
    // proof if it is ever reached.
    special: () => {
        const host = /** @type {MemOperationMap<ReadFile | Stat, null>} */ ({
            stat: () => state => [state, ok({ size: 0, isFile: false, isDirectory: false })],
            readFile: () => state => [state, error(ioError({ code: 'EBADF', message: 'read of a FIFO' }))],
        })
        assertStructurallySame(run(host)(null)(tryCommonDir('w'))[1], ok(null))
    },
    // A worktree with no `.git` is the channel's, as a directory with no
    // `config` is: the caller named no repository rather than a bad one.
    // A `commondir` that cannot be read is the channel's too — only its
    // absence means the repository directory is the common one.
    missing: () => {
        const r = at({ w: {} })('w')
        assert(r instanceof Array && r[0] === 'error', r)
        // The virtual filesystem answers `ENOENT` for every read it cannot
        // make, so a host of this proof's own is what says a `commondir`
        // the reader is not allowed to open.
        const host = /** @type {MemOperationMap<ReadFile | Stat, null>} */ ({
            stat: () => state => [state, ok({ size: 12, isFile: true, isDirectory: false })],
            readFile: path => state => [state, path.endsWith('commondir')
                ? error(ioError({ code: 'EACCES', message: 'permission denied' }))
                : ok(utf8('gitdir: /d\n'))],
        })
        const [, denied] = run(host)(null)(tryCommonDir('w'))
        const [tag, e] = denied
        assert(tag === 'error', denied)
        assertStructurallySame(e, ['ioError', { code: 'EACCES', message: 'permission denied' }])
    },
}
