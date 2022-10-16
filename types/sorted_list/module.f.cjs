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

/** @type {<T,S>(reduce: MergeReduce<T,S>) => (state: S) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = reduce => {
    const { reduceOp, tailReduce } = reduce
    /** @typedef {typeof reduce extends MergeReduce<infer T, infer S> ? [T, S] : never} TS */
    /** @typedef {TS[0]} T */
    /** @typedef {TS[1]} S */
    /** @type {(state: S) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
    const f = state => a => b => () => {
        const aResult = next(a)
        if (aResult === undefined) { return tailReduce(state)(b) }
        const bResult = next(b)
        if (bResult === undefined) { return tailReduce(state)(a) }
        const [result, sign, stateNext] = reduceOp(state)(aResult.first)(bResult.first)
        const aNext = sign === 1 ? a : aResult.tail
        const bNext = sign === -1 ? b : bResult.tail
        const mergeNext = f(stateNext)(aNext)(bNext)
        return result === undefined ? mergeNext : { first: result, tail: mergeNext }
    }
    return f
}

/**
 * @template T
 * @typedef {ReduceOp<T, undefined>} CmpReduceOp
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => {
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
    /** @type {TailReduce<T, undefined>} */
    const tailReduce = mergeTail
    return genericMerge({ reduceOp: cmpReduce(cmp), tailReduce })(undefined)
}

/** @type {<T>(cmp: Cmp<T>) => CmpReduceOp<T>} */
const cmpReduce = cmp => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, undefined]
}

/** @type {() => <T>(tail: list.List<T>) => list.List<T>} */
const mergeTail = () => tail => tail

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    genericMerge
}