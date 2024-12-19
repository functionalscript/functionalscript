// @ts-self-types="./module.f.d.mts"
import { log2 } from '../bigint/module.f.mjs'

/**
 * A vector of bits represented as a `bigint`.
 *
 * @typedef {bigint} Vec
 */

/**
 * An empty vector of bits.
 */
export const empty = 1n

/**
 * Calculates the length of the given vector of bits.
 */
export const lenght = log2

/**
 * Creates a vector of bits of the given `vecLen` from the given unsigned integer.
 *
 * @type {(vecLen: bigint) => (ui: bigint) => Vec}
 *
 * @example
 *
 * ```js
 * const vec4 = vec(4n);
 * const vector = vec4(5n); // vector is 0b10101n
 * ```
 */
export const vec = vecLen => {
    const stop = 1n << vecLen
    const mask = stop - 1n
    return data => (data & mask) | stop
}
