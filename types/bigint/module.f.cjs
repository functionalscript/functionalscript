const compare = require('../function/compare/module.f.cjs')
const op = require('../function/operator/module.f.cjs')
const { unsafeCmp } = compare
const { reduce } = require('../list/module.f.cjs')

/** @typedef {op.Unary<bigint, bigint>} Unary*/

/** @type {(a: bigint) => (b: bigint) => bigint} */
const addition = a => b => a + b

const sum = reduce(addition)(0n)

/** @type {(a: bigint) => bigint} */
const abs = a => a >= 0 ? a : -a

/** @type {(a: bigint) => compare.Sign} */
const sign = a => unsafeCmp(a)(0n)

/** @type {(a: bigint) => string} */
const serialize = a => `${a}n`

/**
 * @template T
 * @typedef {{
 *  readonly 0: T
 *  readonly add: op.Reduce<T>
 * }} Additive
 */

/** @type {<T>(a: Additive<T>) => (a: T) => (n: bigint) => T} */
const scalar_mul = ({ 0: _0, add }) => a => n => {
    let ai = a
    let ni = n
    let result = _0
    while (true) {
        if ((ni & 1n) === 1n) {
            result = add(result)(ai)
        }
        ni >>= 1n
        if (ni === 0n) {
            return result
        }
        ai = add(ai)(ai)
    }
}

/**
 * Calculates the base-2 logarithm (floor).
 *
 * This function returns the integer part of the logarithm. For example:
 * - `log2(1n)` returns `0n`,
 * - `log2(2n)` returns `1n`,
 * - `log2(15n)` returns `3n`.
 *
 * @param {bigint} v - The input BigInt.
 * @returns {bigint} The base-2 logarithm (floor) of the input BigInt, or `-1n` if the input is less than or equal to 0.
 *
 * @remarks
 * The function operates in two phases:
 * 1. **Fast Doubling Phase:** Uses exponential steps to quickly narrow down the range
 *    of the most significant bit.
 * 2. **Binary Search Phase:** Refines the result by halving the step size and incrementally
 *    determining the exact value of the logarithm.
 */
const log2 = v => {
    if (v <= 0n) { return -1n }
    let result = 0n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1 before we divide it by 2.
    while (i !== 1n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result
}

/**
 * Calculates the bit length of a given BigInt.
 *
 * The bit length of a number is the number of bits required to represent its absolute value in binary,
 * excluding leading zeros. For example:
 * - `0n` has a bit length of 0 (it has no bits).
 * - `1n` (binary `1`) has a bit length of 1.
 * - `255n` (binary `11111111`) has a bit length of 8.
 * - `-255n` (absolute value `255`, binary `11111111`) also has a bit length of 8.
 *
 * The function handles both positive and negative numbers. For negative inputs, the bit length is calculated
 * based on the absolute value of the number. Zero has a bit length of 0.
 *
 * @param {bigint} v - The input BigInt.
 * @returns {bigint} The bit length of the input BigInt.
 *
 * @remark
 * The function uses the `log2` function to calculate the position of the most significant bit(MSB)
 * and adds `1n` to account for the MSB itself.For negative numbers, the absolute value is used.
 */
const bitLength = v => {
    if (v <= 0n) {
        if (v === 0n) { return 0n }
        v = -v
    }
    return log2(v) + 1n
}

module.exports = {
    /** @readonly */
    addition,
    /** @readonly */
    sum,
    /** @readonly */
    abs,
    /** @readonly */
    sign,
    /** @readonly */
    serialize,
    /** @readonly */
    scalar_mul,
    /** @readonly */
    log2,
    /** @readonly */
    bitLength,
}
