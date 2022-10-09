const compare = require("../function/compare/module.f.cjs")
const list = require("../list/module.f.cjs")
const option = require("../option/module.f.cjs")
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

/**
 * @template S
 * @template T
 * @typedef {(state: S) => (tail: list.List<T>) => list.List<T>} TailReduce
 */

/**
 * @template S
 * @template T
 * @typedef {(init: S) => (reduce: ReduceOp<S,T>) => (tailReduce: TailReduce<S, T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} GenericMerge
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => genericMerge(undefined)(cmpReduce(cmp))(mergeTail)

/** @type {<S,T>(cmp: Cmp<T>) => ReduceOp<S, T>} */
const cmpReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, state]
}

/** @type {<S,T>(state: S) => (tail: list.List<T>) => list.List<T>} */
const mergeTail = s => input => input

/** @type {<S,T>(init: S) => (reduce: ReduceOp<S,T>) => (tailReduce: TailReduce<S, T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = init => reduce => tailReduce => a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return tailReduce(init)(b) }
    const bResult = next(b)
    if (bResult === undefined) { return tailReduce(init)(a) }
    const [result, sign, state] = reduce(init)(aResult.first)(bResult.first)
    const aNext = sign === 1 ? a : aResult.tail
    const bNext = sign === -1 ? b : bResult.tail
    const mergeNext = genericMerge(state)(reduce)(tailReduce)(aNext)(bNext)
    return result === undefined ? mergeNext : { first: result, tail: mergeNext }
}

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    genericMerge
}