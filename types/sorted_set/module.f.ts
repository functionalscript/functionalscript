import * as Compare from '../function/compare/module.f.ts'
import * as list from "../list/module.f.mjs"
const { toArray } = list
import * as sortedList from '../sorted_list/module.f.ts'
const { merge, genericMerge, find } = sortedList

export type SortedSet<T> = readonly T[]

type Cmp<T> = (a: T) => (b: T) => Compare.Sign

type Byte = number

export const union
    : <T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>
    = cmp => a => b => toArray(merge(cmp)(a)(b))

export const intersect
    : <T>(cmp: Cmp<T>) => (a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>
    = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))

const tailReduce = () => () => null

const intersectMerge
    : <T>(cmp: Cmp<T>) => (a: sortedList.SortedList<T>) => (b: sortedList.SortedList<T>) => sortedList.SortedList<T>
    = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)

const intersectReduce
    : <T,S>(cmp: Cmp<T>) => sortedList.ReduceOp<T,S>
    = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, state]
}

export const has
    : <T>(cmp: Cmp<T>) => (value: T) => (set: SortedSet<T>) => boolean
    = cmp => value => set => find(cmp)(value)(set) === value
