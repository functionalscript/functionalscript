/**
 * Streaming encoder for the full SUL pipeline.
 * Processes bits one at a time through literal levels L1→L2→L3, then through a dynamic array of hash levels.
 * A bit's height is how many levels close a word on it, counting up from L1.
 * See `./types.ts` for the `EncodeState`/`Encode` type-level API.
 *
 * @module
 *
 * @import { Add } from './level/hash/types.ts'
 * @import { Id } from './id/types.ts'
 * @import { InternalState } from '../types/patricia_trie/types.ts'
 * @import { List } from '../types/list/types.ts'
 * @import { EncodeState, Encode } from './types.ts'
 * @import { EncodeState as LiteralEncodeState, PipelineState } from './level/literal/types.ts'
 */

import { emptyPipelineState, levels } from './level/literal/module.f.mjs'
import { encode as hashEncode } from './level/hash/module.f.mjs'
import { level3Id } from './id/module.f.mjs'
import { toArray } from '../types/list/alt/module.f.js'
import { doneStep, nextStep } from '../types/function/operator/module.f.js'

/**
 * `ps` with literal level `i`'s state replaced.
 *
 * @type {(ps: PipelineState, i: number, state: LiteralEncodeState) => PipelineState}
 */
const withLevel = ([l1, l2, l3], i, state) =>
    i === 0 ? [state, l2, l3] : i === 1 ? [l1, state, l3] : [l1, l2, state]

/** @type {(tail: List<number>, first: number) => List<number>} */
const prepend = (tail, first) => ({ first, tail })

/**
 * Feeds `symbol` to literal level `i` and on up while each level
 * closes a word: how many closed one, and L3's output if L3 did.
 *
 * @type {(symbol: bigint, ps: PipelineState, i: number) => readonly [number, bigint | undefined, PipelineState]}
 */
const literalFrom = (symbol, ps, i) => {
    if (i === levels.length) { return [i, symbol, ps] }
    const [out, next] = levels[i].encode(symbol, ps[i])
    const nextPs = withLevel(ps, i, next)
    return out === undefined ? [i, undefined, nextPs] : literalFrom(out, nextPs, i + 1)
}

/** @type {() => null} */
const discardHeight = () => null

export const encode =
    /**
     * @template S
     * @param {Add<S>} add
     * @returns {(storage: S) => Encode<S>}
     */
    add => {
        const step = hashEncode(add)

        /** @typedef {readonly [number, Id | undefined, S, readonly InternalState<Id>[]]} _CascadeResult */

        // Recursive rather than a `for(;;)` loop: every exit is one of the two
        // `return`s below, so a bare `for(;;)` picks up a phantom "loop falls
        // through" branch that V8's coverage instrumentation can never mark
        // taken — there is no third way out to take it. Recursion has no such
        // branch to begin with.
        /**
         * Feeds `id` to hash level `index` and on up while each level closes
         * a word: how many closed one, and `id` again when it reaches a level
         * that did not exist yet, which it opens.
         *
         * @type {(id: Id, storage: S, stacks: readonly InternalState<Id>[], index: number) => _CascadeResult}
         */
        const cascadeFrom = (id, storage, stacks, index) => {
            if (index >= stacks.length) {
                const [, [newStorage, newStack]] = step(id, [storage, []])
                return [0, id, newStorage, [...stacks, newStack]]
            }
            const [out, [newStorage, newStack]] = step(id, [storage, stacks[index]])
            const newStacks = [...stacks.slice(0, index), newStack, ...stacks.slice(index + 1)]
            if (out === undefined) { return [0, undefined, newStorage, newStacks] }
            const [height, finalId, s, st] = cascadeFrom(out, newStorage, newStacks, index + 1)
            return [height + 1, finalId, s, st]
        }

        /**
         * One bit through every level: its height, the `Id` that opened a new
         * top level on it, if one did, and the next state.
         *
         * @type {(bit: bigint, state: EncodeState<S>) => readonly [number, Id | undefined, EncodeState<S>]}
         */
        const bitStep = (bit, [ps, storage, stacks]) => {
            const [literalHeight, l3Out, newPs] = literalFrom(bit, ps, 0)
            if (l3Out === undefined) { return [literalHeight, undefined, [newPs, storage, stacks]] }
            const [hashHeight, finalId, newStorage, newStacks] = cascadeFrom(level3Id(l3Out), storage, stacks, 0)
            return [literalHeight + hashHeight, finalId, [newPs, newStorage, newStacks]]
        }

        /** @type {Encode<S>['updateWithHeight']} */
        const updateWithHeight = (state, bit) => {
            const [height, , next] = bitStep(bit, state)
            return [height, next]
        }

        /**
         * Pads with a `1`, then `0`s, until an `Id` opens a new top level:
         * that `Id` is the root. Each padding bit's height is folded into
         * `acc` with `f`: `endWithHeights` keeps them, and `end`, which keeps
         * none, holds nothing per bit however long the padding runs.
         *
         * @type {<A>(state: EncodeState<S>, f: (acc: A, height: number) => A, acc: A) => readonly [A, Id]}
         */
        const pad = (state, f, acc0) => {
            // A loop, not a recursion: the padding can run to thousands of
            // bits, and a frame per bit overflows the stack.
            let [height, id, s] = bitStep(1n, state)
            let acc = f(acc0, height)
            while (id === undefined) {
                [height, id, s] = bitStep(0n, s)
                acc = f(acc, height)
            }
            return [acc, id]
        }

        /** @type {Encode<S>['endWithHeights']} */
        const endWithHeights = state => {
            // Kept newest first as a list, so each bit adds one node rather
            // than copying every height before it.
            const [reversed, root] = pad(state, prepend, null)
            return [toArray(reversed).toReversed(), root]
        }

        /** @type {Encode<S>['update']} */
        const update = (state, bit) => {
            const [, next] = updateWithHeight(state, bit)
            return nextStep(next)
        }

        /** @type {Encode<S>['end']} */
        const end = state => {
            const [, root] = pad(state, discardHeight, null)
            return doneStep(root)
        }

        return storage => {
            /** @type {EncodeState<S>} */
            const initial = [emptyPipelineState, storage, []]
            return {
                init: nextStep(initial),
                update,
                end,
                updateWithHeight,
                endWithHeights,
            }
        }
    }
