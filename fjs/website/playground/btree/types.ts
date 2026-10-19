/**
 * Type-level API for `fjs/website/playground/btree/module.f.mjs`: the state of
 * the B-tree compaction game.
 *
 * @module
 */

import type { Tree } from '../../../types/btree/types/types.ts'
import type { Versions } from '../../demo/versions/types.ts'

/**
 * The last move: the key clicked, and whether the tree came back in another
 * shape. A key in a leaf with room goes back where it was.
 */
export type Last = {
    readonly key: number
    readonly changed: boolean
}

/**
 * The game: the level's depth, the tree before and after the last move —
 * `null` until the first random tree is built — the moves made on it, the
 * last of them, and why the last request did nothing, if it did nothing.
 */
export type Game = {
    readonly depth: number
    readonly versions: Versions<Tree<number>> | null
    readonly moves: number
    readonly last: Last | null
    readonly error: string | null
}
