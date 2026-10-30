/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list as a balanced binary tree.
 *
 * The tree is balanced by **weight**. A monoid says how heavy each value is
 * — an array's length, a vector's bit count, a number's magnitude — and
 * `fold` lets a value sit on its stack only where the run two below it is
 * heavier, merging the two runs beneath it first otherwise. The weight is
 * the value's own, so a merged run weighs what its value weighs and nothing
 * is counted. Where the operation's cost grows with its operands, as
 * concatenation does, this is what keeps one long value among many short
 * ones from being copied at every merge: it is never merged on the push that
 * brings it, it waits until the values above it outweigh the run beneath,
 * and it is copied once. A weight of zero for every value makes the fold
 * sequential, which is the cheapest fold for an operation whose cost does
 * not depend on its operands.
 *
 * The fold's state, a {@link Stack} of runs, is exported too — `step`,
 * `collect` and `runs` — for a structure that keeps the stack itself rather
 * than folding it away, as [`fjs/types/set`](../../types/set/module.f.mjs)
 * does, or that folds it only once it knows the answer is wanted, as
 * [`fjs/types/bit_vec`](../../types/bit_vec/module.f.mjs) does under its
 * length cap. `step` is the only way in: every stack it builds from `null`
 * keeps the {@link Stack} invariant.
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
 * `repeat` squares and never folds, so it reads no weight: an identity and an
 * operation are all it asks for.
 *
 * @template T The type of the elements in the monoid.
 * @param {Pick<Monoid<T>, 'identity' | 'operation'>} monoid The identity and the binary operation.
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
 * Pushes a value onto the stack, merging as the stack's invariant demands,
 * and answers `null` instead as soon as a merge produces a value `absorbed`
 * accepts — the exit {@link foldAbsorbing} takes; {@link step} never takes
 * it.
 *
 * The value may sit on the stack as it is where the stack is empty, holds one
 * run, or its second run outweighs the value. Otherwise the two runs beneath
 * the value merge, earlier on the left, and the merged run takes the value's
 * place against the rest of the stack while the value waits in `buffer`;
 * every run that found its place is pushed back in order once the stack
 * below has settled. The value itself is never merged on the push that
 * brings it, so a heavy value costs nothing on arrival, and runs of one
 * weight carry like a binary counter. Every run on the stack outweighs the
 * run two above it; the stack is logarithmic in the total weight for runs
 * of a kind and grows only where lengths strictly decrease, which
 * {@link collect} folds pairwise at the end for the same cost as any other.
 *
 * @type {<T>(monoid: Monoid<T>) => (absorbed: (value: T) => boolean) => (value: T) => (stack: Stack<T>) => Stack<T>}
 */
const pushUnless = ({ operation, weight }) => absorbed => value => stack => {
    /** @typedef {typeof value} T */
    /** @type {Stack<T>} */
    let buffer = null
    while (true) {
        if (stack === null || stack.rest === null || weight(stack.rest.value) > weight(value)) {
            stack = { value, rest: stack }
            if (buffer === null) { return stack }
            [value, buffer] = [buffer.value, buffer.rest]
        } else {
            const merged = operation(stack.rest.value)(stack.value)
            if (absorbed(merged)) { return null }
            [buffer, value, stack] = [{ value, rest: buffer }, merged, stack.rest.rest]
        }
    }
}

/** No merge stops a plain push. @type {() => boolean} */
const never = () => false

/**
 * Pushes a value onto the stack, merging as the stack's invariant demands
 * ({@link pushUnless}). The result is never the empty stack: the value
 * pushed is its top.
 *
 * @type {<T>(monoid: Monoid<T>) => (value: T) => (stack: Stack<T>) => Stack<T>}
 */
export const step = monoid => pushUnless(monoid)(never)

/**
 * The values of the stack's runs, newest (top) first, as a lazy list, so a
 * walk that stops early reads only the runs it needs.
 *
 * @type {<T>(stack: Stack<T>) => List<T>}
 */
export const runs = stack =>
    stack === null ? null : { first: stack.value, tail: () => runs(stack.rest) }

/**
 * Folds the stack's runs into one value, the second half of {@link fold}:
 * `identity` for the empty stack, and a lone run merged with `identity`,
 * which passes a lone element through the operation once, as a fold seeded
 * at the identity does; two runs or more merge each other and need no seed. It is {@link pushUnless}'s walk with the
 * value already taken off the top: where the value would come to rest on
 * the stack and nothing waits in the buffer, it merges into the run beneath
 * it instead, lightest first, so a well-formed stack folds with each run
 * copied once; where a run below turns out lighter than what has
 * accumulated, the two runs beneath merge pairwise and come back in order,
 * which is what folds a stack of strictly decreasing lengths in
 * `O(w·log(w))` where a plain fold from the top would cost `O(w·√w)`.
 * Earlier runs stay on the left throughout.
 *
 * @type {<T>(monoid: Monoid<T>) => (stack: Stack<T>) => T}
 */
export const collect = ({ identity, operation, weight }) => stack => {
    /** @typedef {typeof identity} T */
    if (stack === null) { return identity }
    if (stack.rest === null) { return operation(identity)(stack.value) }
    let value = stack.value
    stack = stack.rest
    /** @type {Stack<T>} */
    let buffer = null
    while (true) {
        if (stack === null || stack.rest === null || weight(stack.rest.value) > weight(value)) {
            if (buffer !== null) {
                [stack, value, buffer] = [{ value, rest: stack }, buffer.value, buffer.rest]
            } else if (stack === null) {
                return value
            } else {
                [value, stack] = [operation(stack.value)(value), stack.rest]
            }
        } else {
            [buffer, value, stack] = [{ value, rest: buffer }, operation(stack.rest.value)(stack.value), stack.rest.rest]
        }
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
 * The balance follows the monoid's `weight`, read from each value: a long
 * array among short items is never merged on arrival and merges once, when
 * the short ones above it outweigh the run beneath, where a count-balanced
 * fold merged it at every carry that reached its run. Values of one weight
 * carry like a binary counter, and values of weight zero fold sequentially.
 *
 * Only the grouping changes, never the order: each merge keeps the earlier
 * operand on the left, so `fold` stays correct for non-commutative monoids
 * (e.g. string concatenation as `a => b => a + b`).
 *
 * Re-grouping does move the rounding of an inexact operation. IEEE-754
 * addition is not truly associative, so `number.sum`, weighed by magnitude,
 * adds the small terms among themselves before they meet a large one and
 * returns a (marginally more accurate) different value than a left fold for
 * some inputs. That is a consequence of the uniform treatment, not a goal:
 * a `Monoid` promises associativity, and every monoid folds the same way.
 *
 * @template T The type of the elements in the monoid.
 * @param {Monoid<T>} monoid The monoid structure: identity, binary operation and weight.
 * @returns {(list: List<T>) => T} A function that reduces a `List<T>` to a single `T`.
 *
 * @example
 *
 * ```ts
 * const add: Monoid<number> = {
 *     identity: 0,
 *     operation: a => b => a + b,
 *     weight: Math.abs,
 * };
 *
 * fold(add)([1, 2, 3, 4]) // 10
 * fold(add)([])           // 0
 *
 * const concat: Monoid<string> = {
 *     identity: '',
 *     operation: a => b => a + b,
 *     weight: s => s.length,
 * };
 *
 * fold(concat)(['a', 'b', 'c']) // 'abc' — order preserved
 * ```
 */
export const fold = monoid =>
    compose(listFold(step(monoid))(null))(collect(monoid))

/**
 * The run stack as a short-circuiting {@link Accumulator}: `update` returns
 * `null` — `tryFold`'s stop signal — for an element that is the absorbing
 * one, and as soon as a merge produces it ({@link pushUnless}).
 *
 * `end` wraps the folded value in a one-element tuple because `tryFold` reports
 * both "stopped" and "finished with this result" through the same
 * `Nullable<R>`: a monoid whose `T` includes `null` would otherwise be unable to
 * tell a completed fold that produced `null` from an abandoned walk. The tuple
 * costs one allocation per fold, not per element.
 *
 * @type {<T>(absorbing: Absorbing<T>) => Accumulator<T, Stack<T>, readonly[T]>}
 */
const absorbingAccumulator = ({ monoid, absorbing }) => {
    /** @typedef {typeof absorbing} T */
    /** @type {(value: T) => boolean} */
    const absorbed = value => value === absorbing
    const push = pushUnless(monoid)(absorbed)
    const c = collect(monoid)
    return {
        init: null,
        update: (value, stack) => absorbed(value) ? null : push(value)(stack),
        end: stack => [c(stack)],
    }
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
 * It stops at the element that is absorbing on its own (`0` in a product),
 * and otherwise at the merge that first produces the absorbing value. When
 * only a combination is absorbing, that merge waits until the stack's rule
 * brings the two runs together, which the values pushed above them do once
 * they outweigh the run beneath: the stop lags the element that decided the
 * answer by about that much weight, and values of weight zero never bring
 * it, so a list that goes on with them past the answer is read until they
 * end. Where the answer can be read from the values before they merge, as a
 * length cap can from the lengths, stop the list on that instead:
 * [`fjs/types/bit_vec`](../../types/bit_vec/module.f.mjs) caps the total
 * length as each vector is pushed, with `step` and `collect`, and never waits
 * for a merge.
 *
 * Grouping, order, and the stack bound are `fold`'s; only the walk gains an
 * exit. `foldAbsorbing(a)(list)` and `fold(a.monoid)(list)` agree on every
 * finite list, including one whose folded value is itself `null`.
 *
 * @template T The type of the elements in the monoid.
 * @param {Absorbing<T>} absorbing The monoid together with its absorbing element.
 * @returns {(list: List<T>) => T} A function that reduces a `List<T>` to a single `T`.
 *
 * @example
 *
 * ```ts
 * const multiply: Absorbing<number> = {
 *     monoid: { identity: 1, operation: a => b => a * b, weight: Math.abs },
 *     absorbing: 0,
 * }
 *
 * foldAbsorbing(multiply)([2, 3, 4]) // 24
 * foldAbsorbing(multiply)([2, 0, 4]) // 0 — `4` is never read
 * ```
 */
export const foldAbsorbing = absorbing => {
    const f = tryFold(absorbingAccumulator(absorbing))
    return list => {
        const result = f(list)
        if (result === null) { return absorbing.absorbing }
        const [value] = result
        return value
    }
}
