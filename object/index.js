const array = require('../sequence/array')
const seq = require('../sequence')

/**
 * @template T
 * @typedef {{
 *  readonly [k in string]: T
 * }} Object_
 */

/** @type {<T>(object: Object_<T>) => seq.Sequence<readonly[string, T]>} */
const entries = object => array.sequence(Object.entries(object))

module.exports = {
    /** @readonly */
    entries,
}