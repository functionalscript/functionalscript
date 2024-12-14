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
export const len = log2

/**
 * Extract an unsigned integer of the given `uintLen` from the given vector.
 *
 * @type {(uintLen: bigint) => (v: Vec) => bigint}
 *
 * @example
 *
 * ```js
 * const vector = 0b110101n;
 * const extract3Bits = uint(3n);
 * const result = extract3Bits(vector); // result is 0b101n (5n)
 * ```
 */
export const uint = uintLen => {
    const mask = (1n << uintLen) - 1n
    return data => data & mask
}

/**
 * Creates a vector of bits of the given `vecLen` from the given unsigned integer.
 *
 * @type {(vecLen: bigint) => (ui: bigint) => Vec}
 *
 * @example
 *
 * ```js
 * const createVector = vec(4n);
 * const vector = createVector(5n); // vector is 0b10101n
 * ```
 */
export const vec = vecLen => {
    const stop = 1n << vecLen
    const mask = stop - 1n
    return data => (data & mask) | stop
}

/**
 * Appends the vector `b` to the back of the vector `a`.
 *
 * @type {(a: Vec) => (b: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const vec8 = vec(8n)
 * const a = vec8(0x345n)
 * const b = vec8(0x789n)
 * const ab = appendBack(a)(b) // 0x18945n
 * ```
 */
export const appendBack = a => {
    const aLen = len(a)
    return b => a | (b << aLen)
}

/**
 * Removes the first `len` bits from the given vector.
 *
 * @type {(len: bigint) => (v: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const v = vec(17n)(0x12345n) // v = 0x32345n
 * const r = removeFront(9n)(v) // r = 0x191n
 * ```
 */
export const removeFront = len => v => {
    const r = v >> len
    return r === 0n ? empty : r
}
