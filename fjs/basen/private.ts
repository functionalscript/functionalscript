/**
 * Implementation-private types for the base-N demo.
 *
 * @module
 */

/**
 * How an encoding cuts bits into groups: the group width, how many groups a
 * number of bits makes, and the fill bits that complete a short last group.
 */
export type _Scheme = {
    readonly width: number
    readonly count: (n: number) => number
    readonly fill: (k: number) => string
}
