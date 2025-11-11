import type { Fold, Reduce } from '../function/operator/module.f.ts'

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
