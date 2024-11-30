import sortedList, * as SL from '../sorted_list/module.f.mjs'
const { genericMerge } = sortedList
import list from '../list/module.f.mjs'
const { next } = list
import * as Option from '../nullable/module.f.mjs'
import number from '../number/module.f.mjs'
const { cmp } = number
import * as O from '../function/operator/module.f.mjs'
import _range from '../range/module.f.cjs'

/**
 * @template T
 * @typedef {[T, number]} Entry
 */

/**
 * @template T
 * @typedef {SL.SortedList<Entry<T>>} RangeMap
 */

/**
 * @template T
 * @typedef {readonly Entry<T>[]} RangeMapArray
 */

/**
 * @template T
 * @typedef {{
 *  readonly union: O.Reduce<T>
 *  readonly equal: O.Equal<T>
 * }} Operators
 */

/**
 * @template T
 * @typedef {Option.Nullable<Entry<T>>} RangeState
 */

/**
 * @template T
 * @typedef {O.Reduce<RangeMap<T>>} RangeMerge
 */

/** @type {<T>(union: O.Reduce<T>) => (equal: O.Equal<T>) => SL.ReduceOp<Entry<T>, RangeState<T>>} */
const reduceOp = union => equal => state => ([aItem, aMax]) => ([bItem, bMax]) => {
    const sign = cmp(aMax)(bMax)
    const min = sign === 1 ? bMax : aMax
    const u = union(aItem)(bItem)
    const newState = state !== null && equal(state[0])(u) ? null : state
    return [newState, sign, [u, min]]
}

/** @type {<T>(equal: O.Equal<T>) => SL.TailReduce<Entry<T>, RangeState<T>>} */
const tailReduce = equal => state => tail => {
    if (state === null) { return tail }
    const tailResult = next(tail)
    if (tailResult === null) { return [state] }
    if (equal(state[0])(tailResult.first[0])) { return tailResult }
    return { first: state, tail: tailResult }
}

/** @type {<T>(op: Operators<T>) => RangeMerge<T>} */
const merge = ({ union, equal }) => genericMerge({ reduceOp: reduceOp(union)(equal), tailReduce: tailReduce(equal) })(null)

/** @type {<T>(def: T) => (value: number) => (rm: RangeMapArray<T>) => T} */
const get = def => value => rm => {
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

/** @type {<T>(def: T) => (r: _range.Range) => (value: T) => RangeMapArray<T>} */
const fromRange = def => ([a, b]) => v => [[def, a - 1], [v, b]]

export default {
    /** @readonly */
    merge,
    /** @readonly */
    get,
    /** @readonly */
    fromRange,
}