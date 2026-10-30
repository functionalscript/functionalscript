/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list as a balanced binary tree.
 *
 * `accumulator(monoid)` exposes that fold through the shared
 * `init` / `update(state, input)` / `end(state)` machine protocol;
 * `absorbingAccumulator` also completes early at an absorbing value.
 * `fold` and `foldAbsorbing` run these machines with the common list driver.
 *
 * The tree is balanced by **weight**. A monoid says how heavy each value is
 * — an array's length, a vector's bit count, a number's magnitude — and
 * `fold` lets a value sit on its stack only where the run two below it is
 * heavier, merging the two runs beneath it first otherwise. The weight is
 * the value's own, so a merged run weighs what its value weighs and nothing
 * is counted; the fold assumes nothing about that weight, it reads the
 * merged value's and applies the rule again, so a weight may fall under the
 * operation — `|a + b|` is below both `|a|` and `|b|` when the signs differ
 * — and the stack stays well formed either way. Where the operation's cost
 * grows with its operands, as concatenation does, this is what keeps one
 * long value among many short ones from being copied at every merge: it is
 * never merged on the push that brings it, it waits until the values above
 * it outweigh the run beneath, and it is copied once. Where the operation
 * rounds, as `+` on `number` does, a magnitude as the weight meets the small
 * terms first without reordering them, which is what an operation that is
 * not commutative needs, since its terms cannot be sorted; a commutative one
 * may still do better by sorting its terms first. A weight of zero
 * for every value makes the fold sequential, which is the cheapest fold for
 * an operation whose cost does not depend on its operands.
 *
 * The fold's state, a {@link Stack} of runs, is exported too — `step`,
 * `collect` and `runs` — for a structure that keeps the stack itself rather
 * than folding it away, as [`fjs/types/set`](../../types/set/module.f.mjs)
 * does, or that folds it only once it knows the answer is wanted, as
 * [`fjs/types/bit_vec`](../../types/bit_vec/module.f.mjs) does under its
 * length cap. `step` is the only way in: every stack it builds from `null`
 * keeps the {@link Stack} invariant. So is the fold's single move,
 * {@link move} on a {@link Walk}: `step` and `collect` are loops over it, and
 * the module's demo draws every move it makes.
 *
 * @module
 *
 * @import { Fold, Reduce, Transducer } from '../../types/function/operator/types.ts'
 * @import { List } from  '../../types/list/types.ts'
 * @import { Absorbing, Monoid, Run, Stack, Walk, Weight } from './types.ts'
 */

import { run } from '../../types/list/module.f.mjs'
import { nextStep, doneStep } from '../../types/function/operator/module.f.js'

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
 * One move of a {@link Walk}, the fold's whole rule:
 *
 * - **Merge.** The value may sit on the stack only where the stack is empty,
 *   holds one run, or its second run outweighs the value. Otherwise the two
 *   runs beneath it merge, earlier on the left, the merged run takes the
 *   value's place against the rest of the stack, and the value waits above it
 *   as pending.
 * - **Settle.** A value that may sit, with runs pending, sits, and the
 *   nearest pending run is the value.
 * - **Fold.** When `folding`, a value that may sit with nothing pending merges
 *   into the run beneath it instead, lightest first.
 * - **Done.** Otherwise the walk is over, and `move` answers the walk it was
 *   given: a push is complete, with its value sitting on the stack, or the
 *   fold has merged everything into the value.
 *
 * The rule is the local-minimum rule of the Garsia–Wachs and Hu–Tucker
 * algorithms for the optimal alphabetic tree, run online: two adjacent runs
 * merge as soon as their pair is known to weigh no more than either pair
 * beside it. The invariant, every run outweighs the run two above it,
 * settles the pair beneath, and the arriving value settles the pair above,
 * which is why a value is never merged on the push that brings it. The
 * offline algorithms then move the merged node beside the first heavier one
 * and rebuild the tree in order from the levels; here the merge tree is the
 * result, so the merged run stays in place and the runs beneath it merge
 * instead: a greedy, order-preserving approximation of the optimum.
 *
 * A heavy value costs nothing on arrival, and runs of one weight carry like
 * a binary counter. Every run on the stack outweighs the run two above it; the stack
 * is logarithmic in the total weight for runs of a kind and grows only where
 * lengths strictly decrease, which the fold at the end merges pairwise for
 * the same cost as any other, in `O(w·log(w))` where a plain fold from the
 * top would cost `O(w·√w)`. Earlier runs stay on the left throughout.
 *
 * @type {<T>(monoid: Monoid<T>) => (folding: boolean) => (walk: Walk<T>) => Walk<T>}
 */
export const move = ({ operation, weight }) => folding => walk => {
    const { stack, value, pending } = walk
    if (stack !== null && stack.rest !== null && weight(stack.rest.value) <= weight(value)) {
        return { stack: stack.rest.rest, value: operation(stack.rest.value)(stack.value), pending: { value, rest: pending } }
    }
    if (pending !== null) {
        return { stack: { value, rest: stack }, value: pending.value, pending: pending.rest }
    }
    if (folding && stack !== null) {
        return { stack: stack.rest, value: operation(stack.value)(value), pending: null }
    }
    return walk
}

/**
 * Pushes a value onto the stack, {@link move} by move, and answers `null`
 * instead as soon as a merge produces a value `absorbed` accepts — the exit
 * {@link foldAbsorbing} takes; {@link step} never takes it.
 *
 * @type {<T>(monoid: Monoid<T>) => (absorbed: (value: T) => boolean) => (value: T) => (stack: Stack<T>) => Stack<T>}
 */
const pushUnless = monoid => {
    const next = move(monoid)(false)
    return absorbed => value => stack => {
        /** @type {Walk<typeof value>} */
        let walk = { stack, value, pending: null }
        while (true) {
            const moved = next(walk)
            if (moved === walk) { return { value: walk.value, rest: walk.stack } }
            if (absorbed(moved.value)) { return null }
            walk = moved
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
 * at the identity does; two runs or more merge each other and need no seed.
 * It is the folding {@link move}, taken from the top run down until the
 * stack is empty: into the run beneath where the stack is well formed, so
 * each run is copied once, and pairwise where a run below turns out lighter
 * than what has accumulated.
 *
 * @type {<T>(monoid: Monoid<T>) => (stack: Stack<T>) => T}
 */
export const collect = monoid => {
    const { identity, operation } = monoid
    const next = move(monoid)(true)
    return stack => {
        if (stack === null) { return identity }
        if (stack.rest === null) { return operation(identity)(stack.value) }
        /** @type {Walk<typeof identity>} */
        let walk = { stack: stack.rest, value: stack.value, pending: null }
        while (true) {
            const moved = next(walk)
            if (moved === walk) { return walk.value }
            walk = moved
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
 * Re-grouping does move the rounding of an inexact operation, and the
 * weight steers where. IEEE-754 addition is not truly associative, so
 * `number.sum`, weighed by magnitude, adds the small terms among themselves
 * before they meet a large one and returns a different, marginally more
 * accurate, value than a left fold for some inputs. The fold reads the
 * magnitude of each sum as it is made and assumes nothing about it —
 * `|a + b|` may be below both `|a|` and `|b|` — so this is how an operation
 * meets its small terms first without sorting them, the only way where the
 * operation is not commutative; where it is, sorting the terms by magnitude
 * first may still do better. A `Monoid` promises associativity, and every
 * monoid folds the same way.
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
export const fold = monoid => run(accumulator(monoid))

/**
 * A balanced fold as the common machine lifecycle. `update` places one value
 * on the run stack; `end` combines the remaining runs into the monoid value.
 *
 * @type {<T>(monoid: Monoid<T>) => Transducer<T, Stack<T>, never, T>}
 */
export const accumulator = monoid => {
    const push = step(monoid)
    const finish = collect(monoid)
    return {
        init: nextStep(null),
        update: (stack, value) => nextStep(push(value)(stack)),
        end: stack => doneStep(finish(stack)),
    }
}

/**
 * The run stack with early completion when a value or a merge reaches the
 * absorbing element. A `done` tag carries the absorbing value directly, so a
 * completed fold whose result is `null` remains an ordinary successful result.
 *
 * @type {<T>(absorbing: Absorbing<T>) => Transducer<T, Stack<T>, never, T>}
 */
export const absorbingAccumulator = ({ monoid, absorbing }) => {
    /** @typedef {typeof absorbing} T */
    /** @type {(value: T) => boolean} */
    const absorbed = value => value === absorbing
    const push = pushUnless(monoid)(absorbed)
    const c = collect(monoid)
    return {
        init: nextStep(null),
        update: (stack, value) => {
            if (absorbed(value)) { return doneStep(absorbing) }
            const following = push(value)(stack)
            return following === null ? doneStep(absorbing) : nextStep(following)
        },
        end: stack => doneStep(c(stack)),
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
export const foldAbsorbing = absorbing => run(absorbingAccumulator(absorbing))
