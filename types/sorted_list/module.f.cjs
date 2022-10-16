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
 * @typedef {(a: T) => (b: T) => readonly[option.Option<T>, compare.Sign]} ReduceOp
 */

/**
 * @template T
 * @template S
 * @typedef {(state: S) => (a: T) => (b: T) => readonly[option.Option<T>, compare.Sign, S]} StateReduceOp
 */

/**
 * @template T
  * @typedef {{
 *  readonly reduceOp: ReduceOp<T>
 *  readonly tailReduce: TailReduce<T>
  * }} MergeReduce
 */

/**
 * @template T
 * @typedef {(tail: list.List<T>) => list.List<T>} TailReduce
 */

/**
 * @template T
 * @template S
 * @typedef {(state: S) => (tail: list.List<T>) => list.List<T>} StateTailReduce
 */

/**
 * @template T
 * @template S
  * @typedef {{
 *  readonly reduceOp: StateReduceOp<T,S>
 *  readonly tailReduce: StateTailReduce<T,S>
  * }} StateMergeReduce
 */

/**
 * @template T
 * @template S
 * @typedef {(reduce: MergeReduce<T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} GenericMerge
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => genericMerge({reduceOp: cmpReduce(cmp), tailReduce: mergeTail})

/** @type {<T>(cmp: Cmp<T>) => ReduceOp<T>} */
const cmpReduce = cmp => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign]
}

/** @type {<T>(tail: list.List<T>) => list.List<T>} */
const mergeTail = tail => tail

/** @type {<T>(reduce: MergeReduce<T>) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = reduce => a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return reduce.tailReduce(b) }
    const bResult = next(b)
    if (bResult === undefined) { return reduce.tailReduce(a) }
    const [result, sign] = reduce.reduceOp(aResult.first)(bResult.first)
    const aNext = sign === 1 ? a : aResult.tail
    const bNext = sign === -1 ? b : bResult.tail
    const mergeNext = genericMerge(reduce)(aNext)(bNext)
    return result === undefined ? mergeNext : { first: result, tail: mergeNext }
}

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    genericMerge
}