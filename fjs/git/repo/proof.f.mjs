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
import { error, ok } from '../../types/result/module.f.mjs'
import { tryCommonDir } from './module.f.mjs'

/** A file of one line of text, as the virtual filesystem holds one. */
const file = /** @type {(text: string) => readonly [import('../../types/bit_vec/types.ts').Vec]} */ (
    text => [utf8(text)])

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
        assertEq(at(root)('w'), '/m/.git')
    },
    // A `gitdir:` line is read against the directory the file sits in where
    // it names a relative path, as Git reads one.
    relative: () => {
        const root = { w: { '.git': file('gitdir: ../r\n') }, r: repo }
        assertEq(at(root)('w'), 'r')
    },
    // A `commondir` line is read against the repository directory, and an
    // absolute one replaces it.
    common: () => {
        const abs = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('/m/.git\n') }, m: { '.git': repo } }
        assertEq(at(abs)('w'), '/m/.git')
        // A line naming nothing is the repository directory, which is the
        // path Git builds from it.
        const none = { w: { '.git': file('gitdir: /d\n') }, d: { commondir: file('\n') } }
        assertEq(at(none)('w'), '/d')
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
    // A worktree with no `.git` is the channel's, as a directory with no
    // `config` is: the caller named no repository rather than a bad one.
    // A `commondir` that cannot be read is the channel's too — only its
    // absence means the repository directory is the common one.
    missing: () => {
        const r = at({ w: {} })('w')
        assert(Array.isArray(r) && r[0] === 'error', r)
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
