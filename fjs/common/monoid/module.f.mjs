/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list as a balanced binary tree.
 *
 * @module
 *
 * @import { Fold, Reduce } from '../../types/function/operator/types.ts'
 * @import { List } from  '../../types/list/types.ts'
 * @import { Monoid } from './types.ts'
 */

import { fold as listFold } from '../../types/list/module.f.mjs'
import { compose } from '../../types/function/module.f.mjs'

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
 * A run of `size` already-combined elements. Runs live on a stack whose top is
 * the most recent — and smallest — run, so `rest` holds everything to the left
 * of `value`.
 *
 * @template T
 * @typedef {{
 *  readonly size: number
 *  readonly value: T
 *  readonly rest: _Stack<T>
 * } | null} _Stack
 */

/**
 * Pushes a run of `size` combined elements onto the stack, merging while the
 * top run has the same size — exactly the carry of incrementing a binary
 * counter, so every merge joins two runs of equal size and the stack never
 * holds more than `log2(n)` runs.
 *
 * The merge keeps the earlier run on the left (`operation(stack.value)(value)`),
 * so re-associating never re-orders.
 *
 * @type {<T>(operation: Reduce<T>) => (size: number) => (value: T) => (stack: _Stack<T>) => _Stack<T>}
 */
const push = operation => size => value => stack =>
    stack === null || stack.size !== size
        ? { size, value, rest: stack }
        : push(operation)(size * 2)(operation(stack.value)(value))(stack.rest)

/**
 * Combines the stack's runs into one value, earliest (bottom, largest) first,
 * seeded at `identity`.
 *
 * @type {<T>(monoid: Monoid<T>) => (stack: _Stack<T>) => T}
 */
const combine = monoid => stack =>
    stack === null
        ? monoid.identity
        : monoid.operation(combine(monoid)(stack.rest))(stack.value)

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
 * The reduction is **balanced**, not a left fold: `[a, b, c, d]` folds to
 * `(a op b) op (c op d)`, not `((a op b) op c) op d`. A `Monoid`'s
 * associativity is what licenses the re-grouping — `list.reduce` takes an
 * arbitrary operation with no such contract and therefore stays strictly
 * left-to-right. Balancing matters for size-growing exact operations
 * (`bigint.product`, `string`/`bit_vec` concatenation): a left fold grows the
 * accumulator while every new operand stays small, so step *k* costs work
 * proportional to *k* and the total is O(n²), while merging runs of comparable
 * size costs O(n log n). It is the list-shaped sibling of {@link repeat}'s
 * exponentiation by squaring.
 *
 * Only the grouping changes, never the order: each merge keeps the earlier
 * operand on the left, so `fold` stays correct for non-commutative monoids
 * (e.g. string concatenation as `a => b => a + b`).
 *
 * Re-grouping does move the rounding of an inexact operation. IEEE-754 addition
 * is not truly associative, so `number.sum` returns a (marginally more
 * accurate — O(log n · ε) instead of O(n · ε)) different value than a left fold
 * for some inputs. That is a consequence of the uniform treatment, not a goal:
 * a `Monoid` promises associativity, and every monoid folds the same way.
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
export const fold = monoid =>
    compose(listFold(push(monoid.operation)(1))(null))(combine(monoid))
