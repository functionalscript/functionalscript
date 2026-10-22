/**
 * Source logical syntax as one established left value and conditional regions.
 * The whole result stays at the original expression occurrence; no generated
 * function or physical slot is involved.
 *
 * @module
 *
 * @import { Block, Value } from '../../types.ts'
 * @import { LogicalTag } from '../source.ts'
 */

/** @type {(value: Value) => Block} */
const yielded = value => ({ statements: [], exit: ['yield', [value]] })

/** A nullish test uses the primitive undefined value, never a source name. @type {(tag: LogicalTag, read: Value, right: Value) => Value} */
const choice = (tag, read, right) => {
    const condition = tag === '??' ? /** @type {Value} */ (['if', ['===', read, null], yielded(true), yielded(['===', read, undefined])]) : read
    return ['if', condition, yielded(tag === '||' ? read : right), yielded(tag === '||' ? right : read)]
}

/**
 * An established left reference can be reused. Every other left operand gets
 * a fresh immutable identity, required within this expression's own region.
 * Conditional selection returns the operand itself, including its identity.
 *
 * @type {(tag: LogicalTag, left: Value, right: Value) => Value}
 */
export const logicalValue = (tag, left, right) => {
    if (left instanceof Array && left[0] === 'ref') { return choice(tag, left, right) }
    const id = { index: 0 }
    return ['block', { statements: [['define', id, left, 'required']], exit: ['yield', [choice(tag, ['ref', id], right)]] }]
}
