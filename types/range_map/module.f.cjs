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
 * @typedef {sortedList.SortedList<[Entry<T>]>} RangeMap
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

/** @type {<T>(union: operator.Reduce<T>) => (equal: operator.Equal<T>) => sortedList.ReduceOp<Entry<T>, RangeState<T>>} */
const reduceOp = union => equal => state => a => b => {
  const sign = unsafeCmp(a[1])(b[1])
  const min = sign === 1 ? a[1] : b[1]
  const u = union(a[0])(b[0])
  if (state !== undefined && equal(state[0])(u)) {
    return [undefined, sign, state]
  }
  return [state, sign, [u, min]]
}

/** @type {<T>(equal: operator.Equal<T>) => sortedList.TailReduce<Entry<T>, RangeState<T>>} */
const tailReduce = equal => state => tail => {
  if (state === undefined) { return tail }
  const next = list.next(tail)
  if (next !== undefined  && equal(state[0])(next.first[0])) { return { first: state, tail: next.tail} }
  return { first: state, tail: tail}
}

 /** @type {<T>(op: Operators<T>) => (a: list.List<Entry<T>>) => (b:list.List<Entry<T>>) => list.List<Entry<T>>} */
const merge = op => {
    const { union, equal } = op
    return genericMerge({reduceOp: reduceOp(union)(equal), tailReduce: tailReduce(equal)})(undefined)
}

module.exports = {
    /** @readonly */
    merge
}