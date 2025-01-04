/**
 * Utility functions and types for managing and merging range maps.
 *
 * @module
 *
 * @example
 *
 * ```js
 * const rmOps = rangeMap({
 *     union: a => b => a | b,
 *     equal: a => b => a === b,
 *     def: 0,
 * })
 *
 * // Create range maps
 * const range1 = rmOps.fromRange([0, 10])(2)
 * const range2 = rmOps.fromRange([5, 15])(5)
 *
 * // Merge range maps
 * const merged = toArray(rmOps.merge(range1)(range2))
 *
 * // Retrieve values from the merged range map
 * //
 * if (rmOps.get(-1)(merged) !== 0) { throw 'error' }
 * //
 * if (rmOps.get(0)(merged) !== 2) { throw 'error' }
 * if (rmOps.get(2)(merged) !== 2) { throw 'error' }
 * // overlapped: 2 | 5 = 7
 * if (rmOps.get(7)(merged) !== 7) { throw 'error' }
 * //
 * if (rmOps.get(12)(merged) !== 5) { throw 'error' }
 * if (rmOps.get(15)(merged) !== 5) { throw 'error' }
 * //
 * if (rmOps.get(16)(merged) !== 0) { throw 'error' }
 * ```
 */

import { genericMerge, type TailReduce, type ReduceOp, type SortedList } from '../sorted_list/module.f.ts'
import { next } from '../list/module.f.ts'
import type { Nullable } from '../nullable/module.f.ts'
import { cmp } from '../number/module.f.ts'
import type { Reduce, Equal } from '../function/operator/module.f.ts'
import type { Range } from '../range/module.f.ts'

export type Entry<T> = [T, number]

/**
 * A sorted list of entries, where each entry is a tuple `[T, number]` that maps a value of type `T` to an upper boundary
 * of a numeric range.
 */
export type RangeMap<T> = SortedList<Entry<T>>

export type RangeMapArray<T> = readonly Entry<T>[]

/**
 * Defines the properties and operations required for managing range maps.
 */
export type Properties<T> = {
    /**
     * A function to merge two values of type `T`. This defines how overlapping ranges are combined.
     */
    readonly union: Reduce<T>
    /**
     * A function to check equality between two values of type `T`.
     */
    readonly equal: Equal<T>
    /**
     * The default value used when no range matches or for initializing ranges.
     */
    readonly def: T
}

type RangeState<T> = Nullable<Entry<T>>

export type RangeMerge<T> = Reduce<RangeMap<T>>

const reduceOp: <T>(p: Properties<T>) => ReduceOp<Entry<T>, RangeState<T>>
    = ({ union, equal }) => state => ([aItem, aMax]) => ([bItem, bMax]) => {
        const sign = cmp(aMax)(bMax)
        const min = sign === 1 ? bMax : aMax
        const u = union(aItem)(bItem)
        const newState = state !== null && equal(state[0])(u) ? null : state
        return [newState, sign, [u, min]]
    }

const tailReduce: <T>(equal: Equal<T>) => TailReduce<Entry<T>, RangeState<T>>
    = equal => state => tail => {
        if (state === null) { return tail }
        const tailResult = next(tail)
        if (tailResult === null) { return [state] }
        if (equal(state[0])(tailResult.first[0])) { return tailResult }
        return { first: state, tail: tailResult }
    }

export const merge: <T>(op: Properties<T>) => RangeMerge<T>
    = op => genericMerge({ reduceOp: reduceOp(op), tailReduce: tailReduce(op.equal) })(null)

export const get: <T>(def: T) => (value: number) => (rm: RangeMapArray<T>) => T
    = def => value => rm => {
        const len = rm.length
        let b = 0
        let e = len - 1
        while (true) {
            if (b >= len) { return def }
            if (e - b < 0) { return rm[b][0] }
            const mid = b + (e - b >> 1)
            if (value <= rm[mid][1]) {
                e = mid - 1
            } else {
                b = mid + 1
            }
        }
    }

export const fromRange: <T>(def: T) => (r: Range) => (value: T) => RangeMapArray<T>
    = def => ([a, b]) => v => [[def, a - 1], [v, b]]

/**
 * Represents a set of operations for managing range maps.
 */
export type RangeMapOp<T> = {
    /**
     * Merges two range maps into a single range map.
     */
    readonly merge: RangeMerge<T>
    /**
     * Retrieves the value associated with a given numeric range.
     */
    readonly get: (value: number) => (rm: RangeMapArray<T>) => T
    /**
     * Constructs a range map for a single numeric range and value.
     */
    readonly fromRange: (r: Range) => (value: T) => RangeMapArray<T>
}

/**
 * Creates a set of operations for managing range maps using the specified properties.
 *
 * @param op - The properties defining union and equality operations and the default value.
 * @returns An object containing operations for merging, retrieving, and constructing range maps.
 */
export const rangeMap = <T>(op: Properties<T>): RangeMapOp<T> => ({
    merge: merge(op),
    get: get(op.def),
    fromRange: fromRange(op.def),
})
