/**
 * The types of the monoid's demo (`demo.f.mjs`), private to it.
 *
 * @module
 */

/**
 * A span of the demo's input: the sum of the values it covers and how many
 * it covers. Spans add, and a span weighs its sum.
 */
export type Span = {
    readonly sum: number
    readonly count: number
}

/** The demo's state: which sequence is drawn, and the seed of the shuffle. */
export type State = {
    readonly sequence: string
    readonly seed: number
}
