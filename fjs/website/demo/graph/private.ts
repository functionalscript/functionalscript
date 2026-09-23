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

/**
 * One place in a row, before it is laid out: a node, or a lane that an
 * edge skipping this rank passes down through. `key` orders a row's
 * places left to right.
 */
export type _Slot = {
    readonly node?: Ranked | undefined
    readonly lane?: Edge | undefined
    readonly rank: number
    readonly key: number
}

/**
 * A lane, placed: the vertical an edge runs down through one row it
 * skips, `x` its centre and `top`/`bottom` the row's own.
 */
export type _Lane = {
    readonly edge: Edge
    readonly x: number
    readonly top: number
    readonly bottom: number
}

/** A point of an edge's route. */
export type _Point = readonly [number, number]

/** An edge and the points it is drawn through, port first, target last. */
export type _Route = {
    readonly edge: Edge
    readonly points: readonly _Point[]
}
