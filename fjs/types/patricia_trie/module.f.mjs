/**
 * Streaming Patricia trie for building content-addressed binary trees from sorted leaf sequences.
 *
 * @module
 */

/**
 * Merges two child identities into a parent. Values first, storage last in both params and return.
 *
 * @template S
 * @template T
 * @typedef {(a: T, b: T, storage: S) => readonly [T, S]} Create
 */

/**
 * A leaf entry: `[sortKey, identity]`. The sort key is used only for XOR comparisons.
 *
 * @template T
 * @typedef {readonly [bigint, T]} Candidate
 */

/**
 * @template T
 * @typedef {readonly Candidate<T>[]} InternalState
 */

/**
 * Streaming state: `[storage, right-spine stack]`.
 *
 * @template S
 * @template T
 * @typedef {readonly [S, InternalState<T>]} State
 */

/**
 * @template S
 * @template T
 * @typedef {{
 *  readonly push: (c: Candidate<T>, state: State<S, T>) => State<S, T>
 *  readonly end: (state: State<S, T>) => readonly [T | undefined, S]
 * }} PatriciaTrie
 *
 * @property push
 *
 * Add one leaf. Merges any tightly-coupled stack candidates before pushing.
 *
 * @property end
 *
 * Drain the stack right-to-left, returning the root identity and final storage.
 * Returns `undefined` as the root if no leaves were pushed.
 */

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
