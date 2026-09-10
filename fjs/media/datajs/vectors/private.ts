import type { Primitive, Unknown } from '../types.ts'
import type { TreeArray, TreeObject } from '../../json/types.ts'

/** One comparison still to make: where it is, and the two values. */
export type _Task = readonly [path: string, expected: Unknown, actual: Unknown]

/** A container of the data model: what a task holds once both values are known to be objects. */
export type _Container = TreeObject<Primitive> | TreeArray<Primitive>

export type _Stack = { readonly top: _Task, readonly rest: _Stack } | null

/** A container of the expected graph beside the one it corresponds to in the actual. */
export type _Pair = readonly [expected: object, actual: object]

export type _State = readonly [stack: _Stack, pairs: readonly _Pair[]]
