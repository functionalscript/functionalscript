/**
 * Types for managing and merging range maps.
 */

import type { Equal, Reduce } from '../function/operator/types.ts'
import type { Range } from '../range/types.ts'
import type { SortedList } from '../sorted_list/types.ts'

export type Entry<T> = [T, number]

/**
 * A sorted list of entries, where each entry is a tuple `[T, number]` that maps
 * a value of type `T` to an upper boundary of a numeric range.
 */
export type RangeMap<T> = SortedList<Entry<T>>

export type RangeMapArray<T> = readonly Entry<T>[]

/**
 * Defines the properties and operations required for managing range maps.
 *
 * @property union
 *
 * A function to merge two values of type `T`. This defines how overlapping ranges are combined.
 *
 * @property equal
 *
 * A function to check equality between two values of type `T`.
 *
 * @property def
 *
 * The default value used when no range matches or for initializing ranges.
 */
export type Properties<T> = {
    readonly union: Reduce<T>
    readonly equal: Equal<T>
    readonly def: T
}

export type RangeMerge<T> = Reduce<RangeMap<T>>

/**
 * Represents a set of operations for managing range maps.
 *
 * @property merge
 *
 * Merges two range maps into a single range map.
 *
 * @property get
 *
 * Retrieves the value associated with a given numeric range.
 *
 * @property fromRange
 *
 * Constructs a range map for a single numeric range and value.
 */
export type RangeMapOp<T> = {
    readonly merge: RangeMerge<T>
    readonly get: (rm: RangeMapArray<T>) => (value: number) => T
    readonly fromRange: (value: T) => (r: Range) => RangeMapArray<T>
}
