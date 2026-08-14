/**
 * Streaming encoder for SUL hash-level symbols using a Patricia trie and 256-bit content-addressed hashes.
 * See `./types.ts` for the `Add`/`EncodeState` type-level API.
 *
 * @module
 *
 * @import { Create } from '../../../types/patricia_trie/types.ts'
 * @import { Id } from '../../id/types.ts'
 * @import { Add, EncodeState } from './types.ts'
 */

import { emptyState, patriciaTrie } from '../../../types/patricia_trie/module.f.mjs'
import { compress } from '../../id/module.f.mjs'
import { asBase } from '../../../types/nominal/module.f.mjs'

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
 * `add` is called once for every `compress` call. `isSymbol` is `false` for
 * Patricia trie internal merges and `true` for the terminal `compress(root, t)`.
 */
export const encode =
    /**
     * @template S
     * @param {Add<S>} add
     * @returns {(symbol: Id, state: EncodeState<S>) => readonly [Id | undefined, EncodeState<S>]}
     */
    add => {
        /** @type {(isSymbol: boolean) => Create<S, Id>} */
        const create = isSymbol => (a, b, s) => {
            const m = compress(a, b)
            return [m, add(a, b, m, isSymbol, s)]
        }
        const { push, end } = patriciaTrie(create(false))
        const rootCreate = create(true)
        return (symbol, state) => {
            const [, stack] = state
            const last = stack.at(-1)
            if (last === undefined || last[0] > asBase(symbol)) {
                return [undefined, push([asBase(symbol), symbol], state)]
            }
            const [root1, storage1] = end(state)
            const [root2, storage2] = rootCreate(/** @type {Id} */ (root1), symbol, storage1)
            return [root2, [storage2, []]]
        }
    }

/**
 * Returns the initial encoding state wrapping `storage`.
 *
 * @type {<S>(storage: S) => EncodeState<S>}
 */
export const emptyEncodeState = emptyState
