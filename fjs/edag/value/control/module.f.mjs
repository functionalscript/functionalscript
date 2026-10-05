/**
 * Stateless control flow over evaluated EDAG values. The first operand is
 * already a Result; remaining operands are thunks evaluated only on demand.
 * Incoming failures and selected results pass through unchanged, preserving
 * value identity. Executors provide operand evaluation.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Error } from '../../../types/result/types.ts'
 * @import { ValueResult, ValueThunk } from './types.ts'
 */

import { error } from '../../../types/result/module.f.mjs'
import { truthy, typeOf } from '../semantics/module.f.mjs'

/** Throws a successful operand's value; propagates an operand failure. @type {(result: ValueResult) => Error<EdagValue>} */
export const throwValue = result => {
    const [kind, value] = result
    return kind === 'error' ? result : error(value)
}

/** `&&`: evaluates the right operand only for a truthy left value. @type {(result: ValueResult, right: ValueThunk) => ValueResult} */
export const and = (result, right) => {
    const [kind, value] = result
    if (kind === 'error') { return result }
    return truthy(value) ? right() : result
}

/** `||`: evaluates the right operand only for a falsy left value. @type {(result: ValueResult, right: ValueThunk) => ValueResult} */
export const or = (result, right) => {
    const [kind, value] = result
    if (kind === 'error') { return result }
    return truthy(value) ? result : right()
}

/** `??`: evaluates the right operand only for null or tagged undefined. @type {(result: ValueResult, right: ValueThunk) => ValueResult} */
export const coalesce = (result, right) => {
    const [kind, value] = result
    if (kind === 'error') { return result }
    return value === null || typeOf(value) === 'undefined' ? right() : result
}

/** `?:`: evaluates exactly the branch selected by a successful condition. @type {(result: ValueResult, consequent: ValueThunk, alternate: ValueThunk) => ValueResult} */
export const conditional = (result, consequent, alternate) => {
    const [kind, value] = result
    if (kind === 'error') { return result }
    return truthy(value) ? consequent() : alternate()
}
