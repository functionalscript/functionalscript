/**
 * Common Foundation AST operations and resolved binding analysis.
 * Source admission, graph construction and serialization own their policies;
 * this module records the identities and facts those stages share.
 *
 * @module
 *
 * @import { Binding, BindingId, BindingEvent, BindingScope, FunctionTarget, Item, Key, Operator, Step } from './types.ts'
 * @import { List, Result as ListResult } from '../../types/list/types.ts'
 */

import { concat, next, reverse, toArray } from '../../types/list/module.f.mjs'

/**
 * Reassignment and nested references over the complete expanded source scope.
 * Initializations do not count as writes. A region is no capture boundary;
 * an ordinary nested source function is. No reachability optimization runs here.
 *
 * @type {(root: BindingScope) => readonly Binding[]}
 */
export const analyzeBindings = root => {
    /** @type {List<{ id: BindingId, owner: FunctionTarget }>} */
    let declarations = root.bindings.map(id => ({ id, owner: root.target }))
    /** @type {List<{ id: BindingId, scope: FunctionTarget, write: boolean }>} */
    let references = null
    /** @type {List<{ scope: FunctionTarget, event: BindingEvent }>} */
    let pending = root.events.map(event => ({ scope: root.target, event }))
    while (true) {
        /** @type {ListResult<{ scope: FunctionTarget, event: BindingEvent }>} */
        const item = next(pending)
        if (item === null) { break }
        /** @type {BindingEvent} */
        const event = item.first.event
        const scope = item.first.scope
        const rest = item.tail
        if (event[0] === 'function') {
            /** @type {BindingScope} */
            const child = event[1]
            declarations = concat(declarations)(child.bindings.map(id => ({ id, owner: child.target })))
            pending = concat(child.events.map(event => ({ scope: child.target, event })))(rest)
            continue
        }
        if (event[0] === 'region') {
            pending = concat(event[1].map(event => ({ scope, event })))(rest)
            continue
        }
        if (event[0] !== 'initialize') {
            references = { first: { id: event[1], scope, write: event[0] === 'write' }, tail: references }
        }
        pending = rest
    }
    const ordered = toArray(declarations)
    const positions = new Map(ordered.map(({ id }, position) => [id, position]))
    // Stable grouping keeps each binding's source reference order. References
    // to declarations outside this scope sort after every declaration here.
    const grouped = toArray(reverse(references)).map(reference => ({
        ...reference, position: positions.get(reference.id) ?? ordered.length,
    })).toSorted((a, b) => a.position - b.position)
    let cursor = 0
    /** @type {List<Binding>} */
    let facts = null
    for (const [position, { id, owner }] of ordered.entries()) {
        let isMutable = false
        /** @type {List<FunctionTarget>} */
        let captures = null
        while (cursor < grouped.length && grouped[cursor].position === position) {
            const reference = grouped[cursor]
            isMutable = isMutable || reference.write
            if (reference.scope !== owner) { captures = { first: reference.scope, tail: captures } }
            cursor += 1
        }
        facts = { first: { id, isMutable, capturedBy: [...new Set(toArray(reverse(captures)))] }, tail: facts }
    }
    return toArray(reverse(facts))
}

/**
 * The spread tag belongs to item lists, never to an ordinary operand.
 *
 * @template T
 * @param {Item<T>} item
 * @returns {item is readonly ['...', T]}
 */
const isSpread = item => item instanceof Array && item[0] === '...'

/** @type {<T, U>(map: (value: T, index: number) => U, offset: number) => (item: Item<T>, index: number) => Item<U>} */
const mapItem = (map, offset) => (item, index) => isSpread(item) ? ['...', map(item[1], offset + index)] : map(item, offset + index)

/** @type {<T, U>(map: (value: T, index: number) => U, index: number) => (key: Key<T>) => Key<U>} */
const mapKey = (map, index) => key => key instanceof Array ? ['Number', map(key[1], index)] : key

/** @type {<T, U>(map: (value: T, index: number) => U, offset: number) => (step: Step<T>) => Step<U>} */
const mapStep = (map, offset) => step => {
    if (step[0] === '|.') {
        const key = mapKey(map, offset)(step[1])
        return step.length === 2 ? ['|.', key] : ['|.', key, mapStep(map, offset + keyOperands(step[1]).length)(step[2])]
    }
    const items = step[1].map(mapItem(map, offset))
    if (step[0] === '|!()') { return ['|!()', items] }
    return step.length === 2 ? [step[0], items] : [step[0], items, mapStep(map, offset + items.length)(step[2])]
}

/**
 * Map value operands once, retaining operation metadata and chain structure.
 * The callback index is the operand's position in operatorOperands, including
 * repeated equal operands. This does not establish values or move regions.
 *
 * @type {<T, U>(map: (value: T, index: number) => U) => (operator: Operator<T>) => Operator<U>}
 */
export const mapOperator = map => operator => {
    if (operator.length === 1) { return operator }
    switch (operator[0]) {
        case 'array': { return ['array', operator[1].map(mapItem(map, 0))] }
        case 'object': {
            const entries = operator[1].map((entry, index, entries) => {
                const offset = entries.slice(0, index).reduce((count, previous) => count + (previous[0] === '...' ? 1 : 2), 0)
                return entry[0] === '...' ? /** @type {const} */ (['...', map(entry[1], offset)]) : /** @type {const} */ ([':', map(entry[1], offset), map(entry[2], offset + 1)])
            })
            return ['object', entries]
        }
        case ',': { return [',', operator[1].map(map)] }
        case '()': { return ['()', map(operator[1], 0), operator[2].map(mapItem(map, 1))] }
        case '.':
        case '?.': {
            const base = map(operator[1], 0)
            const key = mapKey(map, 1)(operator[2])
            return operator.length === 3 ? [operator[0], base, key] : [operator[0], base, key, mapStep(map, 1 + keyOperands(operator[2]).length)(operator[3])]
        }
        case '?.()': {
            const base = map(operator[1], 0)
            const items = operator[2].map(mapItem(map, 1))
            return operator.length === 3 ? ['?.()', base, items] : ['?.()', base, items, mapStep(map, 1 + items.length)(operator[3])]
        }
        case 'instanceof': { return ['instanceof', map(operator[1], 0), operator[2]] }
        case '?:': { return ['?:', map(operator[1], 0), map(operator[2], 1), map(operator[3], 2)] }
        case '+':
        case '-': { return operator.length === 2 ? [operator[0], map(operator[1], 0)] : [operator[0], map(operator[1], 0), map(operator[2], 1)] }
        case '~':
        case '!':
        case 'typeof':
        case 'Number':
        case 'String': { return [operator[0], map(operator[1], 0)] }
        default: { return [operator[0], map(operator[1], 0), map(operator[2], 1)] }
    }
}

/** @type {<T>(key: Key<T>) => readonly T[]} */
const keyOperands = key => key instanceof Array ? [key[1]] : []

/** @type {<T>(item: Item<T>) => T} */
const itemOperand = item => isSpread(item) ? item[1] : item

/**
 * @template T
 * @param {Step<T> | undefined} step
 * @returns {readonly T[]}
 */
const stepOperands = step => {
    /** @type {(item: Item<T>) => T} */
    const operand = itemOperand
    /** @type {readonly T[]} */
    let result = []
    let current = step
    while (current !== undefined) {
        result = [...result, ...(current[0] === '|.' ? keyOperands(current[1]) : current[1].map(operand))]
        current = current[2]
    }
    return result
}

/**
 * The immediate value operands, in stable source operand order. This includes
 * lazy operands without making them eager, and excludes names, tags and indices.
 *
 * @template T
 * @param {Operator<T>} operator
 * @returns {readonly T[]}
 */
export const operatorOperands = operator => {
    /** @type {(item: Item<T>) => T} */
    const operand = itemOperand
    // Explicit generic specialization keeps inference from choosing Item<T>
    // for the recursive chain union. This is the declared helper at T.
    const continuation = /** @type {typeof stepOperands<T>} */ (stepOperands)
    if (operator.length === 1) { return [] }
    switch (operator[0]) {
        case 'array': { return operator[1].map(operand) }
        case 'object': { return operator[1].flatMap(entry => entry[0] === '...' ? [entry[1]] : [entry[1], entry[2]]) }
        case ',': { return operator[1] }
        case '()': { return [operator[1], ...operator[2].map(operand)] }
        case '.':
        case '?.': { return [operator[1], ...keyOperands(operator[2]), ...(operator.length === 4 ? continuation(operator[3]) : [])] }
        case '?.()': { return [operator[1], ...operator[2].map(operand), ...(operator.length === 4 ? continuation(operator[3]) : [])] }
        case 'instanceof': { return [operator[1]] }
        case '?:': { return [operator[1], operator[2], operator[3]] }
        case '+':
        case '-': { return operator.length === 2 ? [operator[1]] : [operator[1], operator[2]] }
        case '~':
        case '!':
        case 'typeof':
        case 'Number':
        case 'String': { return [operator[1]] }
        default: { return [operator[1], operator[2]] }
    }
}
