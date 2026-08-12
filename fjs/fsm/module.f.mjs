/**
 * Finite state machine helpers used by parser and tokenizer logic.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 * @import { ByteSet } from '../types/byte_set/types.ts'
 * @import { SortedSet } from '../types/sorted_set/types.ts'
 * @import { RangeMap, Properties, RangeMapArray, Entry } from '../types/range_map/types.ts'
 * @import { Fold, Scan } from '../types/function/operator/types.ts'
 */

import { equal, isEmpty, fold, toArray, scan, foldScan, empty as emptyList } from '../types/list/module.f.mjs'
import { toRangeMap, union as byteSetUnion, one, empty, range } from '../types/byte_set/module.f.mjs'
import { intersect, union as sortedSetUnion } from '../types/sorted_set/module.f.mjs'
import { merge, get as rangeMapGet } from '../types/range_map/module.f.mjs'
import { strictEqual } from '../types/function/operator/module.f.mjs'
import { stringify } from '../media/json/module.f.mjs'
import { identity } from '../types/function/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'
import { cmp } from '../types/string/module.f.mjs'

/** @typedef {readonly [string, ByteSet, string]} _Rule */

/** @typedef {List<_Rule>} Grammar */

/** @typedef {StringMap<RangeMapArray<string>>} _Dfa */

const stringifyIdentity = stringify(identity)

/** @type {(s: string) => ByteSet} */
export const toRange = s => {
    const [b, e] = toArray(stringToList(s))
    return range([b, e])
}

/** @type {Fold<number, ByteSet>} */
const toUnionOp = i => bs => byteSetUnion(bs)(one(i))

/** @type {(s: string) => ByteSet} */
export const toUnion = s => {
    const codePoints = stringToList(s)
    return fold(toUnionOp)(empty)(codePoints)
}

/** @type {Properties<SortedSet<string>>} */
const mergeOp = { union: sortedSetUnion(cmp), equal: equal(strictEqual), def: [] }

/** @type {(s: string) => (set: SortedSet<string>) => boolean} */
const hasState = s => set => !isEmpty(intersect(cmp)([s])(set))

/** @type {(set: SortedSet<string>) => Fold<_Rule, RangeMap<SortedSet<string>>>} */
const foldOp = set => ([ruleIn, bs, ruleOut]) => rm => {
    if (hasState(ruleIn)(set)) { return merge(mergeOp)(rm)(toRangeMap(bs)(ruleOut)) }
    return rm
}

/** @type {Scan<Entry<SortedSet<string>>, Entry<string>>} */
const stringifyOp = ([sortedSet, max]) => [[stringifyIdentity(sortedSet), max], stringifyOp]

const scanStringify = scan(stringifyOp)

/** @type {Scan<Entry<SortedSet<string>>, SortedSet<string>>} */
const fetchOp = ([item, _]) => [item, fetchOp]

const scanFetch = scan(fetchOp)

/** @type {(grammar: Grammar) => Fold<SortedSet<string>, _Dfa>} */
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

/** @type {(grammar: Grammar) => _Dfa} */
export const dfa = grammar => addEntry(grammar)(initialState)({})

const get = rangeMapGet(emptyStateStringify)

/** @type {(dfa: _Dfa) => Fold<number, string>} */
const runOp = dfa => input => s => get(dfa[s] ?? [])(input)

/** @type {(dfa: _Dfa) => (input: List<number>) => List<string>} */
export const run = dfa => input =>
    foldScan(runOp(dfa))(initialStateStringify)(input)
