/**
 * Type-level API for the full SUL streaming encoder.
 *
 * @module
 */

import type { InternalState } from '../types/patricia_trie/types.ts'
import type { EncodeState as LiteralEncodeState, PipelineState } from './level/literal/types.ts'
import type { Id } from './id/types.ts'

type HashState = InternalState<Id>

export type EncodeState<S> = readonly [
    PipelineState,
    S,
    readonly HashState[]
]

export type Encode<S> = {
    readonly push: (bit: bigint, state: EncodeState<S>) => EncodeState<S>
    readonly end: (state: EncodeState<S>) => Id
}

/**
 * The demo's state (`./demo.f.mjs`): which input is shown, `text` or `bits`,
 * and both inputs, so switching between them keeps what was typed in each.
 */
export type _DemoState = {
    readonly input: string
    readonly text: string
    readonly bits: string
}

/**
 * A run of input bits the demo draws as one unit: a character and its UTF-8
 * bits, or up to eight typed bits. `label` is what is written over them —
 * the character, a visible stand-in for one a reader could not see, and then
 * `standIn` is `true`, or nothing for typed bits.
 */
export type _DemoUnit = {
    readonly label: string
    readonly standIn: boolean
    readonly bits: string
}

/**
 * One literal level as the demo follows bits through it: its encoder state,
 * the bit where its current word starts, and the length in bits of each word
 * it has closed.
 */
export type _DemoLevel = {
    readonly state: LiteralEncodeState
    readonly start: number
    readonly words: readonly number[]
}

/**
 * How the literal levels cut bits into words: the padding added after the
 * input — a `1`, then `0`s until L3 closes a word — and, for each level from
 * L1 to L3, the length in bits of each of its words, in order. Every level's
 * lengths add up to the input and the padding together.
 */
export type _DemoStripes = {
    readonly padding: string
    readonly words: readonly (readonly number[])[]
}
