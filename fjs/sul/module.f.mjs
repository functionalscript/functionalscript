/**
 * Streaming encoder for the full SUL pipeline.
 * Processes bits one at a time through literal levels L1→L2→L3, then through a dynamic array of hash levels.
 * See `./types.ts` for the `EncodeState`/`Encode` type-level API.
 *
 * @module
 *
 * @import { Add } from './level/hash/types.ts'
 * @import { Id } from './id/types.ts'
 * @import { InternalState } from '../types/patricia_trie/types.ts'
 * @import { EncodeState, Encode } from './types.ts'
 */

import { emptyPipelineState, pipelineStep } from './level/literal/module.f.mjs'
import { encode as hashEncode } from './level/hash/module.f.mjs'
import { level3Id } from './id/module.f.mjs'

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

        /** @typedef {readonly [Id | undefined, S, readonly InternalState<Id>[]]} _CascadeResult */

        // Recursive rather than a `for(;;)` loop: every exit is one of the two
        // `return`s below, so a bare `for(;;)` picks up a phantom "loop falls
        // through" branch that V8's coverage instrumentation can never mark
        // taken — there is no third way out to take it. Recursion has no such
        // branch to begin with.
        /** @type {(id: Id, storage: S, stacks: readonly InternalState<Id>[], index: number) => _CascadeResult} */
        const cascadeFrom = (id, storage, stacks, index) => {
            if (index >= stacks.length) {
                const [, [newStorage, newStack]] = step(id, [storage, []])
                return [id, newStorage, [...stacks, newStack]]
            }
            const [out, [newStorage, newStack]] = step(id, [storage, stacks[index]])
            const newStacks = [...stacks.slice(0, index), newStack, ...stacks.slice(index + 1)]
            return out === undefined
                ? [undefined, newStorage, newStacks]
                : cascadeFrom(out, newStorage, newStacks, index + 1)
        }

        /** @type {(id0: Id, storage0: S, stacks0: readonly InternalState<Id>[]) => _CascadeResult} */
        const cascade = (id0, storage0, stacks0) => cascadeFrom(id0, storage0, stacks0, 0)

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
