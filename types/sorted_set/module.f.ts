import type { Sign } from '../function/compare/module.f.ts'
import { toArray } from "../list/module.f.ts"
import { merge, genericMerge, find, type SortedList, type ReduceOp } from '../sorted_list/module.f.ts'

export type SortedSet<T> = readonly T[]

type Cmp<T> = (a: T) => (b: T) => Sign

type Byte = number

export const union: <T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>
    = cmp => a => b => toArray(merge(cmp)(a)(b))

export const intersect: <T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>
    = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))

const tailReduce = () => () => null

const intersectMerge: <T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>
    = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)

const intersectReduce: <T, S>(cmp: Cmp<T>) => ReduceOp<T, S>
    = cmp => state => a => b => {
        const sign = cmp(a)(b)
        return [sign === 0 ? a : null, sign, state]
    }

export const has: <T>(cmp: Cmp<T>) => (value: T) => (set: SortedSet<T>) => boolean
    = cmp => value => set => find(cmp)(value)(set) === value
