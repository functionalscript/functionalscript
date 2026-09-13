/**
 * Implementation-private types for the walk of `refs/` in `./module.f.mjs`.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Root } from './types.ts'

/**
 * One entry of the walk of `refs/`: where the file is, the ref name it would
 * be, and whether to descend into it.
 *
 * The name is carried down beside the path rather than recovered from it
 * afterwards. A path and a ref name are spelled differently — the path is the
 * host's and may hold either separator, the name is always `/` — so deriving
 * one from the other means undoing a join, and carrying both costs a field.
 */
export type _Entry = {
    readonly path: string
    readonly name: string
    readonly isDirectory: boolean
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
 * Both are lists and not arrays because the walk appends to them once per file
 * it visits. A fresh array per step copies everything found so far, so a
 * repository with many loose refs pays the square of their count in copying;
 * `concat` copies nothing, and the one place that needs an array — the listing
 * this all feeds — materialises each once at the end.
 *
 * Measured in isolation, 10,000 appends cost 111 ms as array copies and 13 ms as
 * `concat` plus one `toArray`, and 20,000 cost 1194 ms and 13 ms — the first
 * more than decuples while the second does not move. End to end the gain is
 * smaller, since reading the files dominates at that size: a walk of 10,000
 * loose refs went from 1608 ms to 1293 ms. The shape is what matters, not the
 * present size of the constant.
 */
export type _Found = {
    readonly roots: List<Root>
    readonly names: List<readonly number[]>
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
