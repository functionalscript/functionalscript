const compare = require("../function/compare/module.f.cjs")
const { toArray } = require("../list/module.f.cjs")
const sortedList = require("../sorted_list/module.f.cjs")
const { merge, genericMerge } = sortedList
const list = require("../list/module.f.cjs")
const option = require("../option/module.f.cjs")

/**
 * @template T
 * @typedef {readonly T[]} SortedSet
 */

/**
 * @template T
 * @typedef {(a: T) => (b: T) => compare.Sign} Cmp
 */

/** @typedef {number} Byte */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>} */
const union = cmp => a => b => toArray(merge(cmp)(a)(b))

/** @type {<T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>} */
const intersect = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))

/** @type {<T>(cmp: Cmp<T>) => (a: sortedList.SortedList<T>) => (b: sortedList.SortedList<T>) => sortedList.SortedList<T>} */
const intersectMerge = cmp => genericMerge(undefined)({reduceOp: intersectReduce(cmp), tailReduce: intersectTail})

/** @type {<T,S>(cmp: Cmp<T>) => sortedList.ReduceOp<T,S>} */
const intersectReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : undefined, sign, state]
}

/** @type {<T,S>(state: S) => (tail: list.List<T>) => list.List<T>} */
const intersectTail = state => input => undefined

module.exports = {
    /** @readonly */
    union,
    /** @readonly */
    intersect
}