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
 * One row of a node's ports: the edge that leaves from it, and where the
 * row sits, `y` measured from the node's own top edge.
 */
export type _Port = _Out & {
    readonly y: number
}

/**
 * A {@link Ranked} node, placed — its own box, and a port per outgoing
 * edge. `keyWidth` is the width of the key column its inline ports share,
 * the rest of the node being their values'; with no inline port, it is
 * the node's whole width.
 */
export type _Positioned = Ranked & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly keyWidth: number
    readonly ports: readonly _Port[]
}

/**
 * One place in a column, before it is laid out: a node, or a lane that an
 * edge skipping this rank passes across. `key` orders a column's places
 * top to bottom.
 */
export type _Slot = {
    readonly node?: Ranked | undefined
    /** The `index` of the edge whose lane this is. */
    readonly lane?: number | undefined
    readonly rank: number
    readonly key: number
}

/**
 * A lane, placed: the horizontal an edge runs across one column it skips,
 * `y` its centre and `left`/`right` the column's own. `index` is the
 * edge's, as a port carries it, and `rank` the column's, which together
 * name the lane.
 */
export type _Lane = {
    readonly index: number
    readonly rank: number
    readonly y: number
    readonly left: number
    readonly right: number
}

/** A point of an edge's route. */
export type _Point = readonly [number, number]

/** An edge and the points it is drawn through, port first, target last. */
export type _Route = {
    readonly edge: Edge
    readonly points: readonly _Point[]
}
