/**
 * Check evaluated object metadata after shape validation: unique keys in
 * JavaScript enumeration order. Successful checks retain the original value
 * and its sharing.
 *
 * Validated nodes are remembered by identity across data and captures, so
 * a shared subtree is checked once. Object keys use the same persistent set
 * instead of repeatedly scanning the property's prefix.
 *
 * Input must be a shape-checked value graph. This walk checks data and
 * captures; function bodies remain opaque expressions. Function lengths,
 * bindings and body scopes belong to `../closure/module.f.mjs`.
 *
 * @module
 * @import { EdagValue, Values, Property } from '../types.ts'
 * @import { ValidationError } from '../../../rtti/common/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { PersistentSet } from '../../../types/set/types.ts'
 * @import { _Node, _Visited } from './private.ts'
 */

import { arrayIndex } from '../../../js/array_index/module.f.mjs'
import { prependPath, verror } from '../../../rtti/common/module.f.mjs'
import { mapOk, ok } from '../../../types/result/module.f.mjs'
import { add, empty, has } from '../../../types/set/module.f.mjs'

/** @type {(values: Values, visited: _Visited) => Result<_Visited, ValidationError>} */
const validateValues = (values, visited) => {
    for (let i = 0; i < values.length; i += 1) {
        const r = validateValue(values[i], visited)
        const [kind, next] = r
        if (kind === 'error') { return prependPath(String(i), r) }
        visited = next
    }
    return ok(visited)
}

/** @type {(properties: readonly Property[], visited: _Visited) => Result<_Visited, ValidationError>} */
const validateProperties = (properties, visited) => {
    /** @type {PersistentSet<string>} */
    let keys = empty
    let previousIndex = -1
    let ordinary = false
    for (let i = 0; i < properties.length; i += 1) {
        const [, key, value] = properties[i]
        if (has(key)(keys)) {
            return prependPath(String(i), prependPath('1', verror('duplicate object property')))
        }
        keys = add(key)(keys)
        const index = arrayIndex(key)
        if (index === null) { ordinary = true }
        else {
            if (ordinary || index <= previousIndex) {
                return prependPath(String(i), prependPath('1', verror('object properties are not in enumeration order')))
            }
            previousIndex = index
        }
        const r = validateValue(value, visited)
        const [kind, next] = r
        if (kind === 'error') { return prependPath(String(i), prependPath('2', r)) }
        visited = next
    }
    return ok(visited)
}

/**
 * Checks a fresh node's evaluated object properties, leaving its body opaque.
 * @type {(value: _Node, visited: _Visited) => Result<_Visited, ValidationError>}
 */
const validateNode = (value, visited) => {
    switch (value[0]) {
        case '[]': {
            const r = validateValues(value[1], visited)
            return r[0] === 'error' ? prependPath('1', r) : r
        }
        case '{}': {
            const r = validateProperties(value[1], visited)
            return r[0] === 'error' ? prependPath('1', r) : r
        }
        case '=>': {
            const r = validateValues(value[2], visited)
            return r[0] === 'error' ? prependPath('2', r) : r
        }
        default: { return ok(visited) }
    }
}

/**
 * Remembers successfully checked nodes by identity, threading the set across siblings.
 * @type {(value: EdagValue, visited: _Visited) => Result<_Visited, ValidationError>}
 */
const validateValue = (value, visited) => {
    if (!(value instanceof Array) || has(value)(visited)) { return ok(visited) }
    return mapOk(add(value))(validateNode(value, visited))
}

/** Checks evaluated object metadata only; requires shape-checked input. @type {(value: EdagValue) => Result<EdagValue, ValidationError>} */
export const validateMetadata = value => mapOk(() => value)(validateValue(value, empty))
