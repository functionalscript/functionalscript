const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')

/** @typedef {number} Byte */

/** @typedef {readonly[string, Byte, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {readonly string[]} ByteMap */

/**
 * @typedef {{
 *  readonly[state in string]: ByteMap
 * }} Dfa
 */

/** @type {(faId: string) => string} */
const escape = faId => todo()

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => todo()

module.exports = {}