/**
 * Types for short Weierstrass elliptic-curve arithmetic over a prime field.
 *
 * @module
 */
import type { Fold, Reduce } from '../../types/function/operator/types.ts'
import type { PrimeField } from '../../types/prime_field/types.ts'

/** A 2D point represented as a pair of `bigint` values `[x, y]`. */
export type Point2D = readonly [bigint, bigint]

/**
 * A 2D point on an elliptic curve, represented as a pair of `bigint` values.
 * `null` represents the point at infinity (`O`).
 */
export type Point = Point2D | null

/**
 * Initialization parameters for an elliptic curve.
 */
export type Init = {
    readonly p: bigint
    readonly a: readonly [bigint, bigint]
    readonly g: readonly [bigint, bigint]
    readonly n: bigint
}

/**
 * Represents an elliptic curve and its associated operations.
 */
export type Curve = {
    readonly pf: PrimeField
    readonly nf: PrimeField
    readonly g: Point
    readonly y2: (x: bigint) => bigint
    readonly y: (x: bigint) => bigint | null
    readonly neg: (a: Point) => Point
    readonly add: Reduce<Point>
    readonly mul: Fold<bigint, Point>
}
