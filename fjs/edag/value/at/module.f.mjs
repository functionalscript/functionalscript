/**
 * Relative indexing of evaluated arrays and strings with primitive indices.
 * Abstract ToNumber rejects bigint, even for empty receivers. Indexing
 * truncates fractions toward zero, counts negative indices from the end,
 * and returns tagged undefined out of range. Array elements keep their
 * identities; strings yield UTF-16 code units.
 *
 * Callers own method dispatch, operand evaluation, failure propagation and
 * conversion of nonprimitive indices, using the number hint for ordinary
 * objects. Receivers satisfy the array/string contract by construction.
 *
 * @module
 * @import { Array as ValueArray, Primitive } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 */

import { ok } from '../../../types/result/module.f.mjs'
import { primitiveToNumber } from '../coercion/module.f.mjs'

/** Array.at and String.at over represented receivers. @type {(receiver: ValueArray | string, index: Primitive) => ValueResult} */
export const at = (receiver, index) => {
    const numeric = primitiveToNumber(index)
    const [kind, number] = numeric
    if (kind === 'error') { return numeric }
    const values = typeof receiver === 'string' ? receiver : receiver[1]
    const value = values.at(number)
    return ok(value === undefined ? ['undefined'] : value)
}
