const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const sortedSet = require('../types/sorted_set/module.f.cjs')
const rangeMap = require('../types/range_map/module.f.cjs')

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {rangeMap.RangeMap<sortedSet.SortedSet<string>>} RangeMap */

/**
 * @typedef {{
 *  readonly[state in string]: RangeMap
 * }} Dfa
 */

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => todo()

module.exports = {
    /** @readonly */
    dfa,
}