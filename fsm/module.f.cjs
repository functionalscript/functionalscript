const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const { toRangeMap } = byteSet
const sortedSet = require('../types/sorted_set/module.f.cjs')
const rangeMap = require('../types/range_map/module.f.cjs')
const { unsafeCmp } = require('../types/function/compare/module.f.cjs')
const operator = require("../types/function/operator/module.f.cjs")
const { strictEqual } = operator
const json = require('../json/module.f.cjs')
const { sort } = require('../types/object/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/**
 * @typedef {{
 *  readonly[state in string]: rangeMap.RangeMap<string>
 * }} Dfa
 */

/** @type {rangeMap.Operators<sortedSet.SortedSet<string>>} */
const mergeOp = { union: sortedSet.union(unsafeCmp), equal: list.equal(strictEqual) }

/** @type {(state: string) => operator.Fold<Rule, rangeMap.RangeMap<sortedSet.SortedSet<string>>>} */
const foldOp = state => ([ruleIn, bs, ruleOut]) => rm => {
    if (state !== ruleIn) { return rm }
    return rangeMap.merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut))
}
/** @type {operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, rangeMap.Entry<string>>} */
const stringifyOp = ([sortedSet, max]) => [[stringify(sortedSet), max], stringifyOp]

/** @type {operator.Scan<rangeMap.Entry<string>, string>} */
const fetchOp = ([item, _]) => [item, fetchOp]

/** @type {(grammar: Grammar) => operator.Fold<string, Dfa>} */
const addEntry = grammar => s => dfa => {
    if (s in dfa) { return dfa }
    const arrayMap = list.fold(foldOp(s))(undefined)(grammar)
    const stringMap = list.scan(stringifyOp)(arrayMap)
    const newDfa = { ...dfa, s: stringMap }
    const newStates = list.scan(fetchOp)(stringMap)
    return list.fold(addEntry(grammar))(newDfa)(newStates)
}

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => addEntry(grammar)('[]')({})

module.exports = {
    /** @readonly */
    dfa,
}