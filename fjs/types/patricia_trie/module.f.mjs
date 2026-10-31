/**
 * Streaming Patricia trie for building content-addressed binary trees from sorted leaf sequences.
 *
 * @module
 *
 * @import { Create, PatriciaTrie } from './types.ts'
 */

import { splitLast } from '../array/module.f.mjs'
import { doneStep, nextStep } from '../function/operator/module.f.js'

/**
 * Creates a Patricia trie whose node merging is delegated to `create`, with
 * `storage` in its initial state. The machine consumes leaves through the shared
 * `init` / `update` / `end` lifecycle and returns its root and final storage.
 *
 * @template S
 * @template T
 * @param {Create<S, T>} create
 * @returns {(storage: S) => PatriciaTrie<S, T>}
 */
export const patriciaTrie = create => {
    /** @type {PatriciaTrie<S, T>['update']} */
    const update = ([storage, stack], c) => {
        const [u] = c
        // Carry propagation: merge the top two candidates for as long as they
        // are more tightly coupled to each other than the right one is to the
        // incoming leaf. Genuinely sequential — each merge decides whether the
        // next one happens — so the loop stays, but the stack is read by
        // splitting rather than by index arithmetic. Either split answering
        // `null` means fewer than two candidates are left, which is where the
        // old `stack.length >= 2` guard stopped.
        while (true) {
            const top = splitLast(stack)
            if (top === null) { break }
            const [belowR, [rLeaf, rHash]] = top
            const below = splitLast(belowR)
            if (below === null) { break }
            const [rest, [lLeaf, lHash]] = below
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const [h, newS] = create(lHash, rHash, storage)
            storage = newS
            stack = [...rest, [rLeaf, h]]
        }
        return nextStep(/** @type {const} */ ([storage, [...stack, c]]))
    }
    // Drain the right spine into a root: a right fold whose seed is the last
    // candidate's identity. `splitLast` supplies both halves at once, so the
    // empty stack is the `null` branch rather than a separate length guard.
    /** @type {PatriciaTrie<S, T>['end']} */
    const end = ([storage, stack]) => {
        const split = splitLast(stack)
        if (split === null) { return doneStep(/** @type {const} */ ([undefined, storage])) }
        const [rest, [, lastHash]] = split
        return doneStep(rest.reduceRight(
            ([h, s], [, lHash]) => create(lHash, h, s),
            /** @type {readonly [typeof lastHash, typeof storage]} */([lastHash, storage])))
    }
    return storage => ({
        init: nextStep(/** @type {const} */ ([storage, []])),
        update,
        end,
    })
}
