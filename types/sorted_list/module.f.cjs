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
 * @template T
 * @template S
 * @typedef {(state: S) => (a: T) => (b: T) => readonly[option.Option<T>, compare.Sign, S]} ReduceOp
 */

/**
 * @template T
 * @template S
 * @typedef {(state: S) => (tail: list.List<T>) => list.List<T>} TailReduce
 */

/**
 * @template T
 * @template S
  * @typedef {{
 *  readonly reduceOp: ReduceOp<T,S>
 *  readonly tailReduce: TailReduce<T,S>
  * }} MergeReduce
 */

/**
 * @template T
 * @template S
 * @typedef {(state: S) => (reduce: MergeReduce<T,S>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} GenericMerge
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => genericMerge(undefined)({reduceOp: cmpReduce(cmp), tailReduce: mergeTail})

/** @type {<T,S>(cmp: Cmp<T>) => ReduceOp<T,S>} */
const cmpReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, state]
}

/** @type {<T,S>(state: S) => (tail: list.List<T>) => list.List<T>} */
const mergeTail = state => tail => tail

/** @type {<T,S>(state: S) => (reduce: MergeReduce<T,S>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = state => reduce => a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return reduce.tailReduce(state)(b) }
    const bResult = next(b)
    if (bResult === undefined) { return reduce.tailReduce(state)(a) }
    const [result, sign, stateNext] = reduce.reduceOp(state)(aResult.first)(bResult.first)
    const aNext = sign === 1 ? a : aResult.tail
    const bNext = sign === -1 ? b : bResult.tail
    const mergeNext = genericMerge(stateNext)(reduce)(aNext)(bNext)
    return result === undefined ? mergeNext : { first: result, tail: mergeNext }
}

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    genericMerge
}