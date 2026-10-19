/**
 * Type-level API for `fjs/website/playground/btree/module.f.mjs`: the state of
 * the B-tree compaction game.
 *
 * @module
 */

import type { Tree } from '../../../types/btree/types/types.ts'
import type { Versions } from '../../demo/versions/types.ts'
import type { StringSet } from '../../../types/string_set/types.ts'

/**
 * The last move: the key clicked, and whether the tree came back in another
 * shape. A key in a leaf with room goes back where it was.
 */
export type Last = {
    readonly key: number
    readonly changed: boolean
}

/**
 * A search for par, part done: the trees `distance` moves from the start not
 * yet tried, the trees found one move further, and every tree met so far,
 * by its spelling.
 */
export type Search = {
    readonly distance: number
    readonly frontier: readonly Tree<number>[]
    readonly next: readonly Tree<number>[]
    readonly seen: StringSet
}

/**
 * A level's par: the fewest moves from the start to a perfect tree, a search
 * still finding it, or `null` where there is none — a level too large to
 * search, or a start the search found no perfect tree from.
 */
export type Par = number | Search | null

/**
 * The game: the level's depth, the tree before and after the last move —
 * `null` until the first random tree is built — the moves made on it, the
 * last of them, the start's par, and why the last request did nothing, if
 * it did nothing.
 */
export type Game = {
    readonly depth: number
    readonly versions: Versions<Tree<number>> | null
    readonly moves: number
    readonly par: Par
    readonly last: Last | null
    readonly error: string | null
}
