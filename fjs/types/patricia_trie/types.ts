/**
 * Types for the streaming Patricia trie.
 *
 * @module
 */

/**
 * Merges two child identities into a parent. Values first, storage last in both
 * params and return.
 */
export type Create<S, T> = (a: T, b: T, storage: S) => readonly [T, S]

/**
 * A leaf entry: `[sortKey, identity]`. The sort key is used only for XOR
 * comparisons.
 */
export type Candidate<T> = readonly [bigint, T]

export type InternalState<T> = readonly Candidate<T>[]

/**
 * Streaming state: `[storage, right-spine stack]`.
 */
export type State<S, T> = readonly [S, InternalState<T>]

/**
 * @property push
 *
 * Add one leaf. Merges any tightly-coupled stack candidates before pushing.
 *
 * @property end
 *
 * Drain the stack right-to-left, returning the root identity and final storage.
 * Returns `undefined` as the root if no leaves were pushed.
 */
export type PatriciaTrie<S, T> = {
    readonly push: (c: Candidate<T>, state: State<S, T>) => State<S, T>
    readonly end: (state: State<S, T>) => readonly [T | undefined, S]
}
