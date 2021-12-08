const seq = require('../sequence')
const map = require('../map')
const { compose } = require('../function')

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

/** @type {<T>(entries: seq.Sequence<Entry<T>>) => seq.Sequence<Entry<T>>} */
const sort = entries => map.entries(map.fromEntries(entries))

module.exports = {
    /** @readonly */
    at,
    /** @readonly */
    sort,
}
