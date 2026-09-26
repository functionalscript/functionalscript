/**
 * Implementation-private types for `./module.f.mjs`.
 *
 * @module
 */

import type { Edge, Ranked } from './types.ts'

/**
 * An outgoing edge and its `index`, its position in the graph's list of
 * edges — what tells two listings of one `Edge` object apart.
 */
export type _Out = {
    readonly edge: Edge
    readonly index: number
}

/**
 * One cell of a node's bottom row: the edge that leaves from it, and where
 * the cell sits, `x` measured from the node's own left edge.
 */
export type _Port = _Out & {
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

/**
 * One place in a row, before it is laid out: a node, or a lane that an
 * edge skipping this rank passes down through. `key` orders a row's
 * places left to right.
 */
export type _Slot = {
    readonly node?: Ranked | undefined
    /** The `index` of the edge whose lane this is. */
    readonly lane?: number | undefined
    readonly rank: number
    readonly key: number
}

/**
 * A lane, placed: the vertical an edge runs down through one row it
 * skips, `x` its centre and `top`/`bottom` the row's own. `index` is the
 * edge's, as a port carries it, and `rank` the row's, which together name
 * the lane.
 */
export type _Lane = {
    readonly index: number
    readonly rank: number
    readonly x: number
    readonly top: number
    readonly bottom: number
}

/**
 * The whole layout: every node and lane placed, and each rank's far edge
 * along the flow — `ends[rank]` is the bottom of that rank's row, where an
 * edge from a shorter node drops to before it turns.
 */
export type _Placed = {
    readonly nodes: readonly _Positioned[]
    readonly lanes: readonly _Lane[]
    readonly ends: readonly number[]
}

/** A point of an edge's route. */
export type _Point = readonly [number, number]

/** An edge and the points it is drawn through, port first, target last. */
export type _Route = {
    readonly edge: Edge
    readonly points: readonly _Point[]
}
