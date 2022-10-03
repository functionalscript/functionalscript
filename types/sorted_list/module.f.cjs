const compare = require("../function/compare/module.f.cjs")
const list = require("../list/module.f.cjs")
const option = require("../option/module.f.cjs")
const operator = require("../function/operator/module.f.cjs")
const { todo } = require("../../dev/module.f.cjs")
const { next } = list

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

/**
 * @template S
 * @template T
 * @typedef {(state: S) => (a: T) => (b: T) => readonly[option.Option<T>, compare.Sign, S]} ReduceOp
 */

/** @type {<T>(cmp: Cmp<T>) => ReduceOp<undefined, T>} */
const cmpReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, undefined]
}

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => genericMerge(undefined)(cmpReduce(cmp))

/** @type {<T,S>(init: S) => (reduce: ReduceOp<S,T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = init => reduce => a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return b }
    const bResult = next(b)
    if (bResult === undefined) { return a }
    const [result, sign, state] = reduce(init)(aResult.first)(bResult.first)
    const aNext = sign === 1 ? a : aResult.tail
    const bNext = sign === -1 ? b : bResult.tail
    const mergeNext = genericMerge(state)(reduce)(aNext)(bNext)
    return result === undefined ? mergeNext : { first: result, tail: mergeNext }
}

module.exports = {
    /** @readonly */
    merge
}