/**
 * Streaming encoder for the full SUL pipeline.
 * Processes bits one at a time through literal levels L1→L2→L3, then through a dynamic array of hash levels.
 *
 * @module
 */

import { emptyPipelineState, pipelineStep, type PipelineState } from './level/literal/module.f.ts'
import { encode as hashEncode, type Add } from './level/hash/module.f.ts'
import { level3Id, type Id } from './id/module.f.ts'
import type { InternalState } from '../types/patricia_trie/module.f.ts'

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

export const emptyEncodeState = <S>(storage: S): EncodeState<S> =>
    [emptyPipelineState, storage, []]

export const encode = <S>(add: Add<S>): Encode<S> => {
    const step = hashEncode(add)

    type CascadeResult = readonly [Id | undefined, S, readonly HashState[]]

    const cascade = (
        id0: Id,
        storage0: S,
        stacks0: readonly HashState[],
    ): CascadeResult => {
        let id = id0, storage = storage0, stacks = stacks0
        for (let index = 0; ; index++) {
            if (index >= stacks.length) {
                const [, [newStorage, newStack]] = step(id, [storage, []])
                return [id, newStorage, [...stacks, newStack]]
            }
            const [out, [newStorage, newStack]] = step(id, [storage, stacks[index]])
            stacks = [...stacks.slice(0, index), newStack, ...stacks.slice(index + 1)]
            storage = newStorage
            if (out === undefined) return [undefined, storage, stacks]
            id = out
        }
    }

    const literalStep = (
        bit: bigint,
        state: EncodeState<S>
    ): readonly [Id | undefined, EncodeState<S>] => {
        const [ps, storage, stacks] = state
        const [l3Out, newPs] = pipelineStep(bit, ps)
        if (l3Out === undefined) return [undefined, [newPs, storage, stacks]]
        const [finalId, newStorage, newStacks] = cascade(level3Id(l3Out), storage, stacks)
        return [finalId, [newPs, newStorage, newStacks]]
    }

    return {
        push: (bit, state) => literalStep(bit, state)[1],
        end: state => {
            let [id, s] = literalStep(1n, state)
            while (id === undefined) {
                [id, s] = literalStep(0n, s)
            }
            return id
        }
    }
}
