/**
 * Types for sorted immutable lists and their merge operations.
 */

import type { Sign } from '../function/compare/types.ts'
import type { List } from '../list/types.ts'
import type { Nullable } from '../nullable/types.ts'

export type SortedList<T> = List<T>

export type ReduceOp<T, S> =
    (state: S) => (a: T) => (b: T) => readonly [Nullable<T>, Sign, S]

export type TailReduce<T, S> = (state: S) => (tail: List<T>) => List<T>

export type _MergeReduce<T, S> = {
    readonly reduceOp: ReduceOp<T, S>
    readonly tailReduce: TailReduce<T, S>
}
