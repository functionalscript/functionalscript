import type { Sign } from '../function/compare/module.f.ts'
import { type List, next } from '../list/module.f.ts'
import type { Nullable } from '../nullable/module.f.ts'
import { identity } from '../function/module.f.ts'

export type SortedList<T> = List<T>

type SortedArray<T> = readonly T[]

type Cmp<T> = (a: T) => (b: T) => Sign

export type ReduceOp<T, S> = (state: S) => (a: T) => (b: T) => readonly[Nullable<T>, Sign, S]

export type TailReduce<T, S> = (state: S) => (tail: List<T>) => List<T>

type MergeReduce<T, S> = {
   readonly reduceOp: ReduceOp<T,S>
   readonly tailReduce: TailReduce<T,S>
}

export const genericMerge
    = <T,S>({ reduceOp, tailReduce }: MergeReduce<T,S>)
        : (state: S) => (a: List<T>) => (b: List<T>) => List<T> => {
        const f: (state: S) => (a: List<T>) => (b: List<T>) => List<T>
            = state => a => b => () => {
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

export const merge
    = <T>(cmp: Cmp<T>)
        : (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T> => {
    const tailReduce: TailReduce<T, null> = mergeTail
    return genericMerge({ reduceOp: cmpReduce(cmp), tailReduce })(null)
}

const cmpReduce
    : <T>(cmp: Cmp<T>) => CmpReduceOp<T>
    = cmp => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, null]
}

const mergeTail
    : () => <T>(tail: List<T>) => List<T>
    = () => identity

export const find
    : <T>(cmp: Cmp<T>) => (value: T) => (array: SortedArray<T>) =>  T|null
    = cmp => value => array => {
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
