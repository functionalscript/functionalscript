/**
 * Expose one returned value's terminal evaluation regions. This records no
 * function or loop transfer: each consumer supplies its own completion owner.
 * Prefix operands remain required, and ordinary function values stay opaque.
 *
 * @module
 * @import { Statement, Value } from '../../types.ts'
 * @import { _TailRegion } from './private.ts'
 */

/** @type {(value: Value, index?: number) => _TailRegion} */
export const _tailRegion = (value, index = 0) => {
    if (!(value instanceof Array)) { return { kind: 'value', value } }
    if (value[0] === 'block') { return { kind: 'block', block: value[1] } }
    if (value[0] === 'if') { return { kind: 'if', test: value[1], then: value[2], otherwise: value[3] } }
    if (value[0] === '?:') {
        return { kind: 'if', test: value[1], then: { statements: [], exit: ['yield', [value[2]]] }, otherwise: { statements: [], exit: ['yield', [value[3]]] } }
    }
    if (value[0] === ',' && value[1].length !== 0) {
        return { kind: 'block', block: {
            statements: value[1].slice(0, -1).map(/** @returns {Statement} */ initializer => ['define', { index }, initializer, 'required']),
            exit: ['yield', [value[1].at(-1)]],
        } }
    }
    return { kind: 'value', value }
}
