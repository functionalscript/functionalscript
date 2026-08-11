/**
 * Finite state machine helpers used by parser and tokenizer logic.
 *
 * @module
 */
import type { List } from '../types/list/types.ts'
import { equal, isEmpty, fold, toArray, scan, foldScan, empty as emptyList } from '../types/list/module.f.mjs'
import type { StringMap } from '../types/object/types.ts'
import { toRangeMap, union as byteSetUnion, one, empty, range, type ByteSet } from '../types/byte_set/module.f.ts'
import { intersect, union as sortedSetUnion } from '../types/sorted_set/module.f.mjs'
import type { SortedSet } from '../types/sorted_set/types.ts'
import type { RangeMap, Properties, RangeMapArray, Entry } from '../types/range_map/types.ts'
import { merge, get as rangeMapGet } from '../types/range_map/module.f.mjs'
import type { Fold, Scan } from '../types/function/operator/types.ts'
import { strictEqual } from '../types/function/operator/module.f.mjs'
import { stringify } from '../media/json/module.f.ts'
import { identity } from '../types/function/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'
import { cmp } from '../types/string/module.f.mjs'

type Rule = readonly [string, ByteSet, string]

export type Grammar = List<Rule>

type Dfa = StringMap<RangeMapArray<string>>

const stringifyIdentity = stringify(identity)

export const toRange: (s: string) => ByteSet
    = s => {
        const [b, e] = toArray(stringToList(s))
        return range([b, e])
    }

const toUnionOp: Fold<number, ByteSet>
    = i => bs => byteSetUnion(bs)(one(i))

export const toUnion: (s: string) => ByteSet
    = s => {
        const codePoints = stringToList(s)
        return fold(toUnionOp)(empty)(codePoints)
    }

const mergeOp: Properties<SortedSet<string>>
    = { union: sortedSetUnion(cmp), equal: equal(strictEqual), def: [] }

const hasState: (s: string) => (set: SortedSet<string>) => boolean
    = s => set => !isEmpty(intersect(cmp)([s])(set))

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
    = dfa => input => s => get(dfa[s] ?? [])(input)

export const run = (dfa: Dfa) => (input: List<number>): List<string> =>
    foldScan(runOp(dfa))(initialStateStringify)(input)
