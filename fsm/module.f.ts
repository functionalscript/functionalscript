import * as list from '../types/list/module.f.ts'
const { equal, isEmpty, fold, toArray, scan, foldScan, empty: emptyList } = list
import * as byteSet from '../types/byte_set/module.f.ts'
const { toRangeMap, union: byteSetUnion, one, empty } = byteSet
import * as sortedSet from '../types/sorted_set/module.f.ts'
const { intersect, union: sortedSetUnion } = sortedSet
import * as rangeMap from '../types/range_map/module.f.ts'
const { merge } = rangeMap
import * as cmp from '../types/function/compare/module.f.ts'
const { unsafeCmp } = cmp
import * as operator from '../types/function/operator/module.f.ts'
const { strictEqual } = operator
import * as j from '../json/module.f.ts'
const { stringify } = j
import * as f from '../types/function/module.f.ts'
const { identity } = f
import * as utf16 from '../text/utf16/module.f.ts'
const { stringToList } = utf16

type Rule = readonly[string, byteSet.ByteSet, string]

export type Grammar = list.List<Rule>

type Dfa = {
   readonly[state in string]: rangeMap.RangeMapArray<string>
}

const stringifyIdentity = stringify(identity)

export const toRange
    : (s: string) => byteSet.ByteSet
    = s => {
    const [b, e] = toArray(stringToList(s))
    return byteSet.range([b, e])
}

const toUnionOp
    : operator.Fold<number, byteSet.ByteSet>
    = i => bs => byteSetUnion(bs)(one(i))

export const toUnion
    : (s: string) => byteSet.ByteSet
    = s => {
    const codePoints = stringToList(s)
    return fold(toUnionOp)(empty)(codePoints)
}

const mergeOp
    : rangeMap.Operators<sortedSet.SortedSet<string>>
    = { union: sortedSetUnion(unsafeCmp), equal: equal(strictEqual) }

const hasState
    : (s: string) => (set: sortedSet.SortedSet<string>) => boolean
    = s => set => !isEmpty(intersect(unsafeCmp)([s])(set))

const foldOp
    : (set: sortedSet.SortedSet<string>) => operator.Fold<Rule, rangeMap.RangeMap<sortedSet.SortedSet<string>>>
    = set => ([ruleIn, bs, ruleOut]) => rm => {
    if (hasState(ruleIn)(set)) { return merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut)) }
    return rm
}

const stringifyOp
    : operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, rangeMap.Entry<string>>
    = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

const fetchOp
    : operator.Scan<rangeMap.Entry<sortedSet.SortedSet<string>>, sortedSet.SortedSet<string>>
    = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)

const addEntry
    : (grammar: Grammar) => operator.Fold<sortedSet.SortedSet<string>, Dfa>
    = grammar => set => dfa => {
    const s = stringifyIdentity(set)
    if (s in dfa) { return dfa }
    const setMap = fold(foldOp(set))(emptyList)(grammar)
    const stringMap = toArray(scanStringify(setMap))
    const newDfa = { ...dfa, [s]: stringMap }
    const newStates = scanFetch(setMap)
    return fold(addEntry(grammar))(newDfa)(newStates)
}

const emptyState: string[] = []

const emptyStateStringify = stringifyIdentity(emptyState)

const initialState = ['']

const initialStateStringify = stringifyIdentity(initialState)

export const dfa
    : (grammar: Grammar) => Dfa
    = grammar => addEntry(grammar)(initialState)({})

const get = rangeMap.get(emptyStateStringify)

const runOp
    : (dfa: Dfa) => operator.Fold<number, string>
    = dfa => input => s => get(input)(dfa[s])

export const run
    : (dfa: Dfa) => (input: list.List<number>) => list.List<string>
    = dfa => input => foldScan(runOp(dfa))(initialStateStringify)(input)
