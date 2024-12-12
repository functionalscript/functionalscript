// @ts-self-types="./module.f.d.mts"
import * as Compare from '../function/compare/module.f.mjs'
import * as list from "../list/module.f.mjs"
const { toArray } = list
import * as sortedList from '../sorted_list/module.f.mjs'
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
export const union = cmp => a => b => toArray(merge(cmp)(a)(b))

/** @type {<T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>} */
export const intersect = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))

const tailReduce = () => () => null

/** @type {<T>(cmp: Cmp<T>) => (a: sortedList.SortedList<T>) => (b: sortedList.SortedList<T>) => sortedList.SortedList<T>} */
const intersectMerge = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)

/** @type {<T,S>(cmp: Cmp<T>) => sortedList.ReduceOp<T,S>} */
const intersectReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, state]
}

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (set: SortedSet<T>) => boolean} */
export const has = cmp => value => set => find(cmp)(value)(set) === value
