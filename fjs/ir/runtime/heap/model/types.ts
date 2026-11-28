/**
 * What the model of the IR heap's bump arena ([module.f.js](./module.f.js))
 * keeps, in release and in debug, which its proof and the arena's host
 * proof read too.
 *
 * @module
 */

import type { OrderedMap } from '../../../../types/ordered_map/types.ts'

/**
 * What the arena keeps: the memory's size in pages and the most that the
 * host lets it grow to, where its state words are, the pointer, and the end
 * of the region that the pointer is in.
 */
export type Arena = {
    readonly pages: number
    readonly most: number
    readonly state: number
    readonly top: number
    readonly end: number
}

/**
 * A block of the debug arena: the size that `alloc` was asked for, its
 * type, its count, and whether a `free` took it.
 */
export type Block = {
    readonly n: number
    readonly t: number
    readonly count: number
    readonly freed: boolean
}

/**
 * What the debug arena keeps: the arena, how many blocks have a count above
 * 0, and each block by its address, in decimal.
 */
export type Counted = {
    readonly arena: Arena
    readonly live: number
    readonly blocks: OrderedMap<Block>
}
