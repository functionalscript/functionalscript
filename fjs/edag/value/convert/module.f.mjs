/**
 * Primitive conversion of evaluated values. Objects invoke their represented
 * coercion methods; arrays join recursively; functions use the shared source
 * renderer, but a static function, which is the built-in and not its body,
 * and answers the text ECMAScript requires of one, its name's. Values stay
 * represented throughout conversion.
 *
 * @module
 * @import { EdagValue, Primitive } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { assertOk } from '../../../asserts/module.f.js'
import { isArray } from '../../../types/array/module.f.mjs'
import { ok } from '../../../types/result/module.f.js'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { functionText } from '../../../compiler/serializer/module.f.mjs'
import { isStatic, staticText } from '../../module.f.mjs'
import { join } from '../array/module.f.mjs'
import { objectToPrimitive, primitiveToString, primitiveToNumber } from '../coercion/module.f.mjs'

/** @type {(value: EdagValue, hint: 'number' | 'string', invoke: Invoke) => Result<Primitive, EdagValue>} */
export const toPrimitive = (value, hint, invoke) => {
    if (!isArray(value) || value[0] === 'undefined') { return ok(value) }
    if (isStatic(value)) { return ok(staticText(value[0])) }
    switch (value[0]) {
        case '{}': { return objectToPrimitive(value, hint, invoke) }
        case '[]': { return join(value, ',', element => toString(element, invoke)) }
        default: {
            // The writer's table, by node identity, so that a node the body
            // shares is one `const` and two equal nodes are two. Captures
            // are represented by slot names and do not enter the rendered
            // text.
            const table = assertOk(identityAnalysis(value))
            return ok(functionText(table, /** @type {readonly ['#', number]} */ (table.root)[1]))
        }
    }
}

/** @type {(value: EdagValue, invoke: Invoke) => Result<string, EdagValue>} */
export const toString = (value, invoke) => {
    const result = toPrimitive(value, 'string', invoke)
    const [kind, primitive] = result
    return kind === 'error' ? result : ok(primitiveToString(primitive))
}

/** Abstract ToNumber rejects bigint after ordinary conversion. @type {(value: EdagValue, invoke: Invoke) => Result<number, EdagValue>} */
export const toNumber = (value, invoke) => {
    const result = toPrimitive(value, 'number', invoke)
    const [kind, primitive] = result
    return kind === 'error' ? result : primitiveToNumber(primitive)
}

/** ToIntegerOrInfinity of a number ToNumber has answered: truncated, with `NaN` and `-0` as `0`. @type {(value: number) => number} */
export const toIntegerOrInfinity = value => Math.trunc(value) || 0
