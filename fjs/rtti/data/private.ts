/**
 * Implementation-private types for the RTTI data conversion.
 *
 * @module
 */

import type { StringMap } from '../../types/object/types.ts'
import type { Const, Type } from '../types.ts'
import type { Primitive, Unknown } from '../ts/types.ts'
import type { ResultE } from '../common/types.ts'
import type { Node, RuleSet, UnionSet } from './types.ts'

export type _Ctx = readonly [RuleSet, RuleSet]

export type _Assumed = StringMap<StringMap<true>>

export type _Keyed = readonly [Node, string | undefined]

export type _CompareNode = (a: Node, b: Node) => number

export type _KeyedSubset = (ctx: _Ctx) => (assumed: _Assumed) => (a: _Keyed, b: _Keyed) => boolean

export type _NodeMap = (n: Node) => Node

export type _NodeRefs = (n: Node) => readonly string[]

export type _NodeValidate = (rules: RuleSet) => (n: Node) => (value: Unknown) => ResultE

export type _NodeOf = (state: _State) => (t: Type) => readonly [_State, Node]

export type _ConvertThunk = (state: _State, t: _Thunk) => readonly [_State, UnionSet]

export type _Thunk = Exclude<Type, Const>

export type _Key = Exclude<Type, Primitive>

/**
 * The conversion state, threaded functionally:
 *
 * - `converting` — thunks whose union is being computed (the recursion stack).
 * - `names` — decimal ordinals assigned on the first required reference to a
 *   thunk (a cycle or deferred merge), reused by thunk identity.
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
