const compare = require("../function/compare/module.f.cjs")
const { toArray } = require("../list/module.f.cjs")
const sortedList = require("../sorted_list/module.f.cjs")
const sortedSet = require("../sorted_set/module.f.cjs")
const { genericMerge } = sortedList
const list = require("../list/module.f.cjs")
const option = require("../option/module.f.cjs")
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const { todo } = require("../../dev/module.f.cjs")
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

 /** @type {<T>(op: Operators<T>) => (a: RangeMap<T>) => (b:RangeMap<T>) => RangeMap<T>} */
const merge = op => {
    const { union, equal } = op
    /** @typedef {typeof op extends Operators<infer T> ? T : never} T*/
    /** @type {(a: RangeMap<T>) => (b:RangeMap<T>) => RangeMap<T>} */
    const f = a => b => () => {
      return todo()
    }
    return f
}

module.exports = {
    /** @readonly */
    merge
}