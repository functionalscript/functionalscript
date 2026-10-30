/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list as a balanced binary tree.
 *
 * The tree is balanced by **weight**. `foldBy(weight)` takes how heavy each
 * value is — an array's length, a vector's bit count — and merges runs so
 * that every run on its stack outweighs the two above it together; `fold`
 * weighs every value one, which makes the stack a binary counter over the
 * element count. Where the operation's cost grows with its operands, as
 * concatenation does, this is what keeps one long value among many short
 * ones from being copied at every merge: it waits at the bottom until the
 * runs above it together outweigh it, and is copied once.
 *
 * The fold's state, a {@link Stack} of runs, is exported too — `step`,
 * `stepBy` and `runs` — for a structure that keeps the stack itself rather
 * than folding it away, as [`fjs/types/set`](../../types/set/module.f.mjs)
 * does. `step` and `stepBy` are the only way in: every stack they build from
 * `null` keeps the {@link Stack} invariant.
 *
 * @module
 *
 * @import { Fold, Reduce } from '../../types/function/operator/types.ts'
 * @import { Accumulator, List } from  '../../types/list/types.ts'
 * @import { Absorbing, Monoid, Run, Stack, Weight } from './types.ts'
 */

import { fold as listFold, tryFold } from '../../types/list/module.f.mjs'
import { compose } from '../../types/function/module.f.js'

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
 * Merges the top two runs for as long as the top three break the stack's
 * invariant: a run outweighs the two above it together, and the second run
 * outweighs the top. Weights then shrink at least as fast as Fibonacci
 * numbers from the bottom up, so a stack of total weight `w` holds about
 * `1.44·log2(w)` runs and a value is merged about that many times at most;
 * under weight one, the rule is exactly the carry of a binary counter, and
 * only equal runs merge. A heavy run stays at the bottom until the runs above
 * it together outweigh it, which is what spares a long array among short
 * items from being copied at every carry.
 *
 * Only the two topmost runs ever merge, and `operation(lower)(upper)` keeps
 * the earlier run on the left, so re-associating never re-orders; the
 * conditions are re-checked after every merge, down the stack, which is
 * what keeps the invariant true below the top as well.
 *
 * @type {<T>(operation: Reduce<T>) => (top: Run<T>) => Run<T>}
 */
const settle = operation => top => {
    const { rest } = top
    if (rest === null) { return top }
    const below = rest.rest
    if (rest.size > top.size && (below === null || below.size > rest.size + top.size)) { return top }
    return settle(operation)({ size: rest.size + top.size, value: operation(rest.value)(top.value), rest: below })
}

const { max } = Math

/**
 * Pushes a value onto the stack as a run of its own weight, merging as the
 * invariant demands ({@link settle}). The result is always a run, never the
 * empty stack — which is what lets {@link absorbingAccumulator} read `null`
 * as a stop signal rather than a state.
 *
 * A value weighs at least one, whatever `weight` answers: a run of weight
 * zero would never outweigh the top beneath it and so never merge into it,
 * and a list that goes on with empty values after the answer is decided
 * would keep {@link foldAbsorbingBy} walking. Counting each as one keeps
 * every value carrying eventually.
 *
 * @type {<T>(weight: Weight<T>) => (operation: Reduce<T>) => (value: T) => (stack: Stack<T>) => Run<T>}
 */
export const stepBy = weight => operation => {
    const settleOperation = settle(operation)
    return value => {
        const size = max(1, weight(value))
        return stack => settleOperation({ size, value, rest: stack })
    }
}

/** Every value weighs one. @type {<T>(value: T) => number} */
const one = () => 1

/**
 * {@link stepBy} at weight one — the step {@link fold} and
 * {@link foldAbsorbing} walk a list with, carrying like a binary counter.
 *
 * @type {<T>(operation: Reduce<T>) => (value: T) => (stack: Stack<T>) => Run<T>}
 */
export const step = stepBy(one)

/**
 * The values of the stack's runs, newest (top, lightest) first, as a lazy
 * list, so a walk that stops early reads only the runs it needs.
 *
 * @type {<T>(stack: Stack<T>) => List<T>}
 */
export const runs = stack =>
    stack === null ? null : { first: stack.value, tail: () => runs(stack.rest) }

/**
 * {@link stepBy} seen as the {@link Fold} `list.fold` takes: the same function,
 * with its result widened from a run to the stack `list.fold` threads.
 *
 * @type {<T>(weight: Weight<T>) => (operation: Reduce<T>) => Fold<T, Stack<T>>}
 */
const foldStepBy = stepBy

/**
 * Combines the stack's runs into one value, seeded at `identity`: the
 * lightest run first, against the identity, and the heaviest, at the bottom,
 * last, so that one is copied once. Earlier runs stay on the left. The seed
 * is on the light end for the same reason, and it is what passes a lone
 * element through the operation once, as a fold seeded at the identity does.
 *
 * @type {<T>(monoid: Monoid<T>) => (stack: Stack<T>) => T}
 */
const combine = ({ identity, operation }) => stack => {
    let value = identity
    while (stack !== null) {
        [value, stack] = [operation(stack.value)(value), stack.rest]
    }
    return value
}

/**
 * Reduces a `List<T>` with the monoid's associative `operation`, seeded at its
 * `identity`, balancing the merges by `weight`. An empty list folds to
 * `identity`.
 *
 * `fold` is `foldBy` at weight one. The weight is for a monoid whose
 * operation costs as much as its operands are heavy — array, string and
 * `bit_vec` concatenation — where the elements differ in size: a long array
 * among short items is then merged once, when the short ones together
 * outweigh it, where the count-balanced fold merges it at every carry that
 * reaches its run, `log2(n)` times for `n` items. Where every element costs
 * the same, `fold` is the right one.
 *
 * @type {<T>(weight: Weight<T>) => (monoid: Monoid<T>) => (list: List<T>) => T}
 */
export const foldBy = weight => {
    const stepWeight = foldStepBy(weight)
    return monoid => compose(listFold(stepWeight(monoid.operation))(null))(combine(monoid))
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
 * The reduction is **balanced**, not a left fold: `[a, b, c, d]` folds to
 * `(a op b) op (c op d)`, not `((a op b) op c) op d`. A `Monoid`'s
 * associativity is what licenses the re-grouping — `list.reduce` takes an
 * arbitrary operation with no such contract and therefore stays strictly
 * left-to-right. Balancing matters for size-growing exact operations
 * (`bigint.product`, `string`/`bit_vec` concatenation): a left fold grows the
 * accumulator while every new operand stays small, so step *k* costs work
 * proportional to *k* and the total is O(n²), while merging runs of comparable
 * size costs O(n log n). It is the list-shaped sibling of {@link repeat}'s
 * exponentiation by squaring. `fold` balances by element count; where the
 * elements themselves differ in size, {@link foldBy} balances by their weight.
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
export const fold = foldBy(one)

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
 *
 * @type {<T>(weight: Weight<T>) => (monoid: Monoid<T>) => (absorbing: T) => Accumulator<T, Stack<T>, readonly[T]>}
 */
const absorbingAccumulator = weight => {
    const stepWeight = stepBy(weight)
    return monoid => {
        const p = stepWeight(monoid.operation)
        const c = combine(monoid)
        return absorbing => ({
            init: null,
            update: (value, stack) => {
                const next = p(value)(stack)
                return next.value === absorbing ? null : next
            },
            end: stack => [c(stack)],
        })
    }
}

/**
 * {@link foldBy} for a monoid with an absorbing element, stopping at the first
 * element that reaches it.
 *
 * The result is the same as `foldBy`'s — combining `absorbing` with the rest
 * of the list is `absorbing` again — but the rest of the list is never read.
 * That is what makes it usable on an unbounded lazy `List`, where `fold` keeps
 * pulling elements forever after the answer is already decided.
 *
 * It stops as soon as a **run** reaches `absorbing`: immediately when an element
 * is absorbing on its own (`0` in a product), otherwise at the merge that first
 * produces it. When only a combination is absorbing — `bit_vec`'s length cap —
 * that merge can lag the element that actually decided the answer, because runs
 * merge only as the stack's invariant demands: under weight one, at most one
 * doubling, so under twice as many elements as a left fold's per-element
 * check would read. Bounded either way, which is the property that matters
 * against an unbounded list.
 *
 * Grouping, order, and the stack bound are `foldBy`'s; only the walk gains an
 * exit. `foldAbsorbingBy(w)(a)(list)` and `foldBy(w)(a.monoid)(list)` agree on
 * every finite list, including one whose folded value is itself `null`.
 *
 * @type {<T>(weight: Weight<T>) => (absorbing: Absorbing<T>) => (list: List<T>) => T}
 */
export const foldAbsorbingBy = weight => {
    const accumulator = absorbingAccumulator(weight)
    return ({ monoid, absorbing }) => {
        const f = tryFold(accumulator(monoid)(absorbing))
        return list => {
            const result = f(list)
            if (result === null) { return absorbing }
            const [value] = result
            return value
        }
    }
}

/**
 * {@link foldAbsorbingBy} at weight one: {@link fold} with an exit at the
 * absorbing element.
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
export const foldAbsorbing = foldAbsorbingBy(one)
