const compare = require("../function/compare/module.f.cjs")
const list = require("../list/module.f.cjs")
const { next, toArray } = list

/**
 * @template T
 * @typedef {readonly T[]} SortedList
 */

/**
 * @template T
 * @typedef {(a: T) => (b: T) => compare.Sign} Cmp
 */

/** @typedef {number} Byte */

/**
 * @template T
 * @typedef {SortedList<[Byte, readonly string[]]>} RangeMap
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const sortedMerge = cmp => a => b => toArray(listMerge(cmp)(a)(b))

/** @type {<T>(cmp: Cmp<T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const listMerge = cmp => a => b => {
    const aResult = next(a)
    if (aResult === undefined) { return b }
    const bResult = next(b)
    if (bResult === undefined) { return a }
    switch (cmp(aResult.first)(bResult.first)) {
        case -1: return { first: aResult.first, tail: listMerge(cmp)(aResult.tail)(b) }
        case 0: return { first: aResult.first, tail: listMerge(cmp)(aResult.tail)(bResult.tail) }
        case 1: return { first: bResult.first, tail: listMerge(cmp)(a)(bResult.tail) }
    }
}

module.exports = {
    /** @readonly */
    sortedMerge
}