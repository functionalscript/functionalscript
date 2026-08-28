/**
 * Implementation-private types for the RTTI data conversion.
 */

import type { StringMap } from '../../types/object/types.ts'
import type { Const, Type } from '../types.ts'
import type { Primitive } from '../ts/types.ts'
import type { Node, RuleSet, UnionSet } from './types.ts'

export type _Ctx = readonly [RuleSet, RuleSet]

export type _Assumed = StringMap<StringMap<true>>

export type _Keyed = readonly [Node, string | undefined]

export type _NodeMap = (n: Node) => Node

export type _Thunk = Exclude<Type, Const>

export type _Key = Exclude<Type, Primitive>

/**
 * The conversion state, threaded functionally:
 *
 * - `converting` — thunks whose union is being computed (the recursion stack).
 * - `names` — rule names, assigned to a thunk the moment something needs to
 *   reference it (a cycle, or a deferred merge).
 * - `done` — computed unions, memoized by identity.
 * - `deferred` — union merges `target ∪= source` that could not run eagerly
 *   because `source`'s union was not final; resolved by `fixpoint`.
 */
export type _State = {
    readonly converting: readonly _Thunk[]
    readonly names: readonly (readonly [_Thunk, string])[]
    readonly done: readonly (readonly [_Key, UnionSet])[]
    readonly deferred: readonly (readonly [_Thunk, _Thunk])[]
}
