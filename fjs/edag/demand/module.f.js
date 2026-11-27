/**
 * Ordered first demands before intervening unowned graph work. A matched or
 * completed node establishes its guaranteed eager dependencies, including
 * operands past execution barriers it has already crossed.
 * Function bodies and conditionally selected operands retain their boundaries.
 *
 * @module
 * @import { Exp, ExpOp, Items } from '../types.ts'
 * @import { _Step, _Work } from './private.ts'
 * @import { RefMap } from '../../types/ref_map/types.ts'
 */

import { isSpread } from '../../js/ast/module.f.js'
import { eagerOperandsOf } from '../sharing/module.f.js'
import { empty } from '../../types/ref_map/module.f.js'

/** Only graph-node references can name established computations. @type {(value: unknown) => (available: RefMap) => boolean} */
const known = value => available => value instanceof Array && available(value)[0] === true

/** @type {<T>(steps: readonly T[], tail: _Work<T> | null) => _Work<T> | null} */
const prepend = (steps, tail) => steps.reduceRight((tail, first) => ({ first, tail }), tail)

/**
 * The items in order, a spread as its operand. Expansion is no barrier: once
 * it completes, the items after it are evaluated, so establishing one of them
 * first changes only which failure is met first
 * ([spec: failure is one outcome](../../../spec/principles/README.md#failure-is-one-outcome)).
 *
 * @type {(items: readonly Items[]) => readonly _Step[]}
 */
const itemPrefix = items => items.map(item => [isSpread(item) ? item[1] : item])

/** Eager operands precede each operation's own execution barrier. @type {(node: ExpOp, selected: readonly (readonly [Exp, boolean])[]) => readonly _Step[]} */
const prefix = (node, selected) => {
    /** @type {(values: readonly Exp[]) => readonly _Step[]} */
    const values = values => values.map(value => [value])
    if (node.length === 1 || node[0] === 'arg' || node[0] === 'frame' || node[0] === 'self') { return [] }
    if (node[0] === 'fn') { return [[node[1]]] }
    if (node[0] === 'group') { return values(node[1]) }
    if (node[0] === '=>') { return values(node[2]) }
    if (node[0] === ',') { return values(node[1]) }
    if (node[0] === '[]') { return itemPrefix(node[1]) }
    if (node[0] === '{}') {
        // a spread and a computed key's conversion are no barriers, as an
        // array's expansion is none
        return node[1].flatMap(entry => entry[0] === '...' ? values([entry[1]])
            : entry[1] instanceof Array ? values([entry[1], entry[2]]) : values([entry[2]]))
    }
    if (node[0] === '()') { return [[node[1]], ...itemPrefix(node[2]), null] }
    // a member call's arguments follow its lookup whenever the lookup
    // completes, so the lookup is no barrier before them
    if (node[0] === '.' && node.length === 4 && node[3][0] === '|()' && node[3].length === 2) { return [[node[1]], [node[2]], ...itemPrefix(node[3][1]), null] }
    if (node[0] === '.' || node[0] === 'memberPresent') { return [[node[1]], [node[2]], null] }
    if (node[0] === '?:') {
        const known = selected.findLast(([test]) => Object.is(test, node[1]))
        return known === undefined ? [[node[1]], null] : [[node[1]], [node[Number(known[1] ? 2 : 3)]]]
    }
    if (node[0] === '?.' || node[0] === '?.()') { return [[node[1]], null] }
    if (node[0] === 'instanceof') { return [[node[1]]] }
    // the key is a spelling; the check can throw, on a primitive
    if (node[0] === 'in') { return [[node[2]], null] }
    if (['!', 'typeof', '===', '!=='].includes(node[0])) { return values(/** @type {readonly Exp[]} */ (node.slice(1))) }
    return [...values(/** @type {readonly Exp[]} */ (node.slice(1))), null]
}

/** Completed parents establish their guaranteed eager dependencies. @type {(available: RefMap, values: readonly unknown[]) => RefMap} */
const establish = (available, values) => {
    let pending = prepend(values, null)
    while (pending !== null) {
        const { first: node, tail } = pending
        pending = tail
        if (!(node instanceof Array) || known(node)(available)) { continue }
        available = available(node, true)[1]
        pending = prepend(eagerOperandsOf(node), pending)
    }
    return available
}

/** A requested suffix after already completed values. @type {(exp: Exp, required: readonly Exp[], index: number, available: RefMap, selected: readonly (readonly [Exp, boolean])[]) => boolean} */
const demandsFrom = (exp, required, index, available, selected) => {
    /** @type {_Work | null} */
    let pending = { first: [exp], tail: null }
    while (index < required.length && known(required[Number(index)])(available)) { index += 1 }
    if (index === required.length) { return true }
    while (pending !== null) {
        const current = /** @type {_Work} */ (pending)
        const first = current.first
        pending = current.tail
        if (first === null) { return false }
        const node = first[0]
        if (Object.is(node, required[Number(index)])) {
            available = establish(available, [node])
            while (index < required.length && known(required[Number(index)])(available)) { index += 1 }
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
        available = establish(available, [required[Number(index)]])
        index += 1
    }
    return index
}
