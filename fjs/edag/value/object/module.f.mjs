/**
 * Construct evaluated EDAG objects from deferred properties and spreads.
 * Each property thunk resolves its key to a string before its value; key
 * conversion belongs to the caller. Items evaluate left to right, stopping
 * at the first failure and returning it unchanged.
 *
 * Spreads copy own enumerable properties from represented objects, arrays
 * and strings. String properties contain UTF-16 code units. Other values
 * contribute no properties. Property values retain their identities.
 *
 * Construction creates a fresh object with unique keys in JavaScript
 * enumeration order. Later definitions replace values without moving an
 * ordinary key's first insertion position; '__proto__' is a data key.
 * Operands supply valid EdagValue forms.
 *
 * @module
 * @import { EdagValue, Property, Object as ValueObject } from '../types.ts'
 * @import { ObjectItems } from './types.ts'
 * @import { Entry } from '../../../types/object/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { mapOk, ok } from '../../../types/result/module.f.mjs'

const { entries, fromEntries } = Object

/** Represent decoded string-key entries as properties. @type {(items: readonly Entry<EdagValue>[]) => readonly Property[]} */
const propertiesFromEntries = items => items.map(([key, value]) => [':', key, value])

/** Decode the own enumerable properties contributed by a spread. @type {(value: EdagValue) => readonly Property[]} */
const spreadProperties = value => {
    if (typeof value === 'string') { return propertiesFromEntries(entries(value)) }
    if (isArray(value)) {
        const [tag, items] = value
        if (tag === '{}') { return items }
        if (tag === '[]') { return propertiesFromEntries(entries(items)) }
    }
    return []
}

/** Build an object from deferred string-key properties and spreads. @type {(items: ObjectItems) => Result<ValueObject, EdagValue>} */
export const object = items => {
    /** @type {readonly Property[]} */
    let properties = []
    for (const item of items) {
        const result = typeof item === 'function'
            ? mapOk((/** @type {Property} */ property) => [property])(item())
            : mapOk(spreadProperties)(item[1]())
        const [kind, resolved] = result
        if (kind === 'error') { return result }
        properties = [...properties, ...resolved]
    }
    const normalized = entries(fromEntries(properties.map(([, key, value]) => [key, value])))
    return ok(['{}', propertiesFromEntries(normalized)])
}
