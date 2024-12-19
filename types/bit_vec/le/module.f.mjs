import * as bv from '../module.f.mjs'
const { lenght, empty } = bv

/**
 * Extract an unsigned integer of the given `uintLen` from the given vector.
 *
 * @type {(uintLen: bigint) => (v: bv.Vec) => bigint}
 *
 * @example
 *
 * ```js
 * const vector = 0b1110101n;
 * const extract3Bits = uint(3n);
 * const result = extract3Bits(vector); // result is 0b101n (5n)
 * ```
 */
export const uint = uintLen => {
    const mask = (1n << uintLen) - 1n
    return data => data & mask
}

/**
 * Appends the vector `b` to the back of the vector `a`.
 *
 * @type {(a: bv.Vec) => (b: bv.Vec) => bv.Vec}
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
    const aLen = lenght(a)
    return b => a | (b << aLen)
}

/**
 * Removes the first `len` bits from the given vector.
 *
 * @type {(len: bigint) => (v: bv.Vec) => bv.Vec}
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
