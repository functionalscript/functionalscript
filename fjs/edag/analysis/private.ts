/**
 * Implementation-private types of the EDAG analysis: what the walk carries
 * from one node to the next.
 *
 * @module
 */

import type { ExpOp, TagMap } from '../amnesia/types.ts'
import type { Node } from './types.ts'

/** The `=>` node whose body is being walked, or `null` at the module level. */
export type _Scope = ExpOp | null

/** An entry as the walk holds it: its scope by the `=>` object, since that node's index is not known until its body is walked. */
export type _Entry = { readonly scope: _Scope, readonly node: Node }

/**
 * The walk so far. `visited` is every node added, by identity, to its index
 * — a merged node to the index of the entry it merged into — which is the
 * one structure keyed by identity, and it lives here and nowhere
 * downstream.
 */
export type _State = {
    readonly visited: ReadonlyMap<ExpOp, number>
    readonly entries: readonly _Entry[]
}

/** A walker: given the scope, threads the state through `e` and yields what stands for it in the table. */
export type _Walk<E, R> = (scope: _Scope) => (state: _State, e: E) => readonly [_State, R]

/** One walker per node tag, each seeing its own tuple type. */
export type _Handlers = { readonly [K in ExpOp[0]]: _Walk<TagMap[K], Node> }
