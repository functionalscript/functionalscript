/**
 * @module
 * 
 * This module provides a collection of utility functions for working with `bigint` values.
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
 * ```
 */

import { unsafeCmp, type Sign } from '../function/compare/module.f.ts'
import type * as Operator from '../function/operator/module.f.ts'
import { reduce, type List } from '../list/module.f.ts'

export type Unary = Operator.Unary<bigint, bigint>

export type Reduce = Operator.Reduce<bigint>

export const addition: Reduce = a => b => a + b

export const sum: (input: List<bigint>) => bigint
    = reduce(addition)(0n)

export const abs: Unary
    = a => a >= 0 ? a : -a

export const sign = (a: bigint): Sign => unsafeCmp(a)(0n)

export const serialize = (a: bigint): string => `${a}n`

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
 */
export const log2 = (v: bigint): bigint => {
    if (v <= 0n) { return -1n }
    let result = 31n
    let i = 32n
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
    // Because of this, We check if `i` is greater than 32 before we divide it by 2.
    while (i !== 32n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result - BigInt(Math.clz32(Number(v)))
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
export const bitLength = (v: bigint): bigint => {
    if (v <= 0n) {
        if (v === 0n) { return 0n }
        v = -v
    }
    return log2(v) + 1n
}

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
