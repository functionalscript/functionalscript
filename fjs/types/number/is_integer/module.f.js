/**
 * Integer recognition using the language's numeric operators.
 *
 * @module
 */

/**
 * Whether `n` is a finite integral number, including both zeros and integers
 * beyond the safe-integer range. Non-numbers are refused without coercion.
 *
 * @type {(n: unknown) => boolean}
 */
export const isInteger = n => typeof n === 'number' && n % 1 === 0
