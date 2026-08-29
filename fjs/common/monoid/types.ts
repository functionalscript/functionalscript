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

/**
 * A monoid that additionally has an
 * {@link https://en.wikipedia.org/wiki/Absorbing_element absorbing element}
 * (also called a zero or annihilator): a value that swallows the operation
 * from either side.
 *
 * For all `a`: `operation(absorbing)(a) = operation(a)(absorbing) = absorbing`.
 *
 * Once a fold reaches `absorbing`, the result is decided — every remaining
 * element combines to `absorbing` again — so `foldAbsorbing` may stop reading
 * the list there instead of walking to its end. That is the difference between
 * answering and not returning at all when the list is an unbounded `Thunk`.
 *
 * Multiplication over numbers has `0`; `bit_vec`'s length-capped concatenation
 * has `null`, meaning "longer than `maxLength`".
 *
 * The monoid is carried as a field rather than intersected in, so it stays
 * independently constructed and consumed (`fjs/AGENTS.md` §3.2).
 */
export type Absorbing<T> = {
    readonly monoid: Monoid<T>
    readonly absorbing: T
}
