/**
 * The finite predicate: `Number.isFinite` written with the language's own
 * numeric operators, so a module can import it where the `Number` global is
 * not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * Whether `n` is a finite number. A number less itself is `0` exactly when
 * it is finite: an infinity less itself and `NaN` less itself are both
 * `NaN`. A value of another type is `false` without coercion. This is what
 * `Number.isFinite` answers, value for value — the substitution for it in
 * FunctionalScript — and not what the global `isFinite` answers, which
 * converts first.
 *
 * @type {(n: unknown) => boolean}
 */
export const isFinite = n => typeof n === 'number' && n - n === 0
