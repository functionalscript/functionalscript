/**
 * Implementation-private types for the walk of `refs/` in `./module.f.mjs`.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Bytes, Oid } from '../types.ts'
import type { Root } from './types.ts'

/**
 * One entry of the walk of `refs/`: where the file is, the ref name it would
 * be, and its kind.
 *
 * Both halves of the kind, because the two questions are not each other's
 * negation. A FIFO, a socket, a device and a symlink to any of them are all
 * `isFile: false` and `isDirectory: false` alike, so a walk that read
 * `!isDirectory` as "read it as a file" would open one — see `looseOf`.
 *
 * The name is carried down beside the path rather than recovered from it
 * afterwards. A path and a ref name are spelled differently — the path is the
 * host's and may hold either separator, the name is always `/` — so deriving
 * one from the other means undoing a join, and carrying both costs a field.
 */
export type _Entry = {
    readonly path: string
    readonly name: string
    readonly isFile: boolean
    readonly isDirectory: boolean
}

/**
 * Which names one walk of `refs/` owns: the leaves it keeps, and the directories
 * it descends into.
 *
 * Two rules and not one, because a directory is a *prefix* of names rather than
 * a name: `refs/bisect` is not a per-worktree name and everything inside it is,
 * so a walk that asked `keep` about the directory would list a subtree it then
 * dropped whole. See `holdsPerWorktreeOnly` in the module.
 */
export type _Scope = {
    readonly keep: (text: string) => boolean
    readonly descend: (text: string) => boolean
}

/**
 * What the walk of `refs/` has found so far: the roots, and every ref name it
 * has seen a loose file for.
 *
 * The names are kept apart from the roots because shadowing is by the file
 * existing and not by it yielding a root. A loose symbolic ref whose target is
 * nowhere gives no root, and it must still hide the packed line of the same
 * name — otherwise a name whose loose file replaced a packed one comes back
 * with the stale packed id, which is the opposite of what the loose file says.
 *
 * The `HEAD` file records its name here too, and that one does not shadow: a
 * packed line naming `HEAD` is a root Git keeps beside the file's, so the name
 * being here is what *refuses* the listing rather than what hides the line. See
 * `packedHeadCode` in the module.
 *
 * Both are lists and not arrays because the walk appends to them once per file
 * it visits. A fresh array per step copies everything found so far, so a
 * repository with many loose refs pays the square of their count in copying;
 * `concat` copies nothing, and the one place that needs an array — the listing
 * this all feeds — materialises each once at the end.
 *
 * Measured in isolation at ten and twenty thousand appends, the copying shape
 * more than decuples between the two while this one does not move. End to end
 * the gain is smaller, since reading the files dominates at that size — the
 * shape is what matters and not the present size of the constant, and the
 * figures are in the pull request that took this shape.
 */
export type _Found = {
    readonly roots: List<Root>
    readonly names: List<readonly number[]>
    readonly pending: List<_Pending>
}

/**
 * A symbolic loose ref the walk has read and not resolved: its own name, and the
 * name it points at.
 *
 * The walk does not resolve one, because resolving reads `packed-refs` and this
 * module reads that file *after* the loose ones — see `tryRoots`, where the
 * order is the answer to a `git pack-refs` running underneath. So the walk
 * records the pair and a later pass answers it.
 */
export type _Pending = {
    readonly name: readonly number[]
    readonly target: Bytes
}

/**
 * What one step of the walk answers: what has been found so far, and the
 * entries to walk next.
 *
 * Named because the branches build it from different shapes — a directory adds
 * entries and no roots, a ref adds a root and no entries — and without one name
 * for the pair each branch infers its own literal type and none of them unify.
 */
export type _Walked = readonly [Nullable<_Found>, Nullable<readonly _Entry[]>]

/**
 * What the walk down a symbolic chain carries: the id once a link has one, and
 * how many lookups the chain may still spend.
 *
 * One state and not two answers, because the walk ends by producing no further
 * item and the state is what it hands back. `left` at nought is both how the
 * bound is spent and how a link that has answered says there is nothing more to
 * walk — a chain that ran out of lookups and one that found its id both stop,
 * and the `id` is what tells them apart.
 */
export type _Lookup = {
    readonly id: Nullable<Oid>
    readonly left: number
}
