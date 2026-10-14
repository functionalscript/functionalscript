/**
 * The finite predicate: `Number.isFinite` written with the language's own
 * numeric operators, the body the runtime's `static` section binds
 * `Number.isFinite` to ([`fjs/js/runtime`](../../../js/runtime/module.f.js)),
 * and a function a module may import as well, answering alike by
 * construction ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md#4-numberisfinite)).
 *
 * @module
 */

/**
 * Whether `n` is a finite number. A number times `0` is `0` exactly when it
 * is finite: an infinity times `0` and `NaN` times `0` are both `NaN`, and
 * `-0` is `0` under `===`. A value of another type is `false` without
 * coercion. This is what `Number.isFinite` answers, value for value, and
 * not what the global `isFinite` answers, which converts first. The name
 * ends in `_` so that it never shadows that global ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @type {(n: unknown) => boolean}
 */
export const isFinite_ = n => typeof n === 'number' && n * 0 === 0
