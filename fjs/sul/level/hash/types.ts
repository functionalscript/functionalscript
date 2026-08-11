/**
 * Type-level API for hash-level SUL encoding.
 *
 * @module
 */

import type { State } from '../../../types/patricia_trie/types.ts'
import type { Id } from '../../id/types.ts'

/**
 * Called once per merge during encoding. `merged = compress(left, right)`.
 * `isSymbol` is `true` for the terminal `compress(root, t)` that produces the
 * word-level output symbol, and `false` for Patricia trie internal merges.
 * Implementations record the triple in a content-addressed store.
 */
export type Add<S> = (left: Id, right: Id, merged: Id, isSymbol: boolean, storage: S) => S

/**
 * Streaming state for hash-level encoding.
 * Wraps the Patricia trie state that accumulates the strictly-decreasing
 * prefix of the word currently being encoded.
 */
export type EncodeState<S> = State<S, Id>
