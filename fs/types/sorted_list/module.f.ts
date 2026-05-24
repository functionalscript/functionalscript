/**
 * Sorted immutable list helpers and merge operations.
 *
 * @module
 */
import type { Sign, Cmp } from '../function/compare/module.f.ts'
import { type List, next } from '../list/module.f.ts'
import type { Nullable } from '../nullable/module.f.ts'
import { identity } from '../function/module.f.ts'

export type SortedList<T> = List<T>

type SortedArray<T> = readonly T[]

export type ReduceOp<T, S> = (state: S) => (a: T) => (b: T) => readonly[Nullable<T>, Sign, S]

export type TailReduce<T, S> = (state: S) => (tail: List<T>) => List<T>

type MergeReduce<T, S> = {
   readonly reduceOp: ReduceOp<T,S>
   readonly tailReduce: TailReduce<T,S>
}

export const genericMerge
    = <T,S>({ reduceOp, tailReduce }: MergeReduce<T,S>)
        : (state: S) => (a: List<T>) => (b: List<T>) => List<T> => {
        const f = (state: S) => (a: List<T>) => (b: List<T>) => () => {
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

type CmpReduceOp<T> = ReduceOp<T, null>

export const merge = <T>(cmp: Cmp<T>): (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T> => {
    const tailReduce: TailReduce<T, null> = mergeTail
    return genericMerge({ reduceOp: cmpReduce(cmp), tailReduce })(null)
}

const cmpReduce = <T>(cmp: Cmp<T>): CmpReduceOp<T> => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, null]
}

const mergeTail = (): <T>(tail: List<T>) => List<T> => identity

/**
 * Binary search over `[0, len)`. `probe(mid)` returns the sign of the search
 * key relative to the element at `mid` (`-1` before, `0` at, `1` after). On a
 * hit it returns the matching index; on a miss it returns the converged lower
 * bound `b` (the insertion point), which may equal `len`.
 */
export const bsearch
    = (len: number) => (probe: (mid: number) => Sign): number => {
        let b = 0
        let e = len - 1
        while (true) {
            if (e < b) { return b }
            const mid = b + (e - b >> 1)
            switch (probe(mid)) {
                case -1: {
                    e = mid - 1
                    break
                }
                case 0: { return mid }
                case 1: {
                    b = mid + 1
                    break
                }
            }
        }
    }

export const find = <T>(cmp: Cmp<T>) => (value: T) => (array: SortedArray<T>): T|null => {
    const cmpValue = cmp(value)
    const pos = bsearch(array.length)(mid => cmpValue(array[mid]))
    return pos < array.length && cmpValue(array[pos]) === 0 ? value : null
}
