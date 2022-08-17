const list = require('../list/module.f.cjs')
const { iterable } = list
const map = require('../map/module.f.cjs')
const { entries: mapEntries, fromEntries: mapFromEntries } = map
const { getOwnPropertyDescriptor, fromEntries: objectFromEntries } = Object

/**
 * @template T
 * @typedef {{
 *  readonly [k in string]: T
 * }} Map
 */

/**
 * @template T
 * @typedef {readonly[string, T]} Entry
 */

/** @type {(name: string) => <T>(object: Map<T>) => T|undefined} */
const at = name => object => getOwnPropertyDescriptor(object, name)?.value

/** @type {<T>(e: list.List<Entry<T>>) => list.List<Entry<T>>} */
const sort = e => mapEntries(mapFromEntries(e))

/** @type {<T>(e: list.List<Entry<T>>) => Map<T>} */
const fromEntries = e => objectFromEntries(iterable(e))

/** @type {<T>(m: map.Map<T>) => Map<T>} */
const fromMap =  m => fromEntries(mapEntries(m))

module.exports = {
    /** @readonly */
    at,
    /** @readonly */
    sort,
    /** @readonly */
    fromEntries,
    /** @readonly */
    fromMap,
}
