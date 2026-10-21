/**
 * Types of the explicit-stack walk: what a visit of a node or a resumed frame
 * asks the driver to do next.
 *
 * @module
 */

import type { Result } from '../result/types.ts'

/**
 * What to do next: suspend `frame` and visit `node` inside it, hand a value
 * to the frame on top, or end the walk with an error.
 */
export type Step<N, F, V, E> = readonly ['push', F, N] | Result<V, E>

/** The frames suspended around the node being visited, innermost on top. */
export type Stack<F> = { readonly top: F, readonly rest: Stack<F> } | null

/**
 * A walk without an accumulator: `enter` visits a node, and `resume` takes a
 * suspended frame back with the value its pushed node came to.
 */
export type Walk<N, F, V, E> = {
    readonly enter: (node: N) => Step<N, F, V, E>
    readonly resume: (frame: F, value: V) => Step<N, F, V, E>
}

/** A walk that threads an accumulator `A` through every visit. */
export type WalkFold<A, N, F, V, E> = {
    readonly enter: (acc: A, node: N) => readonly [A, Step<N, F, V, E>]
    readonly resume: (acc: A, frame: F, value: V) => readonly [A, Step<N, F, V, E>]
}
