/**
 * The `NaN` predicate: `Number.isNaN` written with the language's own
 * operators, the body the runtime's `static` section binds `Number.isNaN`
 * to ([`fjs/js/runtime`](../../../js/runtime/module.f.js)), and a function a
 * module may import as well, answering alike by construction
 * ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md#3-numberisnan)).
 *
 * @module
 */

/**
 * Whether `n` is `NaN`. `NaN` is the one value that is not strictly equal to
 * itself, so the comparison alone is the test: every other number, and every
 * value of another type, is `false`, without coercion, as `Number.isNaN`
 * answers and the global `isNaN` does not. The name ends in `_` so that it
 * never shadows that global ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @type {(n: unknown) => boolean}
 */
export const isNaN_ = n => n !== n
