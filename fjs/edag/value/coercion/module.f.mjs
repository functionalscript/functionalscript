/**
 * Convert an evaluated ordinary object to a primitive. The string hint tries
 * toString before valueOf; the number hint reverses that order. Callers use
 * the number hint for the default conversion of an ordinary object.
 *
 * An own property shadows the stock method, even when it is noncallable.
 * Missing valueOf returns the object and contributes no primitive; missing
 * toString answers "[object Object]". A represented method is called with
 * no arguments through the executor's invoker. The first primitive result
 * or failure returns unchanged; a container/function result moves on to the
 * next method without further conversion. Exhaustion fails with tagged
 * undefined. Evaluated object invariants are trusted.
 *
 * This leaf handles ordinary objects. Operand evaluation, array/function
 * conversion and conversion of the resulting primitive belong to callers.
 *
 * @module
 * @import { Object as ValueObject } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { call } from '../call/module.f.mjs'
import { findProperty } from '../property/module.f.mjs'

/** OrdinaryToPrimitive for represented objects. @type {(value: ValueObject, hint: 'number' | 'string', invoke: Invoke) => ValueResult} */
export const objectToPrimitive = (value, hint, invoke) => {
    const order = hint === 'string' ? ['toString', 'valueOf'] : ['valueOf', 'toString']
    for (const name of order) {
        const property = findProperty(value, name)
        if (property === undefined) {
            if (name === 'toString') { return ok('[object Object]') }
            continue
        }
        const [, , method] = property
        if (!isArray(method) || method[0] !== '=>') { continue }
        const result = call(ok(method), [], invoke)
        const [kind, primitive] = result
        if (kind === 'error' || !isArray(primitive) || primitive[0] === 'undefined') { return result }
    }
    return error(['undefined'])
}
