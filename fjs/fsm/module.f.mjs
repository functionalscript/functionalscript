/**
 * Finite state machine helpers used by parser and tokenizer logic.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 * @import { ByteSet } from '../types/byte_set/types.ts'
 * @import { SortedSet } from '../types/sorted_set/types.ts'
 * @import { RangeMap, Properties, RangeMapArray, RangeEntry } from '../types/range_map/types.ts'
 * @import { Fold } from '../types/function/operator/types.ts'
 * @import { Grammar, _Dfa, _Rule } from './types.ts'
 */

import { sameItems, fold, map, toArray, foldScan, empty as emptyList } from '../types/list/module.f.mjs'
import { toRangeMap, range } from '../types/byte_set/module.f.mjs'
import { has, toKey, union as sortedSetUnion } from '../types/sorted_set/module.f.mjs'
import { merge, get as rangeMapGet, mapValue, values } from '../types/range_map/module.f.mjs'
import { range as asciiRange } from '../text/ascii/module.f.mjs'
import { compose } from '../types/function/module.f.mjs'
import { at } from '../types/object/module.f.mjs'
import { cmp } from '../types/string/module.f.mjs'


/**
 * The byte set of an inclusive ASCII character range, written as the two
 * endpoint characters: `toRange('az')`.
 *
 * `fjs/text/ascii` owns "two-character string to inclusive `Range`", including
 * the one-character case where both endpoints are that character, so this is
 * its composition with `byte_set.range` and nothing more.
 *
 * @type {(s: string) => ByteSet}
 */
export const toRange = compose(asciiRange)(range)

/** @type {Properties<SortedSet<string>>} */
const mergeOp = { union: sortedSetUnion(cmp), equal: sameItems, def: [] }

const hasState = has(cmp)

/**
 * Labels a byte set's ranges with the rule they lead to: a range inside the set
 * transitions to `ruleOut`, one outside transitions nowhere.
 *
 * `byte_set.toRangeMap` answers only whether each range is in the set; which
 * state that means is a DFA question, so it is answered here.
 *
 * @type {(ruleOut: string) => (entry: RangeEntry<boolean>) => RangeEntry<SortedSet<string>>}
 */
const labelRange = ruleOut => mapValue(inSet => inSet ? [ruleOut] : [])

/** @type {(set: SortedSet<string>) => Fold<_Rule, RangeMap<SortedSet<string>>>} */
const foldOp = set => ([ruleIn, bs, ruleOut]) => rm => {
    if (hasState(ruleIn)(set)) {
        return merge(mergeOp)(rm)(map(labelRange(ruleOut))(toRangeMap(bs)))
    }
    return rm
}

/**
 * The transition function of the subset construction: from a set of states,
 * each input range leads to the set of states the grammar's rules reach.
 *
 * @type {(grammar: Grammar) => (set: SortedSet<string>) => RangeMap<SortedSet<string>>}
 */
const transitions = grammar => set => fold(foldOp(set))(emptyList)(grammar)

/**
 * Renders each entry's state set as its `_Dfa` key, keeping the range boundary.
 *
 * @type {(rm: RangeMap<SortedSet<string>>) => RangeMap<string>}
 */
const keyEntries = map(mapValue(toKey))

/** @type {(grammar: Grammar) => Fold<SortedSet<string>, _Dfa>} */
const addEntry = grammar => set => dfa => {
    const s = toKey(set)
    if (at(s)(dfa) !== null) { return dfa }
    const setMap = transitions(grammar)(set)
    const newDfa = { ...dfa, [s]: toArray(keyEntries(setMap)) }
    return fold(addEntry(grammar))(newDfa)(values(setMap))
}

/** @type {string[]} */
const emptyState = []

const emptyStateKey = toKey(emptyState)

const initialState = ['']

const initialStateKey = toKey(initialState)

/** @type {(grammar: Grammar) => _Dfa} */
export const dfa = grammar => addEntry(grammar)(initialState)({})

const get = rangeMapGet(emptyStateKey)

/** @type {(dfa: _Dfa) => Fold<number, string>} */
const runOp = dfa => input => s => get(at(s)(dfa) ?? [])(input)

/** @type {(dfa: _Dfa) => (input: List<number>) => List<string>} */
export const run = dfa => input =>
    foldScan(runOp(dfa))(initialStateKey)(input)
