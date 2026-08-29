/**
 * Types for prime field arithmetic over `bigint`.
 *
 * @module
 */

import type { Reduce, Unary } from '../bigint/types.ts'

/**
 * A type representing a prime field and its associated operations.
 *
 * @property reduce
 *
 * Reduces an arbitrary `bigint` into `[0, p)`.
 *
 * @property quadRes
 *
 * `true` when `x` is a square modulo `p`, including `0`.
 *
 * Nonzero values are tested with Euler's criterion:
 * `x^((p - 1) / 2) === 1 (mod p)`.
 * For `p === 2n`, both field elements are squares.
 */
export type PrimeField = {
    readonly p: bigint
    readonly middle: bigint
    readonly max: bigint
    readonly neg: Unary
    readonly sub: Reduce
    readonly add: Reduce
    readonly abs: Unary
    readonly mul: Reduce
    readonly reciprocal: Unary
    readonly div: Reduce
    readonly pow: Reduce
    readonly pow2: Unary
    readonly pow3: Unary
    readonly reduce: Unary
    readonly quadRes: (x: bigint) => boolean
}
