/**
 * The finite predicate: `Number.isFinite` written with the language's own
 * numeric operators, so a module can import it where the `Number` global is
 * not admitted ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

/**
 * Whether `n` is a finite number. A number times `0` is `0` exactly when it
 * is finite: an infinity times `0` and `NaN` times `0` are both `NaN`, and
 * `-0` is `0` under `===`. A value of another type is `false` without
 * coercion. This is what `Number.isFinite` answers, value for value — the
 * substitution for it in FunctionalScript — and not what the global
 * `isFinite` answers, which converts first. The name ends in `_` so that it
 * never shadows that global ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @type {(n: unknown) => boolean}
 */
export const isFinite_ = n => typeof n === 'number' && n * 0 === 0
