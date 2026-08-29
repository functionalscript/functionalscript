/**
 * Operator types specialized to `bigint`.
 *
 * @module
 */

import type {
    Unary as OpUnary,
    Reduce as OpReduce,
} from '../function/operator/types.ts'

/**
 * Type representing a unary operation on `bigint`.
 */
export type Unary = OpUnary<bigint, bigint>

/**
 * Type representing a reduction operation on `bigint` values.
 */
export type Reduce = OpReduce<bigint>
