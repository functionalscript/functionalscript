/**
 * Monoids: the `Monoid<T>` algebraic structure (identity plus associative
 * binary operation), `repeat`, which applies the operation `n` times using
 * exponentiation by squaring, and `fold`, which applies it across every element
 * of a list.
 *
 * @module
 */
import type { Fold, Reduce } from '../../types/function/operator/module.f.ts'
import { reduce, type List } from '../../types/list/module.f.ts'
import { flip } from '../../types/function/module.f.ts'

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
 * @template T The type of the elements in the monoid.
 */
export type Monoid<T> = {
    /**
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
     */
    readonly identity: T
    /**
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
    readonly operation: Reduce<T>
}

/**
 * Repeats a monoid operation `n` times on the given element `a`.
 * This function efficiently performs the operation using exponentiation by squaring.
 *
 * @template T The type of the elements in the monoid.
 * @param monoid The monoid structure, including the identity and binary operation.
 * @returns A function that takes an element `a` and a repetition count `n`,
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
export const repeat = <T>({ identity, operation }: Monoid<T>): Fold<bigint, T> => n => a => {
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
 * @param monoid The monoid structure, including the identity and binary operation.
 * @returns A function that reduces a `List<T>` to a single `T`.
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
export const fold = <T>({ identity, operation }: Monoid<T>): (list: List<T>) => T =>
    reduce(flip(operation))(identity)
