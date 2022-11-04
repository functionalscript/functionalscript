const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const { toRangeMap } = byteSet
const sortedSet = require('../types/sorted_set/module.f.cjs')
const rangeMap = require('../types/range_map/module.f.cjs')
const { unsafeCmp } = require('../types/function/compare/module.f.cjs')
const op = require("../types/function/operator/module.f.cjs")
const { strictEqual } = op

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {rangeMap.RangeMap<sortedSet.SortedSet<string>>} TransitionMap */

/**
 * @typedef {{
 *  readonly[state in string]: TransitionMap
 * }} Dfa
 */

/** @type {rangeMap.Operators<sortedSet.SortedSet<string>>} */
const mergeOp = { union: sortedSet.union(unsafeCmp), equal: list.equal(strictEqual) }

/** @type {(state: string) => op.Fold<Rule, TransitionMap>} */
const foldOp = state => ([ruleIn, bs, ruleOut]) => tm => {
    if (state !== ruleIn) { return tm }
    return rangeMap.merge(mergeOp)(tm)(toRangeMap(bs)(ruleOut))
}

/** @type {(state: string) => (grammar: Grammar) => TransitionMap} */
const toTransitionMap = state => grammar => list.fold(foldOp(state))(undefined)(grammar)

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => todo()

module.exports = {
    /** @readonly */
    dfa,
}