/**
 * Streaming encoder for SUL hash-level symbols using a Patricia trie and 256-bit content-addressed hashes.
 *
 * @module
 */

import { emptyState, patriciaTrie, type Create, type State } from '../../../patricia_trie/module.f.ts'
import { compress } from '../../hash/module.f.ts'

/**
 * Called once per merge during encoding. `merged = compress(left, right)`.
 * Implementations record the triple in a content-addressed store.
 */
export type Add<S> = (left: bigint, right: bigint, merged: bigint, storage: S) => S

/**
 * Streaming state for hash-level encoding.
 * Wraps the Patricia trie state that accumulates the strictly-decreasing
 * prefix of the word currently being encoded.
 */
export type EncodeState<S> = State<S, bigint>

/**
 * Returns a streaming encoder for hash-level symbols.
 *
 * The returned step function processes one level-3 symbol at a time.
 * It returns `undefined` while the strictly-decreasing prefix is still
 * being accumulated. When the terminating symbol `t` arrives (`t >= last`),
 * the word `[s0 > ... > sk, t]` is finalised:
 *
 * 1. The Patricia trie of `[s0, ..., sk]` is collapsed to a root hash.
 * 2. The root is merged with `t` via `compress`, producing the output symbol.
 * 3. State is reset to an empty stack (storage is preserved).
 *
 * `add` is called once for every `compress` call, recording the merge triple.
 */
export const encode =
    <S>(add: Add<S>): (symbol: bigint, state: EncodeState<S>) => readonly[bigint|undefined, EncodeState<S>] =>
{
    const create: Create<S, bigint> = (a, b, s) => {
        const m = compress(a, b)
        return [m, add(a, b, m, s)]
    }
    const { push, end } = patriciaTrie(create)
    return (symbol, state) => {
        const [, stack] = state
        const last = stack.at(-1)
        if (last === undefined || last[0] > symbol) {
            return [undefined, push([symbol, symbol], state)]
        }
        const [root1, storage1] = end(state)
        const [root2, storage2] = create(root1!, symbol, storage1)
        return [root2, [storage2, []]]
    }
}

/** Returns the initial encoding state wrapping `storage`. */
export const emptyEncodeState: <S>(storage: S) => EncodeState<S> = emptyState
