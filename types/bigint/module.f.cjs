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
 * Calculates the bit length of a given BigInt.
 *
 * The bit length of a number is the number of bits required to represent it in binary,
 * excluding leading zeros. For example:
 * - `0n` (binary `...0`) has a bit length of 0.
 * - `1n` (binary `...0_1`) has a bit length of 1.
 * - `255n` (binary `...0_11111111`) has a bit length of 8.
 *
 * Negative inputs are converted to their absolute values before calculation. For example:
 * - `-255n` has a bit length of 8.
 * - `-1n` has a bit length of 1.
 *
 * @param {bigint} v - The input BigInt. It can be positive, negative, or zero.
 * @returns {bigint} The bit length of the input BigInt.
 *
 * @remarks
 * This function determines the bit length in two phases:
 * 1. **Fast Doubling Phase:** Quickly identifies the range of the most significant bit using exponential steps.
 * 2. **Binary Search Phase:** Refines the result to precisely count all significant bits.
 *
 * The algorithm operates with logarithmic complexity, making it efficient for very large BigInts.
 */
const bitLen = v => {
    if (v <= 0n) {
        if (v === 0n) { return 0n }
        v = -v
    }
    let result = 1n
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

const log2 = (/** @type {bigint} */v) => v <= 0n ? -1n : bitLen(v) - 1n

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
    bitLen,
}
