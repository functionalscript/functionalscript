const list = require('../list')
const map = require('../map')

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

/** @type {<T>(m: map.Map<T>) => Map<T>} */
const fromMap = m => Object.fromEntries(list.iterable(map.entries(m)))

module.exports = {
    /** @readonly */
    at,
    /** @readonly */
    sort,
    /** @readonly */
    fromMap,
}
