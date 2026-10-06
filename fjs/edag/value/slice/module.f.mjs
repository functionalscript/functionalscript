/**
 * Slice evaluated arrays and strings using primitive bounds. Bounds apply
 * abstract ToNumber from start to end; tagged undefined as the end means
 * the receiver's length. Bigint bounds fail even for empty receivers or
 * ranges. Fractions truncate toward zero and negative bounds count from
 * the end, clamped to the receiver's length.
 *
 * Every array result is a fresh value retaining the selected element
 * identities. Strings are sliced by UTF-16 code unit. Callers own method
 * dispatch, operand evaluation, failure propagation and conversion of
 * nonprimitive bounds, using the number hint for ordinary objects.
 *
 * @module
 * @import { Array as ValueArray, Primitive, EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { ok } from '../../../types/result/module.f.mjs'
import { primitiveToNumber } from '../coercion/module.f.mjs'
import { untagUndefined } from '../semantics/module.f.mjs'

/** Tagged undefined represents an omitted bound. @type {(receiver: ValueArray | string, start: Primitive, end: Primitive) => Result<ValueArray | string, EdagValue>} */
export const slice = (receiver, start, end) => {
    const startResult = primitiveToNumber(start)
    const [startKind, first] = startResult
    if (startKind === 'error') { return startResult }
    const endResult = untagUndefined(end) === undefined ? ok(undefined) : primitiveToNumber(end)
    const [endKind, last] = endResult
    if (endKind === 'error') { return endResult }
    return ok(typeof receiver === 'string'
        ? receiver.slice(first, last)
        : ['[]', receiver[1].slice(first, last)])
}
