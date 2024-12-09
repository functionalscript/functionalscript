// @ts-self-types="./module.f.d.mts"
import * as Compare from '../function/compare/module.f.mjs'
import list from "../list/module.f.mjs"
const { toArray } = list
import sortedList, * as SortedList from '../sorted_list/module.f.mjs'
const { merge, genericMerge, find } = sortedList

/**
 * @template T
 * @typedef {readonly T[]} SortedSet
 */

/**
 * @template T
 * @typedef {(a: T) => (b: T) => Compare.Sign} Cmp
 */

/** @typedef {number} Byte */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>} */
const union = cmp => a => b => toArray(merge(cmp)(a)(b))

/** @type {<T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>} */
const intersect = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))

const tailReduce = () => () => null

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList.SortedList<T>) => (b: SortedList.SortedList<T>) => SortedList.SortedList<T>} */
const intersectMerge = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)

/** @type {<T,S>(cmp: Cmp<T>) => SortedList.ReduceOp<T,S>} */
const intersectReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, state]
}

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (set: SortedSet<T>) => boolean} */
const has = cmp => value => set => find(cmp)(value)(set) === value

export default {
    /** @readonly */
    union,
    /** @readonly */
    intersect,
    /** @readonly */
    has
}