const list = require('../list/index.f.js')
const map = require('../map/index.f.js')

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
const at = name => object => Object.getOwnPropertyDescriptor(object, name)?.value

/** @type {<T>(entries: list.List<Entry<T>>) => list.List<Entry<T>>} */
const sort = entries => map.entries(map.fromEntries(entries))

/** @type {<T>(entries: list.List<Entry<T>>) => Map<T>} */
const fromEntries = entries => Object.fromEntries(list.iterable(entries))

/** @type {<T>(m: map.Map<T>) => Map<T>} */
const fromMap = m => fromEntries(map.entries(m))

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
