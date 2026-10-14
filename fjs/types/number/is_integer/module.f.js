/**
 * The integer predicate: `Number.isInteger` written with the language's own
 * numeric operators, the body the runtime's `static` section binds
 * `Number.isInteger` to ([`fjs/js/runtime`](../../../js/runtime/module.f.js)),
 * and a function a module may import as well, answering alike by
 * construction ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md#2-numberisinteger)).
 *
 * @module
 */

/**
 * Whether `n` is a finite integral number, including both zeros and integers
 * beyond the safe-integer range. Non-numbers are refused without coercion.
 * This is what `Number.isInteger` answers, value for value.
 *
 * @type {(n: unknown) => boolean}
 */
export const isInteger = n => typeof n === 'number' && n % 1 === 0
