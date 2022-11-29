const compare = require('../function/compare/module.f.cjs')
const list = require('../list/module.f.cjs')
const option = require('../nullable/module.f.cjs')
const { next } = list
const { identity } = require('../function/module.f.cjs')

/**
 * @template T
 * @typedef {list.List<T>} SortedList
 */

/**
 * @template T
 * @typedef {readonly T[]} SortedArray
 */

/**
 * @template T
 * @typedef {(a: T) => (b: T) => compare.Sign} Cmp
 */

/**
 * @template T
 * @template S
 * @typedef {(state: S) => (a: T) => (b: T) => readonly[option.Nullable<T>, compare.Sign, S]} ReduceOp
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

/** @type {<T,S>(reduce: MergeReduce<T,S>) => (state: S) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
const genericMerge = reduce => {
    const { reduceOp, tailReduce } = reduce
    /** @typedef {typeof reduce extends MergeReduce<infer T, infer S> ? [T, S] : never} TS */
    /** @typedef {TS[0]} T */
    /** @typedef {TS[1]} S */
    /** @type {(state: S) => (a: list.List<T>) => (b: list.List<T>) => list.List<T>} */
    const f = state => a => b => () => {
        const aResult = next(a)
        if (aResult === null) { return tailReduce(state)(b) }
        const bResult = next(b)
        if (bResult === null) { return tailReduce(state)(aResult) }
        const [first, sign, stateNext] = reduceOp(state)(aResult.first)(bResult.first)
        const aNext = sign === 1 ? a : aResult.tail
        const bNext = sign === -1 ? b : bResult.tail
        const tail = f(stateNext)(aNext)(bNext)
        return first === null ? tail : { first, tail }
    }
    return f
}

/**
 * @template T
 * @typedef {ReduceOp<T, null>} CmpReduceOp
 */

/** @type {<T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>} */
const merge = cmp => {
    /** @typedef {typeof cmp extends Cmp<infer T> ? T : never} T*/
    /** @type {TailReduce<T, null>} */
    const tailReduce = mergeTail
    return genericMerge({ reduceOp: cmpReduce(cmp), tailReduce })(null)
}

/** @type {<T>(cmp: Cmp<T>) => CmpReduceOp<T>} */
const cmpReduce = cmp => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, null]
}

/** @type {() => <T>(tail: list.List<T>) => list.List<T>} */
const mergeTail = () => identity

/** @type {<T>(cmp: Cmp<T>) => (value: T) => (array: SortedArray<T>) =>  T|null} */
const find = cmp => value => array => {
    let b = 0
    let e = array.length - 1
    while (true) {
        if (e - b < 0) return null
        const mid = b + (e - b >> 1)
        const sign = cmp(value)(array[mid])
        switch(sign) {
            case -1: {
                 e = mid - 1
                 break
            }
            case 0: { return value }
            case 1: {
                 b = mid + 1
                 break
            }
        }
    }
}

module.exports = {
    /** @readonly */
    merge,
    /** @readonly */
    genericMerge,
    /** @readonly */
    find
}