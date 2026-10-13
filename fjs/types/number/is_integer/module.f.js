/**
 * The integer predicate: `Number.isInteger` written with the language's own
 * numeric operators, so a module can import it where the `Number` global is
 * not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * Whether `n` is a finite integral number, including both zeros and integers
 * beyond the safe-integer range. Non-numbers are refused without coercion.
 * This is what `Number.isInteger` answers, value for value: the substitution
 * for it in FunctionalScript.
 *
 * @type {(n: unknown) => boolean}
 */
export const isInteger = n => typeof n === 'number' && n % 1 === 0
