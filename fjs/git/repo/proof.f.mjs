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
const repo = { config: file('[core]\n\trepositoryformatversion = 0\n'), objects: {} }

/**
 * The answer, or `null` where the walk refused, over a virtual filesystem.
 *
 * @type {(root: State['root']) => (worktree: string) => unknown}
 */
const at = root => worktree => {
    const [, r] = virtual({ ...emptyState, root })(tryCommonDir(worktree))
    return r[0] === 'error' ? r : r[1]
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
        const root = { w: { '.git': file('gitdir: /r\n') }, r: repo }
        assertEq(at(root)('w'), '/r')
    },
    // `git worktree add`: `.git` names the worktree's own directory under
    // the main repository's `worktrees/`, whose `commondir` names the
    // repository that owns `objects/`. The worktree's directory holds no
    // objects and is passed through.
    linked: () => {
        const root = {
            m: { '.git': { ...repo, worktrees: { l: { commondir: file('../..\n'), HEAD: file('ref: refs/heads/x\n') } } } },
            w: { '.git': file('gitdir: /m/.git/worktrees/l\n') },
        }
        assertEq(at(root)('w'), '/m/.git/worktrees/l/../..')
    },
    // A `gitdir:` line is read against the directory the file sits in where
    // it names a relative path, as Git reads one — joined and not folded,
    // so the `..` is the filesystem's to resolve. A `..` folded here would
    // climb out of a symbolic link's own parent where the filesystem climbs
    // out of what the link points at, and name a directory that need not
    // exist.
    relative: () => {
        const root = { w: { '.git': file('gitdir: ../r\n') }, r: repo }
        assertEq(at(root)('w'), 'w/../r')
    },
    // A `commondir` line is read against the repository directory, and an
    // absolute one replaces it.
    common: () => {
        const abs = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('/m/.git\n') }, m: { '.git': repo } }
        assertEq(at(abs)('w'), '/m/.git')
        // A line naming nothing is the repository directory, which is the
        // path Git builds from it; a file of no bytes at all is `null`,
        // since Git dies where the read gives it nothing.
        const none = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('\n') } }
        assertEq(at(none)('w'), '/d')
        const empty = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('') } }
        assertEq(at(empty)('w'), null)
        // A relative line is joined to the repository directory, unfolded.
        const rel = { w: { '.git': file('gitdir: /m/.git/worktrees/l\n') }, m: { '.git': { ...repo, worktrees: { l: { commondir: file('../..\n') } } } } }
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
    // writes such a path. A drive is a root: it is what Windows Git puts in
    // a gitfile, and no POSIX directory is named after one. A leading `\`
    // is not: Git writes a gitfile with `/` separators on every host, so a
    // `\` at the front is a POSIX file's name rather than Windows' other
    // root, and POSIX Git indeed reads `\bs` against the worktree.
    hosts: () => {
        assertEq(at({ w: { '.git': file('gitdir: C:/r\n') }, 'C:': { r: repo } })('w'), 'C:/r')
        assertEq(at({ w: { '.git': file('gitdir: C:r\n') }, 'C:r': repo })('w'), 'C:r')
        assertEq(at({ w: { '.git': file('gitdir: \\bs\n'), '\\bs': repo } })('w'), 'w/\\bs')
    },
    // A path is bytes to Git and a string to the effects layer, and the
    // round trip is exact for UTF-8 alone: a lone `0xff` would go back out
    // as `0xc3 0xbf` and name another directory. So bytes that are no UTF-8
    // name none here, in either file. `gitdir: \xff` is 9 bytes.
    bytes: () => {
        assertEq(at({ w: { '.git': raw(72n, 0x6769746469723a20ffn) } })('w'), null)
        const root = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: raw(8n, 0xffn) } }
        assertEq(at(root)('w'), null)
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
        const denied = run(host)(null)(tryCommonDir('w'))[1]
        assert(denied[0] === 'error')
        assertStructurallySame(denied[1], ['ioError', { code: 'EACCES', message: 'permission denied' }])
    },
}
