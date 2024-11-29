const compare = require("../function/compare/module.f.mjs")
const { toArray } = require("../list/module.f.cjs")
const sortedList = require("../sorted_list/module.f.mjs")
const { merge, genericMerge, find } = sortedList.default

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

const tailReduce = () => () => null

/** @type {<T>(cmp: Cmp<T>) => (a: sortedList.SortedList<T>) => (b: sortedList.SortedList<T>) => sortedList.SortedList<T>} */
const intersectMerge = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)

/** @type {<T,S>(cmp: Cmp<T>) => sortedList.ReduceOp<T,S>} */
const intersectReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, state]
}

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (set: SortedSet<T>) => boolean} */
const has = cmp => value => set => find(cmp)(value)(set) === value

module.exports = {
    /** @readonly */
    union,
    /** @readonly */
    intersect,
    /** @readonly */
    has
}