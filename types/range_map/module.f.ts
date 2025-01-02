import { genericMerge, type TailReduce, type ReduceOp, type SortedList } from '../sorted_list/module.f.ts'
import { next } from '../list/module.f.ts'
import type { Nullable } from '../nullable/module.f.ts'
import { cmp } from '../number/module.f.ts'
import type { Reduce, Equal } from '../function/operator/module.f.ts'
import type { Range } from '../range/module.f.ts'

export type Entry<T> = [T, number]

export type RangeMap<T> = SortedList<Entry<T>>

export type RangeMapArray<T> = readonly Entry<T>[]

export type Operators<T> = {
    readonly union: Reduce<T>
    readonly equal: Equal<T>
}

type RangeState<T> = Nullable<Entry<T>>

export type RangeMerge<T> = Reduce<RangeMap<T>>

const reduceOp: <T>(union: Operators<T>) => ReduceOp<Entry<T>, RangeState<T>>
    = ({ union, equal }) => state => ([aItem, aMax]) => ([bItem, bMax]) => {
        const sign = cmp(aMax)(bMax)
        const min = sign === 1 ? bMax : aMax
        const u = union(aItem)(bItem)
        const newState = state !== null && equal(state[0])(u) ? null : state
        return [newState, sign, [u, min]]
    }

const tailReduce: <T>(equal: Equal<T>) => TailReduce<Entry<T>, RangeState<T>>
    = equal => state => tail => {
        if (state === null) { return tail }
        const tailResult = next(tail)
        if (tailResult === null) { return [state] }
        if (equal(state[0])(tailResult.first[0])) { return tailResult }
        return { first: state, tail: tailResult }
    }

export const merge: <T>(op: Operators<T>) => RangeMerge<T>
    = op => genericMerge({ reduceOp: reduceOp(op), tailReduce: tailReduce(op.equal) })(null)

export const get: <T>(def: T) => (value: number) => (rm: RangeMapArray<T>) => T
    = def => value => rm => {
        const len = rm.length
        let b = 0
        let e = len - 1
        while (true) {
            if (b >= len) { return def }
            if (e - b < 0) { return rm[b][0] }
            const mid = b + (e - b >> 1)
            if (value <= rm[mid][1]) {
                e = mid - 1
            } else {
                b = mid + 1
            }
        }
    }

export const fromRange: <T>(def: T) => (r: Range) => (value: T) => RangeMapArray<T>
    = def => ([a, b]) => v => [[def, a - 1], [v, b]]
