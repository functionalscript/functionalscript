import * as list from '../types/list/module.f.ts'
const { equal, isEmpty, fold, toArray, scan, foldScan, empty: emptyList } = list
import * as byteSet from '../types/byte_set/module.f.ts'
const { toRangeMap, union: byteSetUnion, one, empty } = byteSet
import { intersect, type SortedSet, union as sortedSetUnion } from '../types/sorted_set/module.f.ts'
import {
    merge,
    get as rangeMapGet,
    type RangeMap,
    type Operators,
    type RangeMapArray,
    type Entry
} from '../types/range_map/module.f.ts'
import { unsafeCmp } from '../types/function/compare/module.f.ts'
import { type Fold, type Scan, strictEqual } from '../types/function/operator/module.f.ts'
import { stringify } from '../json/module.f.ts'
import { identity } from '../types/function/module.f.ts'
import { stringToList } from '../text/utf16/module.f.ts'

type Rule = readonly [string, byteSet.ByteSet, string]

export type Grammar = list.List<Rule>

type Dfa = {
    readonly [state in string]: RangeMapArray<string>
}

const stringifyIdentity = stringify(identity)

export const toRange: (s: string) => byteSet.ByteSet
    = s => {
        const [b, e] = toArray(stringToList(s))
        return byteSet.range([b, e])
    }

const toUnionOp: Fold<number, byteSet.ByteSet>
    = i => bs => byteSetUnion(bs)(one(i))

export const toUnion: (s: string) => byteSet.ByteSet
    = s => {
        const codePoints = stringToList(s)
        return fold(toUnionOp)(empty)(codePoints)
    }

const mergeOp: Operators<SortedSet<string>>
    = { union: sortedSetUnion(unsafeCmp), equal: equal(strictEqual) }

const hasState: (s: string) => (set: SortedSet<string>) => boolean
    = s => set => !isEmpty(intersect(unsafeCmp)([s])(set))

const foldOp: (set: SortedSet<string>) => Fold<Rule, RangeMap<SortedSet<string>>>
    = set => ([ruleIn, bs, ruleOut]) => rm => {
        if (hasState(ruleIn)(set)) { return merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut)) }
        return rm
    }

const stringifyOp: Scan<Entry<SortedSet<string>>, Entry<string>>
    = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

const fetchOp: Scan<Entry<SortedSet<string>>, SortedSet<string>>
    = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)

const addEntry: (grammar: Grammar) => Fold<SortedSet<string>, Dfa>
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

export const dfa: (grammar: Grammar) => Dfa
    = grammar => addEntry(grammar)(initialState)({})

const get = rangeMapGet(emptyStateStringify)

const runOp: (dfa: Dfa) => Fold<number, string>
    = dfa => input => s => get(input)(dfa[s])

export const run: (dfa: Dfa) => (input: list.List<number>) => list.List<string>
    = dfa => input => foldScan(runOp(dfa))(initialStateStringify)(input)
