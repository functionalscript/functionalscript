/**
 * Utility functions for working with `bigint` values.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { sum, abs, log2, bitLength, mask } from './module.f.ts'
 *
 * const total = sum([1n, 2n, 3n]) // 6n
 * const absoluteValue = abs(-42n) // 42n
 * const logValue = log2(8n) // 3n
 * const bitCount = bitLength(255n) // 8n
 * const bitmask = mask(5n) // 31n
 * const m = min(3n)(13n) // 3n
 * const c = combination([3n, 2n, 1n]) // 60n
 * ```
 */

import { cmp, type Sign } from '../function/compare/module.f.ts'
import type { Unary as OpUnary, Reduce as OpReduce } from '../function/operator/module.f.ts'
import { reduce, type List } from '../list/module.f.ts'

/**
 * Type representing a unary operation on `bigint`.
 */
export type Unary = OpUnary<bigint, bigint>

/**
 * Type representing a reduction operation on `bigint` values.
 */
export type Reduce = OpReduce<bigint>

/**
 * Adds two `bigint` values.
 *
 * @param a - The first bigint value.
 * @returns A function that takes the second bigint value and returns the sum.
 */
export const addition: Reduce = a => b => a + b

/**
 * Calculates the sum of a list of `bigint` values.
 *
 * @param input - A list of bigint values.
 * @returns The sum of all values in the list.
 */
export const sum: (input: List<bigint>) => bigint
    = reduce(addition)(0n)

/**
 * Multiplies two `bigint` values.
 *
 * @param a - The first bigint value.
 * @returns A function that takes the second bigint value and returns the product.
 */
export const multiple: Reduce = a => b => a * b

/**
 * Calculates the product of a list of `bigint` values.
 *
 * @param input - A list of bigint values.
 * @returns The product of all values in the list.
 */
export const product: (input: List<bigint>) => bigint
    = reduce(multiple)(1n)

/**
 * Calculates the absolute value of a `bigint`.
 *
 * @param a - The bigint value.
 * @returns The absolute value of the input bigint.
 */
export const abs: Unary
    = a => a >= 0 ? a : -a

/**
 * Determines the sign of a `bigint`.
 * @param a - The bigint value.
 * @returns `1` if positive, `-1` if negative, and `0` if zero.
 */
export const sign = (a: bigint): Sign => cmp(a)(0n)

/**
 * Serializes a `bigint` to a string representation.
 *
 * @param a - The bigint value.
 * @returns A string representation of the bigint (e.g., '123n').
 */
export const serialize = (a: bigint): string => `${a}n`

const { isFinite } = Number

const { log2: mathLog2 } = Math

/**
 * Calculates the base-2 logarithm (floor).
 *
 * This function returns the integer part of the logarithm. For example:
 * - `log2(1n)` returns `0n`,
 * - `log2(2n)` returns `1n`,
 * - `log2(15n)` returns `3n`.
 *
 * @param v - The input BigInt.
 * @returns The base-2 logarithm (floor) of the input BigInt, or `-1n` if the input is less than or equal to 0.
 *
 * @remarks
 * The function operates in two phases:
 * 1. **Fast Doubling Phase:** Uses exponential steps to quickly narrow down the range
 *    of the most significant bit.
 * 2. **Binary Search Phase:** Refines the result by halving the step size and incrementally
 *    determining the exact value of the logarithm.
 * 3. **Remainder Phase:** Using `Math.log2`.
 */
export const log2 = (v: bigint): bigint => {
    if (v <= 0n) { return -1n }

    //
    // 1. Fast Doubling.
    //

    let result = -1n
    // `bigints` higher than 2**1023 may lead to `Inf` during conversion to `number`.
    // For example: `Number((1n << 1024n) - (1n << 970n)) === Inf`.
    let i = 0x400n
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

    //
    // 2. Binary Search.
    //

    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1023 before we divide it by 2.
    while (i !== 0x400n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }

    //
    // 3. Remainder Phase.
    //

    // We know that `v` is less than `1n << 1024` so we can calculate a remainder using
    // `Math.log2`.
    const nl = mathLog2(Number(v))
    if (isFinite(nl)) {
        const rem = BigInt(nl | 0)
        // (v >> rem) is either `0` or `1`, and it's used as a correction for
        // Math.log2 rounding.
        return result + rem + (v >> rem)
    } else {
        // nl is Inf, it means log2(v) === 0x3FF and we add +1 to compensate for initial
        // `result = -1n`.
        return result + 0x400n
    }
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
 * @param v - The input BigInt.
 * @returns The bit length of the input BigInt.
 *
 * @remark
 * The function uses the `log2` function to calculate the position of the most significant bit (MSB)
 * and adds `1n` to account for the MSB itself. For negative numbers, the absolute value is used.
 */
export const bitLength = (v: bigint): bigint => log2(abs(v)) + 1n

/**
 * Generates a bitmask with the specified number of bits set to 1.
 *
 * @param len - The number of bits to set in the mask. Must be a non-negative integer.
 * @returns A bigint representing the bitmask, where the least significant `len` bits are 1.
 *
 * @example
 *
 * ```js
 * const result = mask(3n) // 7n
 * ```
 */
export const mask = (len: bigint): bigint =>
    (1n << len) - 1n

/**
 * Returns the smaller of two `bigint` values.
 *
 * @param a - The first bigint.
 * @returns A function that takes the second bigint and returns the smaller value.
 */
export const min = (a:bigint) => (b: bigint): bigint =>
    a < b ? a : b

/**
 * Returns the larger of two `bigint` values.
 *
 * @param a - The first bigint.
 * @returns A function that takes the second bigint and returns the larger value.
 */
export const max = (a: bigint) => (b: bigint): bigint =>
    a < b ? b : a

/**
 * Calculates the partial factorial `b!/a!`.
 *
 * @param a - The starting bigint value.
 * @returns A function that takes `b` and computes `b!/a!`.
 */
export const partialFactorial = (a: bigint) => (b: bigint): bigint => {
    let result = b
    while (true) {
        --b
        if (b <= a) { return result }
        result *= b
    }
}

/**
 * Calculates the factorial of a `bigint`.
 *
 * @param b - The bigint value.
 * @returns The factorial of the input.
 */
export const factorial: (b: bigint) => bigint = partialFactorial(1n)

/**
 * Calculates the number of combinations for a list of `bigint` values.
 *
 * @param k - A list of bigint values.
 * @returns The number of combinations.
 */
export const combination = (...k: readonly bigint[]): bigint => {
    let s = 0n
    let m = 1n
    let p = 1n
    for (let i of k) {
        s += i
        if (i >= m) {
            [i, m] = [m, i]
        }
        p *= factorial(i)
    }
    return partialFactorial(m)(s) / p
}

export const xor: Reduce = a => b => a ^ b

export const divUp: Reduce = b => {
    const m = b - 1n
    return v => (v + m) / b
}

export const roundUp: Reduce = b => {
    const d = divUp(b)
    return v => d(v) * b
}
