/**
 * `Object.is` on two values, written with the language's own operators, so
 * a module can import it where the `Object` namespace is not admitted
 * ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

import { isNaN_ } from '../../number/is_nan/module.f.js'

/**
 * Whether `a` and `b` are the same value, as `Object.is(a, b)` answers it:
 * SameValue, which is `===` except that `NaN` is itself and `0` is not
 * `-0`. Two values equal under `===` are the same unless they are the two
 * zeros, which `1 / a` tells apart, `1 / -0` being `-Infinity`; nothing
 * but a number zero reaches that test, `0n` included, since `0n !== 0`.
 * Two values unequal under `===` are the same only where both are `NaN`.
 * An array, an object and a function compare by identity, as `===`
 * compares them.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const is = (a, b) => a === b
    ? a !== 0 || 1 / a === 1 / /** @type {0} */ (b)
    : isNaN_(a) && isNaN_(b)
