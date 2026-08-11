/**
 * Streaming encoder for the full SUL pipeline.
 * Processes bits one at a time through literal levels L1→L2→L3, then through a dynamic array of hash levels.
 * See `./types.ts` for the `EncodeState`/`Encode` type-level API.
 *
 * @module
 */

import { emptyPipelineState, pipelineStep } from './level/literal/module.f.mjs'
import { encode as hashEncode } from './level/hash/module.f.mjs'
/** @import { Add } from './level/hash/types.ts' */
import { level3Id } from './id/module.f.mjs'
/** @import { Id } from './id/types.ts' */
/** @import { InternalState } from '../types/patricia_trie/types.ts' */
/** @import { EncodeState, Encode } from './types.ts' */

/** @typedef {InternalState<Id>} _HashState */

/** @type {<S>(storage: S) => EncodeState<S>} */
export const emptyEncodeState = storage =>
    [emptyPipelineState, storage, []]

export const encode =
    /**
     * @template S
     * @param {Add<S>} add
     * @returns {Encode<S>}
     */
    add => {
        const step = hashEncode(add)

        /** @typedef {readonly [Id | undefined, S, readonly _HashState[]]} _CascadeResult */

        /** @type {(id0: Id, storage0: S, stacks0: readonly _HashState[]) => _CascadeResult} */
        const cascade = (id0, storage0, stacks0) => {
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

        /** @type {(bit: bigint, state: EncodeState<S>) => readonly [Id | undefined, EncodeState<S>]} */
        const literalStep = (bit, state) => {
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
