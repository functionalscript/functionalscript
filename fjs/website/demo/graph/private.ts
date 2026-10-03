/**
 * Implementation-private types for `./module.f.mjs`.
 *
 * @module
 */

import type { Edge, Node, Ranked } from './types.ts'

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
 * An edge that leaves from a corner, or the middle, of its node's right
 * side rather than from a row: `y`, measured from the node's top edge, is
 * the point itself.
 */
export type _Exit = _Out & {
    readonly y: number
}

/**
 * A {@link Ranked} node, placed — its own box, and a port per outgoing
 * edge. `keyWidth` is the width of the key column its inline ports share,
 * the rest of the node being their values'. It is read for inline ports
 * alone — an edge's key fills its row — so a node without one has `0`.
 */
export type _Positioned = Ranked & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly keyWidth: number
    readonly entry: number
    readonly ports: readonly _Port[]
    readonly exits: readonly _Exit[]
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
 * A node's size and its ports, as `portsOf` lays them out under its label.
 * `entry` is where an edge into the node arrives, measured from its top:
 * the middle of its label's row, or of the whole node when it has no
 * label row.
 */
export type _Size = {
    readonly width: number
    readonly height: number
    readonly keyWidth: number
    readonly entry: number
    readonly ports: readonly _Port[]
    readonly exits: readonly _Exit[]
}

/** A {@link _Slot} with its node's {@link _Size}, or `null` for a lane. */
export type _Sized = {
    readonly slot: _Slot
    readonly size: _Size | null
}

/** A {@link _Slot}, placed: a node or a lane. */
export type _PlacedSlot = {
    readonly node?: _Positioned
    readonly lane?: _Lane
}

/** A column, placed: its slots, and the right of its widest one. */
export type _Column = {
    readonly end: number
    readonly slots: readonly _PlacedSlot[]
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

/**
 * The whole layout: every node and lane placed, and each rank's far edge
 * along the flow — `ends[rank]` is the right of that rank's column, where
 * an edge from a narrower node runs to before it turns.
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

/**
 * `graphOf`'s walk so far: every value drawn as a node and the id it was
 * given, the {@link Node}s and {@link Edge}s built from them, and the next
 * id to hand out.
 */
export type _Walk = {
    readonly refs: readonly (readonly [unknown, number])[]
    readonly nodes: readonly Node[]
    readonly edges: readonly Edge[]
    readonly next: number
}
