/**
 * Implementation-private types for `./module.f.mjs`.
 *
 * @module
 */

import type { Edge, Ranked } from './types.ts'

/**
 * One cell of a node's bottom row: the edge that leaves from it, and where
 * the cell sits, `x` measured from the node's own left edge.
 */
export type _Port = {
    readonly edge: Edge
    readonly x: number
    readonly width: number
}

/** A {@link Ranked} node, placed — its own box, and a port per outgoing edge. */
export type _Positioned = Ranked & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly ports: readonly _Port[]
}
