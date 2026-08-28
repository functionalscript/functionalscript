/**
 * Types for the finite-state-machine grammar and its compiled DFA.
 */

import type { List } from '../types/list/types.ts'
import type { ByteSet } from '../types/byte_set/types.ts'
import type { StringMap } from '../types/object/types.ts'
import type { RangeMapArray } from '../types/range_map/types.ts'

/** A transition rule: source state, input bytes, target state. */
export type _Rule = readonly [string, ByteSet, string]

export type Grammar = List<_Rule>

/** The compiled automaton: each state's byte-range transition table. */
export type _Dfa = StringMap<RangeMapArray<string>>
