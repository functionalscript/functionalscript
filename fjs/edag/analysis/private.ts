/**
 * Implementation-private types of the EDAG analysis: what the walk carries
 * from one node to the next.
 *
 * @module
 */

import type { Exp, ExpOp, Function, Group, TagMap } from '../types.ts'
import type { Node, Operand } from './types.ts'
import type { PersistentMap } from '../../types/map/types.ts'
import type { List } from '../../types/list/types.ts'

/** The current function or group member. Module entries have no owner. */
export type _Scope = Function | { readonly group: Group, readonly index: number } | null

/** An entry as the walk holds it: its scope by the `=>` object, since that node's index is not known until its body is walked. */
export type _Entry = { readonly scope: _Scope, readonly node: Node }

/** What the walk knows of a node it has added: its entry's index and the scope it was added in. */
export type _Seen = readonly [index: number, scope: _Scope]

/** The entries of one scope that may merge, by spelling, to their index. */
export type _Twins = PersistentMap<string, number>

/**
 * The walk so far. `visited` is every node added, by identity, to its
 * entry — a merged node to the entry it merged into — which is the one
 * structure keyed by identity, and it lives here and nowhere downstream.
 * `added` is the table last entry first, and `count` its length, so
 * adding one shares all before it.
 */
export type _State = {
    readonly visited: PersistentMap<ExpOp, _Seen>
    readonly added: List<_Entry>
    readonly count: number
    readonly twins: PersistentMap<_Scope, _Twins>
    /** First structural failure; an errored walk never yields a public table. */
    readonly problem: string | null
    /** Whether an entry that may merge does so with its twin, or every node is its own entry. */
    readonly merges: boolean
}

/** A walker: given the scope, threads the state through `e` and yields what stands for it in the table. */
export type _Walk<E, R> = (scope: _Scope) => (state: _State, e: E) => readonly [_State, R]

/** A walker whose recursive expression walk is supplied by its caller. */
export type _Handler<E, R> = (walk: _Walk<Exp, Operand>) => _Walk<E, R>

/** One walker per node tag, each seeing its own tuple type. */
export type _Handlers = { readonly [K in ExpOp[0]]: _Handler<TagMap[K], Node> }

/** The expression each entry so far stands for, by index. */
export type _Exps = PersistentMap<number, ExpOp>
