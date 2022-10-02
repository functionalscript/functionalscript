const compare = require("../function/compare/module.f.cjs")
const list = require("../list/module.f.cjs")
const { next, toArray } = list

/**
 * @template T
 * @typedef {list.List<T>} SortedList
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
const merge = cmp => a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return b }
    const bResult = next(b)
    if (bResult === undefined) { return a }
    switch (cmp(aResult.first)(bResult.first)) {
        case -1: return { first: aResult.first, tail: merge(cmp)(aResult.tail)(b) }
        case 0: return { first: aResult.first, tail: merge(cmp)(aResult.tail)(bResult.tail) }
        case 1: return { first: bResult.first, tail: merge(cmp)(a)(bResult.tail) }
    }
}

module.exports = {
    /** @readonly */
    merge
}