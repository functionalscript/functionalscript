/**
 * The `NaN` predicate: `Number.isNaN` written with the language's own
 * operators, so a module can import it where the `Number` global is not
 * admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * Whether `n` is `NaN`. `NaN` is the one value that is not strictly equal to
 * itself, so the comparison alone is the test: every other number, and every
 * value of another type, is `false`, without coercion, as `Number.isNaN`
 * answers and the global `isNaN` does not.
 *
 * @type {(n: unknown) => boolean}
 */
export const isNaN = n => n !== n
