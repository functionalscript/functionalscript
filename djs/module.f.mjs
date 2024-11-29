import list, * as List from '../types/list/module.f.mjs'
const { flat, map } = list
import string from '../types/string/module.f.mjs'
const { concat } = string
import object, * as O from '../types/object/module.f.mjs'
import f from '../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import bi from '../types/bigint/module.f.mjs'
const { serialize: bigintSerialize } = bi
import j from '../json/serializer/module.f.mjs'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = j

/**
 * @typedef {{
 *  readonly [k in string]: Unknown
 * }} Object
 */

/** @typedef {readonly Unknown[]} Array */

/** @typedef {Object|boolean|string|number|null|Array|bigint} Unknown */

const colon = [':']

/** @typedef {O.Entry<Unknown>} Entry*/

/** @typedef {(List.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Unknown) => List.List<string>} */
const serialize = sort => {
    /** @type {(kv: readonly[string, Unknown]) => List.List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: Object) => List.List<string>} */
    const objectSerialize = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    /** @type {(value: Unknown) => List.List<string>} */
    const f = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return [bigintSerialize(value)] }
            default: {
                if (value === null) { return nullSerialize }
                if (value instanceof Array) { return arraySerialize(value) }
                return objectSerialize(value)
            }
        }
    }
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 *
 * @type {(mapEntries: MapEntries) => (value: Unknown) => string}
 */
const stringify = sort => compose(serialize(sort))(concat)

export default {
    /** @readonly */
    stringify,
    /** @readonly */
    serialize,
}
