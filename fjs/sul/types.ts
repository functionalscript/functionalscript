/**
 * Type-level API for the full SUL streaming encoder.
 *
 * @module
 */

import type { InternalState } from '../types/patricia_trie/types.ts'
import type { NextStep, Transducer } from '../types/function/operator/types.ts'
import type { PipelineState } from './level/literal/types.ts'
import type { Id } from './id/types.ts'

type HashState = InternalState<Id>

export type EncodeState<S> = readonly [
    PipelineState,
    S,
    readonly HashState[]
]

/**
 * A streaming encoder. A bit's **height** is how many levels close a word on
 * it, counting up from L1: 0 for none, 2 for L1 and L2, 5 for L1 to H2.
 */
export type Encode<S> = Omit<Transducer<bigint, EncodeState<S>, never, Id>, 'init' | 'update'> & {
    readonly init: NextStep<EncodeState<S>>
    readonly update: (state: EncodeState<S>, bit: bigint) => NextStep<EncodeState<S>>
    /** Consumes a bit, also giving its height. */
    readonly updateWithHeight: (state: EncodeState<S>, bit: bigint) => readonly [height: number, state: EncodeState<S>]
    /** `end`, also giving the height of each padding bit it adds. */
    readonly endWithHeights: (state: EncodeState<S>) => readonly [heights: readonly number[], root: Id]
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
 * What the demo draws from: the padding `end` adds after the input — a `1`,
 * then `0`s — each bit's height, the input's then the padding's, and the
 * root.
 */
export type _DemoStripes = {
    readonly padding: string
    readonly heights: readonly number[]
    readonly root: Id
}
