/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list as a balanced binary tree.
 *
 * @module
 *
 * @import { Fold, Reduce } from '../../types/function/operator/types.ts'
 * @import { Accumulator, List } from  '../../types/list/types.ts'
 * @import { Absorbing, Monoid } from './types.ts'
 */

import { fold as listFold, tryFold } from '../../types/list/module.f.mjs'
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
 * }} _Run
 */

/**
 * A stack of runs, `null` when empty.
 *
 * @template T
 * @typedef {_Run<T> | null} _Stack
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
 * The result is always a run, never the empty stack — which is what lets
 * {@link absorbingAccumulator} read `null` as a stop signal rather than a state.
 *
 * @type {<T>(operation: Reduce<T>) => (size: number) => (value: T) => (stack: _Stack<T>) => _Run<T>}
 */
const push = operation => size => value => stack =>
    stack === null || stack.size !== size
        ? { size, value, rest: stack }
        : push(operation)(size * 2)(operation(stack.value)(value))(stack.rest)

/**
 * `push` seeded for a single element — the step both {@link fold} and
 * {@link absorbingAccumulator} walk a list with.
 *
 * @type {<T>(operation: Reduce<T>) => (value: T) => (stack: _Stack<T>) => _Run<T>}
 */
const step = operation => push(operation)(1)

/**
 * {@link step} seen as the {@link Fold} `list.fold` takes: the same function,
 * with its result widened from a run to the stack `list.fold` threads.
 *
 * @type {<T>(operation: Reduce<T>) => Fold<T, _Stack<T>>}
 */
const foldStep = step

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
    compose(listFold(foldStep(monoid.operation))(null))(combine(monoid))

/**
 * The run stack as a short-circuiting {@link Accumulator}: `update` returns
 * `null` — `tryFold`'s stop signal — as soon as a merge produces the absorbing
 * element.
 *
 * Only the newest run can be `absorbing`: an earlier one would have stopped the
 * walk already.
 *
 * `end` wraps the folded value in a one-element tuple because `tryFold` reports
 * both "stopped" and "finished with this result" through the same
 * `Nullable<R>`: a monoid whose `T` includes `null` would otherwise be unable to
 * tell a completed fold that produced `null` from an abandoned walk. The tuple
 * costs one allocation per fold, not per element.
 */
const absorbingAccumulator =
    /**
     * @template T
     * @param {Monoid<T>} monoid
     */
    monoid => {
        const p = step(monoid.operation)
        const c = combine(monoid)
        /**
         * @param {T} absorbing
         * @returns {Accumulator<T, _Stack<T>, readonly[T]>}
         */
        return absorbing => ({
            init: null,
            update: (value, stack) => {
                const next = p(value)(stack)
                return next.value === absorbing ? null : next
            },
            end: stack => [c(stack)],
        })
    }

/**
 * {@link fold} for a monoid with an absorbing element, stopping at the first
 * element that reaches it.
 *
 * The result is the same as `fold`'s — combining `absorbing` with the rest of
 * the list is `absorbing` again — but the rest of the list is never read. That
 * is what makes it usable on an unbounded lazy `List`, where `fold` keeps
 * pulling elements forever after the answer is already decided.
 *
 * It stops as soon as a **run** reaches `absorbing`: immediately when an element
 * is absorbing on its own (`0` in a product), otherwise at the merge that first
 * produces it. When only a combination is absorbing — `bit_vec`'s length cap —
 * that merge can lag the element that actually decided the answer, because runs
 * merge at power-of-two boundaries: at most one doubling, so under twice as many
 * elements as a left fold's per-element check would read. Bounded either way,
 * which is the property that matters against an unbounded list.
 *
 * Grouping, order, and the `log2(n)` stack bound are `fold`'s; only the walk
 * gains an exit. `foldAbsorbing(a)(list)` and `fold(a.monoid)(list)` agree on
 * every finite list, including one whose folded value is itself `null`.
 *
 * @template T The type of the elements in the monoid.
 * @param {Absorbing<T>} absorbing The monoid together with its absorbing element.
 * @returns {(list: List<T>) => T} A function that reduces a `List<T>` to a single `T`.
 *
 * @example
 *
 * ```ts
 * const multiply: Absorbing<number> = {
 *     monoid: { identity: 1, operation: a => b => a * b },
 *     absorbing: 0,
 * }
 *
 * foldAbsorbing(multiply)([2, 3, 4]) // 24
 * foldAbsorbing(multiply)([2, 0, 4]) // 0 — `4` is never read
 * ```
 */
export const foldAbsorbing = ({ monoid, absorbing }) => {
    const f = tryFold(absorbingAccumulator(monoid)(absorbing))
    return list => {
        const result = f(list)
        if (result === null) { return absorbing }
        const [value] = result
        return value
    }
}
