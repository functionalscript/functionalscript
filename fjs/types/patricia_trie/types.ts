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

/**
 * A node of a trie the demo (`./demo.f.mjs`) builds: a leaf holding its key,
 * or a branch holding its two children's identities.
 */
export type _DemoNode = readonly ['leaf', number] | readonly ['branch', string, string]

/** The demo's two key sets: before the last step, and after it. */
export type _DemoVersions = {
    readonly before: readonly number[]
    readonly after: readonly number[]
}

/**
 * What the demo's drawing shows: a preset as it was loaded — its name, and
 * the hint saying which button to press — or the step that turned the old
 * key set into the new one (`insert 100`).
 */
export type _DemoStatus =
    | { readonly preset: string, readonly hint: string }
    | { readonly last: string }

/**
 * The demo's state: the key field as typed, the two key sets, what they
 * show, and why the last press did nothing, if it did nothing.
 */
export type _DemoState = {
    readonly key: string
    readonly versions: _DemoVersions
    readonly status: _DemoStatus
    readonly error: string | null
}
