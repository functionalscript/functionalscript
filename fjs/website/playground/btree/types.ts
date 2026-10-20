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
 * What a frame does with the nodes the next tree does not share: `leave`
 * fades them out, and `enter` slides the nodes that stay and fades in the
 * nodes the tree before did not have. A tree just built is `still`: drawn
 * as it is, with nothing moving from the tree it replaced.
 */
export type Mode = 'still' | 'leave' | 'enter'

/**
 * One frame of a move: the tree drawn and the tree it is drawn against,
 * whether its nodes leave or enter, and what the board says meanwhile —
 * `null` for a move's last frame, where the board says where the game
 * stands.
 *
 * `base` is the tree the move started from, in its last frame only: every
 * node the move built, against it, is drawn blue. A frame without one
 * draws no node blue, so a move's nodes turn blue once the key is back.
 */
export type Frame = {
    readonly versions: Versions<Tree<number>>
    readonly mode: Mode
    readonly note: string | null
    readonly base: Tree<number> | null
}

/**
 * The game: the level's depth, the frame on the board — its `versions`
 * `null` until the first random tree is built — the frames of a move still
 * to come, the moves made, the last of them, the start's par, and why the
 * last request did nothing, if it did nothing.
 *
 * A move is four frames: the nodes the remove replaces leave, its new ones
 * enter, the nodes the insert replaces leave, and its new ones enter.
 */
export type Game = {
    readonly depth: number
    readonly versions: Versions<Tree<number>> | null
    readonly mode: Mode
    readonly note: string | null
    readonly base: Tree<number> | null
    readonly pending: readonly Frame[]
    readonly moves: number
    readonly par: Par
    readonly last: Last | null
    readonly error: string | null
}
