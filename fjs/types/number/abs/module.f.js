/**
 * Absolute value of a number, using compiler-compatible operators.
 *
 * @module
 */

/**
 * Matches `Math.abs(n)` for numeric inputs, including `NaN`, infinities,
 * and either zero producing positive zero. The input must be a number;
 * this helper does not perform `Math.abs`'s conversion of other types.
 *
 * @type {(n: number) => number}
 */
export const abs = n => n === 0 ? 0 : n < 0 ? -n : n
