/**
 * Stateless control flow over evaluated EDAG values. Branching helpers take
 * an evaluated first operand and demand further thunks only when selected.
 * Sequences evaluate all operands in order until one fails. Failures and
 * selected results pass through unchanged, preserving value identity.
 * Executors provide operand evaluation.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Error } from '../../../types/result/types.ts'
 * @import { ValueResult, ValueThunk } from './types.ts'
 */

import { error, ok } from '../../../types/result/module.f.mjs'
import { truthy, typeOf } from '../semantics/module.f.mjs'

/**
 * Comma/sequence evaluation: earlier operands run even though their values
 * are discarded. Preserve the first failure or last success unchanged;
 * an empty sequence succeeds with tagged undefined.
 * @type {(operands: readonly ValueThunk[]) => ValueResult}
 */
export const sequence = operands => {
    /** @type {ValueResult} */
    let result = ok(['undefined'])
    for (const operand of operands) {
        result = operand()
        const [kind] = result
        if (kind === 'error') { return result }
    }
    return result
}

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
