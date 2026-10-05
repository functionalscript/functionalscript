/**
 * Convert evaluated ordinary objects to primitives, and primitives to strings
 * or numbers. Ordinary object conversion's string hint tries
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
 * Primitive helpers consume only primitive values, including tagged undefined.
 * String conversion is infallible. Numeric coercion is abstract ToNumber:
 * bigint fails, unlike explicit Number(bigint). No represented container or
 * function is passed to a host conversion. Operand evaluation, array/function
 * conversion and operation dispatch remain with callers.
 *
 * @module
 * @import { EdagValue, Primitive, Object as ValueObject } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { call } from '../call/module.f.mjs'
import { findProperty } from '../property/module.f.mjs'
import { untagUndefined } from '../semantics/module.f.mjs'

/** ToString of an evaluated primitive. @type {(value: Primitive) => string} */
export const primitiveToString = value => String(untagUndefined(value))

/** ToNumber, as used by unary plus; bigint is an implicit failure. @type {(value: Primitive) => Result<number, EdagValue>} */
export const primitiveToNumber = value => typeof value === 'bigint'
    ? error(['undefined'])
    : ok(Number(untagUndefined(value)))

/** OrdinaryToPrimitive for represented objects. @type {(value: ValueObject, hint: 'number' | 'string', invoke: Invoke) => Result<Primitive, EdagValue>} */
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
        if (kind === 'error' || !isArray(primitive) || primitive[0] === 'undefined') {
            // The payload guard proves the success type; retain the original
            // result tuple, whose type TypeScript does not narrow with it.
            return /** @type {Result<Primitive, EdagValue>} */ (result)
        }
    }
    return error(['undefined'])
}
