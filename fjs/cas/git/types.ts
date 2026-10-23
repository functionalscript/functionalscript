/**
 * Type-level API of CAS content in a Git branch: where a branch lives, what
 * a snapshot of it offers, who writes to it, and the effects reading and
 * writing one perform.
 *
 * @module
 */

import type { Operation } from '../../effects/types.ts'
import type { Mkdir, Now, RandomInt, ReadBytes, ReadFile, ReadWhole, Readdir, Rename, Rm, Stat, WriteExclusive } from '../../effects/node/types.ts'
import type { Cas } from '../types.ts'

/**
 * Where a branch CAS lives: the repository that holds its objects and refs,
 * and the branch's name — `build-cache` for `refs/heads/build-cache`.
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
    readonly branch: string
}

/**
 * The read half of `Cas<O>`: what a snapshot offers. A snapshot
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

/**
 * Who a branch's commits are by: the `author` and `committer` of each, as
 * text. Configuration rather than the `GIT_*` environment, so that what a
 * commit says is what the caller said
 * ([DESIGN.md §7](../../../doc/DESIGN.md#7-cli-parameters-over-environment-variables));
 * the time is the `now` effect's and the zone is `+0000`.
 */
export type Author = {
    readonly name: string
    readonly email: string
}

/**
 * The effects a write performs: a snapshot's reads, and for the write
 * itself the loose object files (`Mkdir`, `WriteExclusive`, `Rename`, `Rm`,
 * their temporary names from `RandomInt`), the commit's time (`Now`) and
 * the branch ref through the ref store's writer.
 */
export type WriteOperation = SnapshotOperation | Mkdir | WriteExclusive | Rename | Rm | RandomInt | Now
