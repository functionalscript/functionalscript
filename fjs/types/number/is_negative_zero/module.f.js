/**
 * The negative-zero predicate: `Object.is(n, -0)` written with the
 * language's own operators, so a module can import it where the `Object`
 * namespace is not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * Whether `n` is `-0`, the one value `===` cannot tell from `0`: dividing
 * by it does, `1 / -0` being `-Infinity` where `1 / 0` is `Infinity`. Every
 * other number, and every value of another type, is `false` without
 * coercion — `0n` is no zero of this kind, since `0n !== 0` — as
 * `Object.is(n, -0)` answers.
 *
 * @type {(n: unknown) => boolean}
 */
export const isNegativeZero = n => n === 0 && 1 / n < 0
