/**
 * The `Monoid<T>` algebraic structure.
 *
 * @module
 */
import type { Reduce } from '../../types/function/operator/types.ts'

/**
 * Represents a monoid, an algebraic structure with a binary operation
 * and an identity (neutral) element.
 *
 * A monoid satisfies the following properties:
 * 1. **Associativity**: The operation must be associative.
 *    For all `a`, `b`, and `c` in the set, `(a operation b) operation c = a operation (b operation c)`.
 *    {@link https://en.wikipedia.org/wiki/Associative_property Learn more about associativity}.
 * 2. **Identity Element**: There exists an element (called the identity) such that,
 *    when combined with any other element under the operation, it leaves the other element unchanged.
 *    {@link https://en.wikipedia.org/wiki/Identity_element Learn more about identity elements}.
 *
 * Learn more about monoids: {@link https://en.wikipedia.org/wiki/Monoid}.
 *
 * @property identity
 *
 * The identity (neutral) element for the monoid.
 * When combined with any value under the `operation`, it leaves the other value unchanged.
 *
 * Examples:
 * - `0` for addition
 * - `1` for multiplication
 * - `""` for string concatenation
 * - `[]` for array concatenation
 *
 * Learn more: {@link https://en.wikipedia.org/wiki/Identity_element}
 *
 * @property operation
 *
 * The associative binary operation of the monoid.
 * Takes one value of type `T` and returns a function that takes another value of type `T`,
 * producing a result of type `T`.
 *
 * Examples:
 * - `(a, b) => a + b` for addition
 * - `(a, b) => a * b` for multiplication
 * - `(a, b) => a.concat(b)` for arrays or strings
 *
 * Learn more: {@link https://en.wikipedia.org/wiki/Binary_operation}
 */
export type Monoid<T> = {
    readonly identity: T
    readonly operation: Reduce<T>
}
