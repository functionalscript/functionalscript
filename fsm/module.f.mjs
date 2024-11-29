import list from '../types/list/module.f.cjs'
const { equal, isEmpty, fold, toArray, scan, foldScan, empty: emptyList } = list
import byteSet, * as byteSetT from '../types/byte_set/module.f.mjs'
const { toRangeMap, union: byteSetUnion, one, empty } = byteSet
import sortedSet from '../types/sorted_set/module.f.cjs'
const { intersect, union: sortedSetUnion } = sortedSet
import rangeMap from '../types/range_map/module.f.cjs'
const { merge } = rangeMap
import cmp from '../types/function/compare/module.f.mjs'
const { unsafeCmp } = cmp
import operator, * as Operator from '../types/function/operator/module.f.mjs'
const { strictEqual } = operator
import j from '../json/module.f.mjs'
const { stringify } = j
import f from '../types/function/module.f.cjs'
const { identity } = f
import utf16 from '../text/utf16/module.f.mjs'
const { stringToList } = utf16

/** @typedef {readonly[string, byteSetT.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/**
 * @typedef {{
 *  readonly[state in string]: rangeMap.RangeMapArray<string>
 * }} Dfa
 */

const stringifyIdentity = stringify(identity)

/** @type {(s: string) => byteSetT.ByteSet} */
const toRange = s => {
    const [b, e] = toArray(stringToList(s))
    return byteSet.range([b, e])
}

/** @type {Operator.Fold<number, byteSetT.ByteSet>} */
const toUnionOp = i => bs => byteSetUnion(bs)(one(i))

/** @type {(s: string) => byteSetT.ByteSet} */
const toUnion = s => {
    const codePoints = stringToList(s)
    return fold(toUnionOp)(empty)(codePoints)
}

/** @type {rangeMap.Operators<sortedSet.SortedSet<string>>} */
const mergeOp = { union: sortedSetUnion(unsafeCmp), equal: equal(strictEqual) }

/** @type {(s: string) => (set: sortedSet.SortedSet<string>) => boolean} */
const hasState = s => set => !isEmpty(intersect(unsafeCmp)([s])(set))

/** @type {(set: sortedSet.SortedSet<string>) => Operator.Fold<Rule, rangeMap.RangeMap<sortedSet.SortedSet<string>>>} */
const foldOp = set => ([ruleIn, bs, ruleOut]) => rm => {
    if (hasState(ruleIn)(set)) { return merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut)) }
    return rm
}

/** @type {Operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, rangeMap.Entry<string>>} */
const stringifyOp = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

/** @type {Operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, sortedSet.SortedSet<string>>} */
const fetchOp = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)

/** @type {(grammar: Grammar) => Operator.Fold<sortedSet.SortedSet<string>, Dfa>} */
const addEntry = grammar => set => dfa => {
    const s = stringifyIdentity(set)
    if (s in dfa) { return dfa }
    const setMap = fold(foldOp(set))(emptyList)(grammar)
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

const get = rangeMap.get(emptyStateStringify)

/** @type {(dfa: Dfa) => Operator.Fold<number, string>} */
const runOp = dfa => input => s => get(input)(dfa[s])

/** @type {(dfa: Dfa) => (input: list.List<number>) => list.List<string>} */
const run = dfa => input => foldScan(runOp(dfa))(initialStateStringify)(input)

export default {
    /** @readonly */
    dfa,
    /** @readonly */
    run,
    /** @readonly */
    toRange,
    /** @readonly */
    toUnion
}