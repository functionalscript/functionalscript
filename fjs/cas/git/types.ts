/**
 * Type-level API of CAS content in a Git branch: where a branch lives, what
 * a published snapshot of it offers, and the effects reading one performs.
 *
 * @module
 */

import type { Effect, IoChannel, Operation } from '../../effects/types.ts'
import type { CreateExclusive, Exec, Mkdir, Now, RandomInt, ReadBytes, ReadFile, ReadWhole, Readdir, Rename, Rm, Rmdir, Stat, WriteExclusive } from '../../effects/node/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Oid } from '../../git/types.ts'
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
 * Who a proposal's commits are by: the `author` and `committer` of each, as
 * text. Configuration rather than the repository's `config` or the `GIT_*`
 * environment, so that what a commit says is what the caller said
 * ([DESIGN.md §7](../../../doc/DESIGN.md#7-cli-parameters-over-environment-variables));
 * the time is the `now` effect's and the zone is `+0000`.
 */
export type Author = {
    readonly name: string
    readonly email: string
}

/**
 * The effects reading a snapshot performs: the repository's `config` and
 * refs through `ReadFile`, `ReadWhole`, `Readdir` and `Stat`, and its
 * objects — loose files and packs — through those and `ReadBytes`.
 */
export type SnapshotOperation = ReadFile | ReadWhole | ReadBytes | Readdir | Stat

/**
 * The effects a proposal performs: a snapshot's reads, and for a write the
 * loose object files (`Mkdir`, `WriteExclusive`, `Rename`, `Rm`, their
 * temporary names from `RandomInt`), the commit's time (`Now`) and the
 * proposal ref through the ref store's writer, whose delete takes
 * `CreateExclusive` for its locks and `Rmdir` for the directories it empties.
 */
export type ProposalOperation = SnapshotOperation | Mkdir | WriteExclusive | Rename | Rm | Rmdir | CreateExclusive | RandomInt | Now

/**
 * A branch as a writer sees it: a whole `Cas<O>`, and the two ways to take
 * content out of it that cleanup needs — `remove` a key, `true` where the
 * proposal held it, and `clear` the whole map, `true` where it held
 * anything. Each is one ordinary deletion commit on the proposal, which
 * publication carries to the remote as it carries an addition: an entry
 * taken out of the proposal is gone from the published snapshot once the
 * proposal is published, and its bytes stay in Git history until Git's own
 * maintenance reclaims them, which is a separate concern.
 */
export type Proposal<O extends Operation> = Cas<O> & {
    readonly remove: (key: Vec) => Effect<O, boolean, IoChannel>
    readonly clear: () => Effect<O, boolean, IoChannel>
}

/**
 * What publication needs of the remote: the three operations that leave the
 * repository — and the merge base, which `git` answers in an instant and a
 * walk over the objects would answer in time proportional to the history.
 * [`gitRemote`](./module.f.mjs) is the one over the `git` command line, and
 * a proof's is over the virtual filesystem, so the publication loop is
 * proved against every history it needs without a network or a `git`.
 *
 * - `fetch` brings the remote branch's commit and objects into the
 *   repository and answers the commit, or `null` where the remote has no
 *   such branch; afterwards the snapshot ref names that commit, or is gone.
 * - `push` offers `commit` for the remote branch: `true` where the branch
 *   now names it, `false` where the remote refused it because the branch
 *   moved since it was fetched — the ordinary rejection a writer retries
 *   after reconciling, never a force.
 * - `mergeBase` is the merge base of two commits the repository holds, or
 *   `null` where they share no ancestor: two roots, which reconcile over the
 *   empty map.
 */
export type Remote<O extends Operation> = {
    readonly fetch: () => Effect<O, Nullable<Oid>, IoChannel>
    readonly push: (commit: Oid) => Effect<O, boolean, IoChannel>
    readonly mergeBase: (a: Oid, b: Oid) => Effect<O, Nullable<Oid>, IoChannel>
}

/**
 * The effects [`gitRemote`](./module.f.mjs) performs: `git` through `Exec`,
 * and the snapshot ref read and, where the remote has no branch, deleted
 * through the ref store.
 */
export type GitRemoteOperation = Exec | SnapshotOperation | Mkdir | CreateExclusive | WriteExclusive | Rename | Rm | Rmdir
