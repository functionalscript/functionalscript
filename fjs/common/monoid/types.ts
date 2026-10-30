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
 *
 * @property weight
 *
 * How heavy a value is, for the balanced fold ({@link Weight}): a length
 * where the operation copies its operands, a magnitude where it rounds,
 * zero where its cost does not depend on the operands.
 */
export type Monoid<T> = {
    readonly identity: T
    readonly operation: Reduce<T>
    readonly weight: Weight<T>
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
 * has a vector longer than `maxLength` that stands for every overflow.
 *
 * The monoid is carried as a field rather than intersected in, so it stays
 * independently constructed and consumed (`fjs/AGENTS.md` §3.2).
 */
export type Absorbing<T> = {
    readonly monoid: Monoid<T>
    readonly absorbing: T
}

/**
 * How heavy a value is, for the balanced fold: `fold` merges the light runs
 * first, so the weight is whatever the operation should meet small first —
 * an array's length or a vector's bit count where the operation copies its
 * operands, a number's magnitude where it rounds. The weight is read from
 * the value itself, a merged run's from the merged value, and the fold
 * assumes nothing about how it behaves under the operation: a length adds,
 * a magnitude adds at most, and `|a + b|` is below both `|a|` and `|b|`
 * when the signs differ; the fold reads the result's weight and applies its
 * rule again. A weight of zero for every value makes the fold sequential,
 * which is the cheapest fold there is for an operation whose cost does not
 * grow with its operands.
 */
export type Weight<T> = (value: T) => number

/**
 * A run of already-combined elements. Runs live on a {@link Stack} whose top
 * is the most recent run, so `rest` holds everything to the left of `value`.
 * A run weighs what its value weighs.
 */
export type Run<T> = {
    readonly value: T
    readonly rest: Stack<T>
}

/**
 * A stack of runs, `null` when empty: the state of a balanced fold. A value
 * sits on the stack only where the run two below it outweighs it; otherwise
 * the two runs beneath it merge first, so every run outweighs the run two
 * above it, and runs of one weight carry like a binary counter, two of a kind
 * side by side at most, so `n` such elements are at most `2·log2(n) + 1`
 * runs. A value never merges on the push that brings it, so the top is the
 * last value pushed.
 */
export type Stack<T> = Run<T> | null

/**
 * The state of one push or of the fold at the end, between moves: the
 * `value` being placed, the `stack` beneath it, and the runs `pending` above
 * it, nearest first, that found their place and wait to be pushed back once
 * the stack below has settled. In the order of the list being folded, the
 * runs read stack bottom to top, then the value, then the pending runs
 * nearest to farthest.
 */
export type Walk<T> = {
    readonly stack: Stack<T>
    readonly value: T
    readonly pending: Stack<T>
}

/**
 * The state of the module's demo (`./demo.f.mjs`): which sequence is drawn,
 * and the seed of the shuffle. Private to the demo, and here rather than in
 * `private.ts` because the demo's shipped declaration reaches it.
 */
export type _DemoState = {
    readonly sequence: string
    readonly seed: number
}
