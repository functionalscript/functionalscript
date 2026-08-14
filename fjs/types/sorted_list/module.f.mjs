/**
 * Sorted immutable list helpers and merge operations.
 *
 * @module
 */

import { bsearch } from '../function/compare/module.f.mjs'
/** @import { Cmp } from '../function/compare/types.ts' */
import { next } from '../list/module.f.mjs'
/** @import { List } from '../list/types.ts' */
import { identity } from '../function/module.f.mjs'
/** @import { ReduceOp, SortedList, _MergeReduce } from './types.ts' */

/** @template T @typedef {readonly T[]} _SortedArray */

/**
 * Two-way sorted-list merge.
 * `reduceOp` returns `[output, sign, nextState]` where sign `-1` advances `a`, `1` advances `b`, `0` advances both; `null` output skips emission.
 * `tailReduce` drains the non-exhausted list with current state once the other ends.
 */
export const genericMerge =
    /**
     * @template T
     * @template S
     * @param {_MergeReduce<T, S>} _
     * @returns {(state: S) => (a: List<T>) => (b: List<T>) => List<T>}
     */
    ({ reduceOp, tailReduce }) => {
        /** @param {S} state */
        const f = state =>
            /** @param {List<T>} a */
            a =>
            /** @param {List<T>} b */
            b => () => {
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

/** @template T @typedef {ReduceOp<T, null>} _CmpReduceOp */

export const merge =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {(a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>}
     */
    cmp => genericMerge({ reduceOp: cmpReduce(cmp), tailReduce: keepTail })(null)

const cmpReduce =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {_CmpReduceOp<T>}
     */
    cmp => () => a => b => {
        const sign = cmp(a)(b)
        return [sign === 1 ? b : a, sign, null]
    }

/**
 * The two tail policies `genericMerge` takes, named for what they do with the
 * list that has not been exhausted yet: `merge` keeps it, because everything
 * still there belongs in the union, and `intersect` drops it, because with one
 * side exhausted nothing remaining can be matched.
 *
 * Both are left to inference deliberately. An explicit
 * `() => <T>(tail: List<T>) => List<T>` compiles here but introduces its own
 * type parameter, which `genericMerge` then collects as an inference candidate
 * alongside `reduceOp`'s; the best common supertype of the two is `unknown`, so
 * `T` widens and both call sites fail to match their declared return type. With
 * no annotation there is no second candidate and `reduceOp` alone fixes `T`.
 */
const keepTail = () => identity

const dropTail = () => () => null

const intersectReduce =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {ReduceOp<T, null>}
     */
    cmp => () => a => b => {
        const sign = cmp(a)(b)
        return [sign === 0 ? a : null, sign, null]
    }

export const intersect =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {(a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>}
     */
    cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce: dropTail })(null)

export const find =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     */
    cmp =>
        /** @param {T} value */
        value =>
            /** @param {_SortedArray<T>} array */
            array => {
                const cmpValue = cmp(value)
                const pos = bsearch(array.length)(mid => cmpValue(array[mid]))
                return pos < array.length && cmpValue(array[pos]) === 0 ? value : null
            }
