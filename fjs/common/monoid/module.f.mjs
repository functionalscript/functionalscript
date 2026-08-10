/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list.
 *
 * @module
 */
/** @import { Fold } from '../../types/function/operator/types.ts' */
import { reduce } from '../../types/list/module.f.mjs'
/** @import { List } from  '../../types/list/types.ts' */
import { flip } from '../../types/function/module.f.mjs'
/** @import { Monoid } from './types.ts' */

/**
 * Repeats a monoid operation `n` times on the given element `a`.
 * This function efficiently performs the operation using exponentiation by squaring.
 *
 * @template T The type of the elements in the monoid.
 * @param {Monoid<T>} monoid The monoid structure, including the identity and binary operation.
 * @returns {Fold<bigint, T>} A function that takes an element `a` and a repetition count `n`,
 * and returns the result of applying the operation `n` times.
 *
 * See also {@link https://en.wikipedia.org/wiki/Exponentiation_by_squaring}.
 *
 * @example
 *
 * ```ts
 * const add: Monoid<number> = {
 *     identity: 0,
 *     operation: a => b => a + b,
 * };
 *
 * const resultAdd = repeat(add)(10n)(2) // 20
 *
 * const concat: Monoid<string> = {
 *     identity: '',
 *     operation: a => b => a + b,
 * };
 *
 * const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
 * ```
 */
export const repeat = ({ identity, operation }) => n => a => {
    let ai = a
    let ni = n
    let result = identity
    while (true) {
        if ((ni & 1n) !== 0n) {
            result = operation(result)(ai)
        }
        ni >>= 1n
        if (ni === 0n) {
            return result
        }
        ai = operation(ai)(ai)
    }
}

/**
 * Reduces a `List<T>` with the monoid's associative `operation`, seeded at its
 * `identity`. An empty list folds to `identity`.
 *
 * `fold` is the reduction companion of {@link repeat}: where `repeat` applies
 * the operation a fixed number of times to a single element, `fold` applies it
 * across every element of a list. Together they let list reductions such as
 * `sum`, `product`, and string `concat` be expressed directly as monoid folds,
 * so the identity paired with each operation is stated once at the call site
 * instead of hand-seeding a raw `reduce`.
 *
 * Like `repeat`, `fold` applies the operation **accumulator-first**:
 * `operation(accumulator)(element)`, seeded at `identity`, so
 * `[a, b, c]` folds to `((identity op a) op b) op c`. Left-to-right order is
 * therefore preserved and `fold` is correct for non-commutative monoids (e.g.
 * string concatenation as `a => b => a + b`). `list.reduce` calls its reducer
 * element-first, so the operation is `flip`ped before it is handed over.
 *
 * @template T The type of the elements in the monoid.
 * @param {Monoid<T>} monoid The monoid structure, including the identity and binary operation.
 * @returns {(list: List<T>) => T} A function that reduces a `List<T>` to a single `T`.
 *
 * @example
 *
 * ```ts
 * const add: Monoid<number> = {
 *     identity: 0,
 *     operation: a => b => a + b,
 * };
 *
 * fold(add)([1, 2, 3, 4]) // 10
 * fold(add)([])           // 0
 *
 * const concat: Monoid<string> = {
 *     identity: '',
 *     operation: a => b => a + b,
 * };
 *
 * fold(concat)(['a', 'b', 'c']) // 'abc' — order preserved
 * ```
 */
export const fold = ({ identity, operation }) =>
    reduce(flip(operation))(identity)
