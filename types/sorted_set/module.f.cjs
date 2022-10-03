const { todo } = require("../../dev/module.f.cjs")
const compare = require("../function/compare/module.f.cjs")
const { toArray } = require("../list/module.f.cjs")
const { merge } = require("../sorted_list/module.f.cjs")

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
const intersect = cmp => a => b => todo()

module.exports = {
    /** @readonly */
    union
}