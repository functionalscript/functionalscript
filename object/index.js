const array = require('../sequence/array')
const seq = require('../sequence')

/**
 * @template T
 * @typedef {{
 *  readonly [k in string]: T
 * }} Map
 */

/** @type {<T>(object: Map<T>) => seq.Sequence<readonly[string, T]>} */
const entries = object => array.sequence(Object.entries(object))

/** @type {(name: string) => <T>(object: Map<T>) => T|undefined} */
const at = name => object => Object.getOwnPropertyDescriptor(object, name)?.value

module.exports = {
    /** @readonly */
    entries,
    /** @readonly */
    at,
}