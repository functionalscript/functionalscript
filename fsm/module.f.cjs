const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const { reverse, countdown, flat, map } = list
const byteSet = require('../types/byte_set/module.f.cjs')
const { has } = byteSet
const rangeMap = require('../types/range_map/module.f.cjs')
const sortedSet = require('../types/sorted_set/module.f.cjs')

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {readonly string[]} ByteMap */

/**
 * @typedef {{
 *  readonly[state in string]: ByteMap
 * }} Dfa
 */

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => todo()

const counter = reverse(countdown(64))

/** @type {(n: byteSet.ByteSet) => (s: string) => (i: number) => rangeMap.RangeMap<sortedSet.SortedSet<string>>} */
const toRangeMapOp = n => s => i =>
{
    const current = has(i + 1)(n)
    const prev = has(i)(n)
    if (current === prev) { return undefined }
    return [[prev ? [s] : [], i]]
}

/** @type {(n: byteSet.ByteSet) => (s: string) => rangeMap.RangeMap<sortedSet.SortedSet<string>>} */
const toRangeMap = n => s => flat(map(toRangeMapOp(n)(s))(counter))

module.exports = {
    /** @readonly */
    dfa,
    /** @readonly */
    toRangeMap,
}