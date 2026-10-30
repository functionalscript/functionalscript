/**
 * The implementation-private type of the monoid's demo (`demo.f.mjs`): no
 * shipped declaration reaches it, so it stays out of `types.ts`.
 *
 * @module
 */

/**
 * A span of the demo's input: the sum of the values it covers and how many
 * it covers. Spans add, and a span weighs the magnitude of its sum.
 */
export type _Span = {
    readonly sum: number
    readonly count: number
}
