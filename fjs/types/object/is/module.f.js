/**
 * `Object.is` on two values, written with the language's own operators, so
 * a module can import it where the `Object` namespace is not admitted
 * ([`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)).
 *
 * @module
 */

import { isNaN_ } from '../../number/is_nan/module.f.js'
import { isNegativeZero } from '../../number/is_negative_zero/module.f.js'

/**
 * Whether `a` and `b` are the same value, as `Object.is(a, b)` answers it:
 * SameValue, which is `===` except on the two values `===` reads the other
 * way. Two values equal under `===` are the same unless one is `-0` and
 * the other is not, and two values unequal under `===` are the same only
 * where both are `NaN`. An array, an object and a function compare by
 * identity, as `===` compares them.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
export const is = (a, b) => a === b
    ? isNegativeZero(a) === isNegativeZero(b)
    : isNaN_(a) && isNaN_(b)
