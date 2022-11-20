const list = require('../types/list/module.f.cjs')
const { equal, isEmpty, fold, toArray, scan, foldScan } = list
const byteSet = require('../types/byte_set/module.f.cjs')
const { toRangeMap, union: byteSetUnion, one, empty } = byteSet
const sortedSet = require('../types/sorted_set/module.f.cjs')
const { intersect, union: sortedSetUnion } = sortedSet
const rangeMap = require('../types/range_map/module.f.cjs')
const { merge } = rangeMap
const { unsafeCmp } = require('../types/function/compare/module.f.cjs')
const operator = require("../types/function/operator/module.f.cjs")
const { strictEqual } = operator
const { stringify } = require('../json/module.f.cjs')
const { identity } = require('../types/function/module.f.cjs')
const { stringToList } = require('../text/utf16/module.f.cjs')

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/**
 * @typedef {{
 *  readonly[state in string]: rangeMap.RangeMapArray<string>
 * }} Dfa
 */

const stringifyIdentity = stringify(identity)

/** @type {(s: string) => byteSet.ByteSet} */
const toRange = s => {
    const [b, e] = toArray(stringToList(s))
    return byteSet.range([b, e])
}

/** @type {operator.Fold<number, byteSet.ByteSet>} */
const toUnionOp = i => bs => byteSetUnion(bs)(one(i))

/** @type {(s: string) => byteSet.ByteSet} */
const toUnion = s => {
    const codePoints = stringToList(s)
    return fold(toUnionOp)(empty)(codePoints)
}

/** @type {rangeMap.Operators<sortedSet.SortedSet<string>>} */
const mergeOp = { union: sortedSetUnion(unsafeCmp), equal: equal(strictEqual) }

/** @type {(s: string) => (set: sortedSet.SortedSet<string>) => boolean} */
const hasState = s => set => !isEmpty(intersect(unsafeCmp)([s])(set))

/** @type {(set: sortedSet.SortedSet<string>) => operator.Fold<Rule, rangeMap.RangeMap<sortedSet.SortedSet<string>>>} */
const foldOp = set => ([ruleIn, bs, ruleOut]) => rm => {
    if (hasState(ruleIn)(set)) { return merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut)) }
    return rm
}

/** @type {operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, rangeMap.Entry<string>>} */
const stringifyOp = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

/** @type {operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, sortedSet.SortedSet<string>>} */
const fetchOp = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)

/** @type {(grammar: Grammar) => operator.Fold<sortedSet.SortedSet<string>, Dfa>} */
const addEntry = grammar => set => dfa => {
    const s = stringifyIdentity(set)
    if (s in dfa) { return dfa }
    const setMap = fold(foldOp(set))(undefined)(grammar)
    const stringMap = toArray(scanStringify(setMap))
    const newDfa = { ...dfa, [s]: stringMap }
    const newStates = scanFetch(setMap)
    return fold(addEntry(grammar))(newDfa)(newStates)
}

/** @type {string[]} */
const emptyState = []

const emptyStateStringify = stringifyIdentity(emptyState)

const initialState = ['']

const initialStateStringify = stringifyIdentity(initialState)

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar => addEntry(grammar)(initialState)({})

/** @type {(dfa: Dfa) => operator.Fold<number, string>} */
const runOp = dfa => input => s => {
    const state = rangeMap.get(input)(dfa[s])
    return state === undefined ? emptyStateStringify : state
}

/** @type {(dfa: Dfa) => (input: list.List<number>) => list.List<string>} */
const run = dfa => input => foldScan(runOp(dfa))(initialStateStringify)(input)

module.exports = {
    /** @readonly */
    dfa,
    /** @readonly */
    run,
    /** @readonly */
    toRange,
    /** @readonly */
    toUnion
}