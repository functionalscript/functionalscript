const list = require('../types/list/module.f.cjs')

/** @typedef {number} Byte */

/** @typedef {readonly[string, Byte, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {readonly string[]} ByteMap */

/**
 * @typedef {{
 *  readonly [k in string]: ByteMap
 * }} Dfa
 */

module.exports = {}