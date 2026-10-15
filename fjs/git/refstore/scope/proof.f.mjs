/**
 * The scope policy on its own, with no filesystem: which directory owns a
 * name, and which of the two walks of `refs/` keeps it or descends into it.
 * The names are the rows `isPseudoref`'s table measured against Git 2.43.0;
 * that the store reads and lists them from those directories is
 * [`../proof.f.mjs`](../proof.f.mjs)'s.
 *
 * @import { Dirs } from '../types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { dirOf, sharedScope, worktreeScope } from './module.f.js'

/** @type {Dirs} */
const dirs = { gitdir: 'wt', common: 'repo' }

/** Spelled like a pseudoref, or under a per-worktree prefix: the worktree's. */
const perWorktree = /** @type {const} */ ([
    'HEAD', 'ORIG_HEAD', 'BISECT_EXPECTED_REV', 'MERGE_AUTOSTASH',
    'FOO_BAR', 'FOO-BAR', '_FOO', 'FOO_', 'F',
    'refs/bisect/good', 'refs/worktree/x', 'refs/rewritten/x',
])

/** A digit or a lower-case letter, no name at all, or a prefix without its slash: the shared directory's. */
const shared = /** @type {const} */ ([
    'FOO1', 'Foo', 'lowercase', '',
    'refs/heads/master', 'refs/bisectx/y', 'refs/bisect',
])

export const proof = {
    // One directory and not both: a name is read from where it belongs.
    dirOf: () => {
        for (const n of perWorktree) { assertEq(dirOf(dirs, n), 'wt', n) }
        for (const n of shared) { assertEq(dirOf(dirs, n), 'repo', n) }
    },
    // The two walks keep complementary leaves, so a name is listed once.
    keep: () => {
        for (const n of perWorktree) {
            assertEq(worktreeScope.keep(n), true, n)
            assertEq(sharedScope.keep(n), false, n)
        }
        for (const n of shared) {
            assertEq(worktreeScope.keep(n), false, n)
            assertEq(sharedScope.keep(n), true, n)
        }
    },
    // A directory is a prefix of names: `refs/bisect` is no per-worktree name,
    // and still every name under it is one, so the shared walk stays out of it
    // and the worktree's goes in. `refs` holds both kinds, and `refs/heads`
    // holds no per-worktree name, so the worktree's walk stays out of that one.
    descend: () => {
        /** @type {readonly (readonly [string, boolean, boolean])[]} */
        const rows = [
            // directory, shared descends, worktree descends
            ['refs', true, true],
            ['refs/heads', true, false],
            ['refs/heads/topic', true, false],
            ['refs/bisect', false, true],
            ['refs/bisect/x', false, true],
            ['refs/worktree', false, true],
            ['refs/rewritten', false, true],
            ['refs/bisectx', true, false],
        ]
        for (const [d, s, w] of rows) {
            assertEq(sharedScope.descend(d), s, d)
            assertEq(worktreeScope.descend(d), w, d)
        }
    },
}
