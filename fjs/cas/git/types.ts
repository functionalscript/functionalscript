/**
 * Type-level API of CAS content in a Git branch: where a branch lives, what
 * a published snapshot of it offers, and the effects reading one performs.
 *
 * @module
 */

import type { Operation } from '../../effects/types.ts'
import type { ReadBytes, ReadFile, ReadWhole, Readdir, Stat } from '../../effects/node/types.ts'
import type { Cas } from '../types.ts'

/**
 * Where a branch CAS lives: the repository that holds its objects and refs,
 * the remote the branch is published through, and the branch's name on that
 * remote — `build-cache` for `refs/heads/build-cache` there.
 *
 * `dir` is the repository directory, the one that holds `objects/`,
 * `refs/` and `config`: what [`fjs/git/repo`](../../git/repo/module.f.mjs)'s
 * `tryCommonDir` answers for a worktree, and a bare repository itself. The
 * worktree a caller may be standing in is deliberately not part of this: the
 * backend reads and writes refs of its own and never the checkout's `HEAD`,
 * index or files.
 */
export type Branch = {
    readonly dir: string
    readonly remote: string
    readonly branch: string
}

/**
 * The read half of `Cas<O>`: what a published snapshot offers. A snapshot
 * is a commit, and a commit does not change, so there is no `write` to
 * offer; a consumer that only reads — a cache lookup — asks for this and
 * takes a whole `Cas<O>` just as well.
 */
export type CasReader<O extends Operation> = Pick<Cas<O>, 'read' | 'list'>

/**
 * The effects reading a snapshot performs: the repository's `config` and
 * refs through `ReadFile`, `ReadWhole`, `Readdir` and `Stat`, and its
 * objects — loose files and packs — through those and `ReadBytes`.
 */
export type SnapshotOperation = ReadFile | ReadWhole | ReadBytes | Readdir | Stat
