const array = require('../sequence/array')
const seq = require('../sequence')
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

/** @type {<T>(object: Map<T>) => seq.Sequence<Entry<T>>} */
const entries = object => array.sequence(Object.entries(object))

/** @type {(name: string) => <T>(object: Map<T>) => T|undefined} */
const at = name => object => Object.getOwnPropertyDescriptor(object, name)?.value

/** @type {<T>(entries: seq.Sequence<Entry<T>>) => seq.Sequence<Entry<T>>} */
const sortEntries = entries => map.fromEntries(entries).entries

module.exports = {
    /** @readonly */
    entries,
    /** @readonly */
    at,
    /** @readonly */
    sortEntries,
}