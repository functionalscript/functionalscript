/**
 * Ordered first demands before intervening unowned graph work. A matched or
 * completed node establishes its guaranteed eager dependencies, including
 * operands past execution barriers it has already crossed.
 * Function bodies and conditionally selected operands retain their boundaries.
 *
 * @module
 * @import { Exp, ExpOp, Items } from '../types.ts'
 * @import { _Step, _Work } from './private.ts'
 * @import { PersistentSet } from '../../types/set/types.ts'
 */

import { isSpread } from '../../js/ast/module.f.mjs'
import { eagerOperandsOf } from '../sharing/module.f.mjs'
import { add, empty, has } from '../../types/set/module.f.mjs'

/** @type {(value: unknown) => (set: PersistentSet<unknown>) => boolean} */
const known = has

/** @type {(value: unknown) => (set: PersistentSet<unknown>) => PersistentSet<unknown>} */
const include = add

/** @type {<T>(steps: readonly T[], tail: _Work<T> | null) => _Work<T> | null} */
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

/** Eager operands precede each operation's own execution barrier. @type {(node: ExpOp, selected: readonly (readonly [Exp, boolean])[]) => readonly _Step[]} */
const prefix = (node, selected) => {
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
    if (node[0] === '?:') {
        const known = selected.findLast(([test]) => Object.is(test, node[1]))
        return known === undefined ? [[node[1]], null] : [[node[1]], [node[known[1] ? 2 : 3]]]
    }
    if (node[0] === '?.' || node[0] === '?.()') { return [[node[1]], null] }
    if (node[0] === 'instanceof') { return [[node[1]]] }
    // the key is a spelling; the check can throw, on a primitive
    if (node[0] === 'in') { return [[node[2]], null] }
    if (['!', 'typeof', '===', '!=='].includes(node[0])) { return values(/** @type {readonly Exp[]} */ (node.slice(1))) }
    return [...values(/** @type {readonly Exp[]} */ (node.slice(1))), null]
}

/** Completed parents establish their guaranteed eager dependencies. @type {(available: PersistentSet<unknown>, values: readonly unknown[]) => PersistentSet<unknown>} */
const establish = (available, values) => {
    let pending = prepend(values, null)
    while (pending !== null) {
        const { first: node, tail } = pending
        pending = tail
        if (!(node instanceof Array) || known(node)(available)) { continue }
        available = include(node)(available)
        pending = prepend(eagerOperandsOf(node), pending)
    }
    return available
}

/** A requested suffix after already completed values. @type {(exp: Exp, required: readonly Exp[], index: number, available: PersistentSet<unknown>, selected: readonly (readonly [Exp, boolean])[]) => boolean} */
const demandsFrom = (exp, required, index, available, selected) => {
    /** @type {_Work | null} */
    let pending = { first: [exp], tail: null }
    while (index < required.length && known(required[index])(available)) { index += 1 }
    if (index === required.length) { return true }
    while (pending !== null) {
        const current = /** @type {_Work} */ (pending)
        const first = current.first
        pending = current.tail
        if (first === null) { return false }
        const node = first[0]
        if (Object.is(node, required[index])) {
            available = establish(available, [node])
            while (index < required.length && known(required[index])(available)) { index += 1 }
            if (index === required.length) { return true }
        } else if (!known(node)(available) && node instanceof Array) {
            pending = prepend(prefix(node, selected), pending)
        }
    }
    return false
}

/**
 * Whether graph-node identities are established in the requested order before
 * any intervening unowned work. Already established values stop traversal and
 * satisfy repeated requested identities, including their guaranteed eager
 * dependencies. Primitive occurrences cannot name a required computation,
 * so a nonempty request containing one is refused.
 *
 * Selected facts name tests already evaluated on the current control path.
 * They permit only that exact conditional's selected operand, not other lazy
 * operations or a condition with merely equal structure.
 *
 * @type {(exp: Exp, required: readonly Exp[], established?: readonly Exp[], selected?: readonly (readonly [Exp, boolean])[]) => boolean}
 */
export const demandsInOrder = (exp, required, established = [], selected = []) => {
    if (required.length === 0) { return true }
    if (required.some(value => !(value instanceof Array))) { return false }
    return demandsFrom(exp, required, 0, establish(empty, [...established, ...selected.map(([test]) => test)]), selected)
}

/**
 * Length of the shortest required prefix whose remaining suffix is demanded in
 * order by the result. Retained roots establish their eager dependencies once;
 * unsuccessful demand trials keep their newly matched values local. Primitive
 * occurrences remain in the prefix because they cannot name computations.
 * Previously completed roots supply the same eager-dependency guarantee as
 * the optional established values accepted by demandsInOrder.
 *
 * @type {(exp: Exp, required: readonly Exp[], established?: readonly Exp[], selected?: readonly (readonly [Exp, boolean])[]) => number}
 */
export const requiredPrefixLength = (exp, required, established = [], selected = []) => {
    let index = required.reduce((/** @type {number} */ start, value, at) => value instanceof Array ? start : at + 1, 0)
    if (index === required.length) { return index }
    let available = establish(establish(empty, [...established, ...selected.map(([test]) => test)]), required.slice(0, index))
    while (!demandsFrom(exp, required, index, available, selected)) {
        available = establish(available, [required[index]])
        index += 1
    }
    return index
}
