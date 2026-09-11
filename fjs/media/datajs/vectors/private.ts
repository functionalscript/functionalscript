/**
 * Implementation-private types of the comparison: the tasks its explicit
 * stack holds, and the pairs of containers it has matched so far, which is
 * the bijection sharing is checked against.
 *
 * @module
 */

import type { Primitive, Unknown } from '../types.ts'
import type { TreeArray, TreeObject } from '../../json/types.ts'

/** One comparison still to make: where it is, and the two values, or the expected one where the actual is a hole. */
export type _Task =
    | readonly [path: string, expected: Unknown, actual: Unknown]
    | readonly [path: string, expected: Unknown, actual: undefined, mark: _Mark]

/** What stands where a member's value would, when the actual has no value there to read. */
export type _Mark = 'hole' | 'accessor'

/** An own member of an actual container: its value, or what stands in place of one. */
export type _Member = readonly ['value', Unknown] | readonly [_Mark]

/** A container of the data model: what a task holds once both values are known to be objects. */
export type _Container = TreeObject<Primitive> | TreeArray<Primitive>

export type _Stack = { readonly top: _Task, readonly rest: _Stack } | null

/** A container of the expected graph beside the one it corresponds to in the actual. */
export type _Pair = readonly [expected: object, actual: object]

export type _State = readonly [stack: _Stack, pairs: readonly _Pair[]]
