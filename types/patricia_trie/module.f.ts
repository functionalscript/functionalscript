/**
 * Streaming Patricia trie for building content-addressed binary trees from sorted leaf sequences.
 *
 * @module
 */

/** Merges two child identities into a parent. Values first, storage last in both params and return. */
export type Create<S, T> = (a: T, b: T, storage: S) => readonly[T, S]

/** A leaf entry: `[sortKey, identity]`. The sort key is used only for XOR comparisons. */
export type Candidate<T> = readonly[bigint, T]

/** Streaming state: `[storage, right-spine stack]`. */
export type State<S, T> = readonly[S, readonly Candidate<T>[]]

export type PatriciaTrie<S, T> = {
    /** Add one leaf. Merges any tightly-coupled stack candidates before pushing. */
    readonly push: (c: Candidate<T>, state: State<S, T>) => State<S, T>
    /**
     * Drain the stack right-to-left, returning the root identity and final storage.
     * Returns `undefined` as the root if no leaves were pushed.
     */
    readonly end: (state: State<S, T>) => readonly[T | undefined, S]
}

/** Creates a Patricia trie whose node merging is delegated to `create`. */
export const patriciaTrie = <S, T>(create: Create<S, T>): PatriciaTrie<S, T> => ({
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

/** Constructs the initial state from a storage value. */
export const emptyState = <S>(storage: S): readonly[S, readonly[]] => [storage, []]
