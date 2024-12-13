// @ts-self-types="./module.f.d.mts"
import * as list from '../types/list/module.f.mjs'
const { next, flat, map } = list
import * as string  from '../types/string/module.f.mjs'
const { concat } = string
import * as object from '../types/object/module.f.mjs'
const { at } = object
import * as f from '../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import * as s from './serializer/module.f.mjs'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = s

/**
 * @typedef {{
 *  readonly [k in string]: Unknown
 * }} Object
 */

/** @typedef {readonly Unknown[]} Array */

/** @typedef {Object|boolean|string|number|null|Array} Unknown */

/** @type {(value: Unknown) => (path: list.List<string>) => (src: Unknown) => Unknown} */
export const setProperty = value => {
    /** @type {(path: list.List<string>) => (src: Unknown) => Unknown} */
    const f = path => src => {
        const result = next(path)
        if (result === null) { return value }
        const srcObject = (src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(at(first)(srcObject)) }
    }
    return f
}

const colon = [':']

/** @typedef {object.Entry<Unknown>} Entry*/

/** @typedef {(list.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Unknown) => list.List<string>} */
export const serialize = sort => {
    /** @type {(kv: readonly[string, Unknown]) => list.List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: Object) => list.List<string>} */
    const objectSerialize = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    /** @type {(value: Unknown) => list.List<string>} */
    const f = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
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
export const stringify = sort => compose(serialize(sort))(concat)

/** @type {(value: string) => Unknown} */
export const parse = JSON.parse

/** @type {(value: Unknown) => value is Object} */
export const isObject = value => typeof value === 'object' && value !== null && !(value instanceof Array)
