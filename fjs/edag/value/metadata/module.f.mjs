/**
 * Check evaluated value metadata after shape validation: canonical function
 * lengths and unique object keys in JavaScript enumeration order. Successful
 * checks retain the original value and its sharing.
 *
 * Input must be an acyclic, shape-checked value graph. This walk checks data
 * and captures; function bodies remain opaque expressions. Full graph and
 * body admission remain in `../../todo/edag-value.md`.
 *
 * @module
 * @import { EdagValue, Values, Property } from '../types.ts'
 * @import { ValidationError } from '../../../rtti/common/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { arrayIndex } from '../../../js/array_index/module.f.mjs'
import { isIndex, maxLength } from '../../../types/function/length/module.f.mjs'
import { prependPath, verror } from '../../../rtti/common/module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'

/** @type {(values: Values) => Result<Values, ValidationError>} */
const validateValues = values => {
    for (let i = 0; i < values.length; i += 1) {
        const r = validateMetadata(values[i])
        if (r[0] === 'error') { return prependPath(String(i), r) }
    }
    return ok(values)
}

/** @type {(properties: readonly Property[]) => Result<readonly Property[], ValidationError>} */
const validateProperties = properties => {
    const keys = properties.map(([, key]) => key)
    let previousIndex = -1
    let ordinary = false
    for (let i = 0; i < properties.length; i += 1) {
        const [, key, value] = properties[i]
        if (keys.indexOf(key) !== i) {
            return prependPath(String(i), prependPath('1', verror('duplicate object property')))
        }
        const index = arrayIndex(key)
        if (index === null) { ordinary = true }
        else {
            if (ordinary || index <= previousIndex) {
                return prependPath(String(i), prependPath('1', verror('object properties are not in enumeration order')))
            }
            previousIndex = index
        }
        const r = validateMetadata(value)
        if (r[0] === 'error') { return prependPath(String(i), prependPath('2', r)) }
    }
    return ok(properties)
}

/** Checks evaluated metadata only; requires shape-checked, acyclic input. @type {(value: EdagValue) => Result<EdagValue, ValidationError>} */
export const validateMetadata = value => {
    if (!(value instanceof Array)) { return ok(value) }
    switch (value[0]) {
        case '[]': {
            const r = validateValues(value[1])
            return r[0] === 'error' ? prependPath('1', r) : ok(value)
        }
        case '{}': {
            const r = validateProperties(value[1])
            return r[0] === 'error' ? prependPath('1', r) : ok(value)
        }
        case '=>': {
            if (!isIndex(value[1]) || value[1] > maxLength) {
                return prependPath('1', verror('invalid function length'))
            }
            const r = validateValues(value[2])
            return r[0] === 'error' ? prependPath('2', r) : ok(value)
        }
        default: { return ok(value) }
    }
}
