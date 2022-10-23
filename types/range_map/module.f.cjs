const sortedList = require("../sorted_list/module.f.cjs")
const { genericMerge } = sortedList
const list = require("../list/module.f.cjs")
const option = require("../option/module.f.cjs")
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const operator = require("../function/operator/module.f.cjs")

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
  const sign = unsafeCmp(aMax)(bMax)
  const min = sign === 1 ? bMax : aMax
  const u = union(aItem)(bItem)
  if (state !== undefined && equal(state[0])(u)) {
    return [undefined, sign, [state[0], min]]
  }
  return [state, sign, [u, min]]
}

/** @type {<T>(equal: operator.Equal<T>) => sortedList.TailReduce<Entry<T>, RangeState<T>>} */
const tailReduce = equal => state => tail => {
  if (state === undefined) { return tail }
  const next = list.next(tail)
  if (next !== undefined  && equal(state[0])(next.first[0])) { return { first: [state[0], next.first[1]], tail: next.tail} }
  return { first: state, tail: tail}
}

 /** @type {<T>(op: Operators<T>) => RangeMerge<T>} */
const merge = ({union, equal}) => genericMerge({reduceOp: reduceOp(union)(equal), tailReduce: tailReduce(equal)})(undefined)

module.exports = {
    /** @readonly */
    merge
}