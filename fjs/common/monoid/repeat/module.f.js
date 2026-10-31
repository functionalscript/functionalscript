/**
 * Repetition under a monoid operation, independent of list folding so compiled
 * modules can use it without depending on the list implementation.
 *
 * @module
 * @import { Fold } from '../../../types/function/operator/types.ts'
 * @import { Monoid } from '../types.ts'
 */

/**
 * Repeats a monoid operation a nonnegative bigint `n` times on `a`.
 * This function efficiently performs the operation using exponentiation by squaring.
 *
 * `repeat` squares and never folds, so it reads no weight: an identity and an
 * operation are all it asks for.
 *
 * @template T The type of the elements in the monoid.
 * @param {Pick<Monoid<T>, 'identity' | 'operation'>} monoid The identity and the binary operation.
 * @returns {Fold<bigint, T>} A function that takes a repetition count `n` and then an element `a`,
 * and returns the result of applying the operation `n` times.
 *
 * See also {@link https://en.wikipedia.org/wiki/Exponentiation_by_squaring}.
 *
 * @example
 *
 * ```ts
 * const add: Pick<Monoid<number>, 'identity' | 'operation'> = {
 *     identity: 0,
 *     operation: a => b => a + b,
 * };
 *
 * const resultAdd = repeat(add)(10n)(2) // 20
 *
 * const concat: Pick<Monoid<string>, 'identity' | 'operation'> = {
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
