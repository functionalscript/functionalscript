/**
 * Streaming Patricia trie for building content-addressed binary trees from sorted leaf sequences.
 *
 * @module
 */

/** @import { Candidate, Create, PatriciaTrie } from './types.ts' */

/**
 * Creates a Patricia trie whose node merging is delegated to `create`.
 *
 * @type {<S, T>(create: Create<S, T>) => PatriciaTrie<S, T>}
 */
export const patriciaTrie = create => ({
    push: (c, [storage, stack]) => {
        const [u] = c
        while (stack.length >= 2) {
            const [rLeaf, rHash] = stack[stack.length - 1]
            const [lLeaf, lHash] = stack[stack.length - 2]
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const [h, newS] = create(lHash, rHash, storage)
            storage = newS
            stack = [...stack.slice(0, -2), [rLeaf, h]]
        }
        return [storage, [...stack, c]]
    },
    end: ([storage, stack]) => {
        if (stack.length === 0) { return [undefined, storage] }
        let h = stack[stack.length - 1][1]
        for (let i = stack.length - 2; i >= 0; i--) {
            const lHash = stack[i][1];
            [h, storage] = create(lHash, h, storage)
        }
        return [h, storage]
    }
})

/**
 * Constructs the initial state from a storage value.
 *
 * @type {<S>(storage: S) => readonly [S, readonly []]}
 */
export const emptyState = storage => [storage, []]
