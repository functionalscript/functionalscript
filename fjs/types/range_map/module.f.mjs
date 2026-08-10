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
 * const range1 = rmOps.fromRange(2)([0, 10])
 * const range2 = rmOps.fromRange(5)([5, 15])
 *
 * // Merge range maps
 * const merged = toArray(rmOps.merge(range1)(range2))
 *
 * // Retrieve values from the merged range map
 * const get = rmOps.get(merged)
 * //
 * if (get(-1) !== 0) { throw 'error' }
 * //
 * if (get(0) !== 2) { throw 'error' }
 * if (get(2) !== 2) { throw 'error' }
 * // overlapped: 2 | 5 = 7
 * if (get(7) !== 7) { throw 'error' }
 * //
 * if (get(12) !== 5) { throw 'error' }
 * if (get(15) !== 5) { throw 'error' }
 * //
 * if (get(16) !== 0) { throw 'error' }
 * ```
 */

import { genericMerge } from '../sorted_list/module.f.mjs'
/** @import { TailReduce, ReduceOp, SortedList } from '../sorted_list/module.f.mjs' */
import { next } from '../list/module.f.mjs'
/** @import { Nullable } from '../nullable/module.f.mjs' */
import { cmp } from '../number/module.f.mjs'
import { bsearch } from '../function/compare/module.f.mjs'
/** @import { Reduce, Equal } from '../function/operator/module.f.mjs' */
/** @import { Range } from '../range/module.f.mjs' */

/** @template T @typedef {[T, number]} Entry */

/**
 * A sorted list of entries, where each entry is a tuple `[T, number]` that maps a value of type `T` to an upper boundary
 * of a numeric range.
 *
 * @template T
 * @typedef {SortedList<Entry<T>>} RangeMap
 */

/** @template T @typedef {readonly Entry<T>[]} RangeMapArray */

/**
 * Defines the properties and operations required for managing range maps.
 *
 * @template T
 * @typedef {{
 *  readonly union: Reduce<T>
 *  readonly equal: Equal<T>
 *  readonly def: T
 * }} Properties
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

/** @template T @typedef {Nullable<Entry<T>>} _RangeState */

/** @template T @typedef {Reduce<RangeMap<T>>} RangeMerge */

const reduceOp =
    /**
     * @template T
     * @param {Properties<T>} p
     * @returns {ReduceOp<Entry<T>, _RangeState<T>>}
     */
    ({ union, equal }) => state => ([aItem, aMax]) => ([bItem, bMax]) => {
        const sign = cmp(aMax)(bMax)
        const min = sign === 1 ? bMax : aMax
        const u = union(aItem)(bItem)
        const newState = state !== null && equal(state[0])(u) ? null : state
        return [newState, sign, [u, min]]
    }

const tailReduce =
    /**
     * @template T
     * @param {Equal<T>} equal
     * @returns {TailReduce<Entry<T>, _RangeState<T>>}
     */
    equal => state => tail => {
        if (state === null) { return tail }
        const tailResult = next(tail)
        if (tailResult === null) { return [state] }
        if (equal(state[0])(tailResult.first[0])) { return tailResult }
        return { first: state, tail: tailResult }
    }

export const merge =
    /**
     * @template T
     * @param {Properties<T>} op
     * @returns {RangeMerge<T>}
     */
    op => genericMerge({ reduceOp: reduceOp(op), tailReduce: tailReduce(op.equal) })(null)

export const get =
    /**
     * @template T
     * @param {T} def
     */
    def =>
        /** @param {RangeMapArray<T>} rm */
        rm => {
            const length = rm.length
            const search = bsearch(length)
            /** @param {number} value */
            return value => {
                const pos = search(mid => value <= rm[mid][1] ? -1 : 1)
                return pos < length ? rm[pos][0] : def
            }
        }

export const fromRange =
    /**
     * @template T
     * @param {T} def
     */
    def =>
        /** @param {T} v */
        v =>
            /** @param {Range} r */
            ([a, b]) => /** @type {RangeMapArray<T>} */([[def, a - 1], [v, b]])

/**
 * Represents a set of operations for managing range maps.
 *
 * @template T
 * @typedef {{
 *  readonly merge: RangeMerge<T>
 *  readonly get: (rm: RangeMapArray<T>) => (value: number) => T
 *  readonly fromRange: (value: T) => (r: Range) => RangeMapArray<T>
 * }} RangeMapOp
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

/**
 * Creates a set of operations for managing range maps using the specified properties.
 *
 * @template T
 * @param {Properties<T>} op The properties defining union and equality operations and the default value.
 * @returns {RangeMapOp<T>} An object containing operations for merging, retrieving, and constructing range maps.
 */
export const rangeMap = op => ({
    merge: merge(op),
    get: get(op.def),
    fromRange: fromRange(op.def),
})
