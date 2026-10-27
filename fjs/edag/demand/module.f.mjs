/**
 * Ordered first demands before intervening unowned graph work. A matched node
 * establishes its entire computation; later reads of that identity are stable.
 * Function bodies and conditionally selected operands retain their boundaries.
 *
 * @module
 * @import { Exp, ExpOp, Items } from '../types.ts'
 * @import { _Step, _Work } from './private.ts'
 */

import { isSpread } from '../../js/ast/module.f.mjs'

/** @type {(steps: readonly _Step[], tail: _Work | null) => _Work | null} */
const prepend = (steps, tail) => steps.reduceRight((tail, first) => ({ first, tail }), tail)

/** Expansion executes after its operand and before the next item. @type {(items: readonly Items[]) => readonly _Step[]} */
const itemPrefix = items => {
    /** @type {readonly _Step[]} */
    let steps = []
    for (const item of items) {
        if (isSpread(item)) { return [...steps, [item[1]], null] }
        steps = [...steps, [item]]
    }
    return steps
}

/** Eager operands precede each operation's own execution barrier. @type {(node: ExpOp) => readonly _Step[]} */
const prefix = node => {
    /** @type {(values: readonly Exp[]) => readonly _Step[]} */
    const values = values => values.map(value => [value])
    if (node.length === 1 || node[0] === 'arg' || node[0] === 'frame') { return [] }
    if (node[0] === '=>') { return values(node[2]) }
    if (node[0] === ',') { return values(node[1]) }
    if (node[0] === '[]') { return itemPrefix(node[1]) }
    if (node[0] === '{}') {
        /** @type {readonly _Step[]} */
        let steps = []
        for (const entry of node[1]) {
            if (entry[0] === '...') { return [...steps, [entry[1]], null] }
            if (entry[1] instanceof Array) { return [...steps, [entry[1]], null] }
            steps = [...steps, [entry[2]]]
        }
        return steps
    }
    if (node[0] === '()') { return [[node[1]], ...itemPrefix(node[2]), null] }
    if (node[0] === '.' || node[0] === 'memberPresent') { return [[node[1]], [node[2]], null] }
    if (node[0] === '?.' || node[0] === '?.()' || node[0] === '?:') { return [[node[1]], null] }
    if (node[0] === 'instanceof') { return [[node[1]]] }
    if (['!', 'typeof', '===', '!=='].includes(node[0])) { return values(/** @type {readonly Exp[]} */ (node.slice(1))) }
    return [...values(/** @type {readonly Exp[]} */ (node.slice(1))), null]
}

/**
 * Whether graph-node identities are established in the requested order before
 * any intervening unowned work. Already established values stop traversal and
 * satisfy repeated requested identities. Primitive occurrences cannot name a
 * required computation, so a nonempty request containing one is refused.
 *
 * @type {(exp: Exp, required: readonly Exp[], established?: readonly Exp[]) => boolean}
 */
export const demandsInOrder = (exp, required, established = []) => {
    if (required.length === 0) { return true }
    if (required.some(value => !(value instanceof Array))) { return false }
    /** @type {_Work | null} */
    let pending = { first: [exp], tail: null }
    let available = established
    let index = 0
    while (index < required.length && available.some(value => Object.is(value, required[index]))) { ++index }
    if (index === required.length) { return true }
    while (pending !== null) {
        const current = /** @type {_Work} */ (pending)
        const first = current.first
        pending = current.tail
        if (first === null) { return false }
        const node = first[0]
        if (Object.is(node, required[index])) {
            available = [...available, node]
            while (index < required.length && available.some(value => Object.is(value, required[index]))) { ++index }
            if (index === required.length) { return true }
        } else if (!available.some(value => Object.is(value, node)) && node instanceof Array) {
            pending = prepend(prefix(node), pending)
        }
    }
    return false
}
