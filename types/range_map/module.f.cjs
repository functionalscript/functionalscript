const sortedList = require("../sorted_list/module.f.cjs")
const { genericMerge } = sortedList
const list = require("../list/module.f.cjs")
const { next } = list
const option = require("../option/module.f.cjs")
const { cmp } = require('../number/module.f.cjs')
const operator = require("../function/operator/module.f.cjs")
const _range = require('../range/module.f.cjs')

/**
 * @template T
 * @typedef {[T, number]} Entry
 */

/**
 * @template T
 * @typedef {sortedList.SortedList<Entry<T>>} RangeMap
 */

/**
 * @template T
 * @typedef {readonly Entry<T>[]} RangeMapArray
 */

/**
 * @template T
 * @typedef {{
 *  readonly union: operator.Reduce<T>
 *  readonly equal: operator.Equal<T>
  * }} Operators
 */

/**
 * @template T
 * @typedef {option.Option<Entry<T>>} RangeState
 */

/**
 * @template T
 * @typedef {(a: RangeMap<T>) => (b: RangeMap<T>) => RangeMap<T>} RangeMerge
 */

/** @type {<T>(union: operator.Reduce<T>) => (equal: operator.Equal<T>) => sortedList.ReduceOp<Entry<T>, RangeState<T>>} */
const reduceOp = union => equal => state => ([aItem, aMax]) => ([bItem, bMax])  => {
  const sign = cmp(aMax)(bMax)
  const min = sign === 1 ? bMax : aMax
  const u = union(aItem)(bItem)
  const newState = state !== undefined && equal(state[0])(u) ? undefined : state
  return [newState, sign, [u, min]]
}

/** @type {<T>(equal: operator.Equal<T>) => sortedList.TailReduce<Entry<T>, RangeState<T>>} */
const tailReduce = equal => state => tail => {
  if (state === undefined) { return tail }
  const tailResult = next(tail)
  if (tailResult === undefined) { return [state] }
  if (equal(state[0])(tailResult.first[0])) { return tailResult }
  return { first: state, tail: tailResult }
}

 /** @type {<T>(op: Operators<T>) => RangeMerge<T>} */
const merge = ({union, equal}) => genericMerge({reduceOp: reduceOp(union)(equal), tailReduce: tailReduce(equal)})(undefined)

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

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    get,
    /** @readonly */
    fromRange,
}