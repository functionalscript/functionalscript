/**
 * Type-level API for the full SUL streaming encoder.
 *
 * @module
 */

import type { InternalState } from '../types/patricia_trie/types.ts'
import type { PipelineState } from './level/literal/types.ts'
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
