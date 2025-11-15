import { get, merge, type RangeMapArray, type Properties, type RangeMap, fromRange, rangeMap } from './module.f.ts'
import { stringify, type Unknown } from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { union, type SortedSet } from '../sorted_set/module.f.ts'
import { equal, toArray } from '../list/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import { cmp } from '../string/module.f.ts'

const str
    : (a: readonly Unknown[]) => string
    = stringify(sort)

const op: Properties<SortedSet<string>>
    = {
        union: union(cmp),
        equal: equal(strictEqual),
        def: []
    }

export default {
    example: () => {
        const rmOps = rangeMap({
            union: a => b => a | b,
            equal: a => b => a === b,
            def: 0,
        })

        // Create range maps
        const range1 = rmOps.fromRange([0, 10])(2)
        const range2 = rmOps.fromRange([5, 15])(5)

        // Merge range maps
        const merged = toArray(rmOps.merge(range1)(range2))

        // Retrieve values from the merged range map
        //
        if (rmOps.get(-1)(merged) !== 0) { throw 'error' }
        //
        if (rmOps.get(0)(merged) !== 2) { throw 'error' }
        if (rmOps.get(2)(merged) !== 2) { throw 'error' }
        // 2 | 5 = 7
        if (rmOps.get(7)(merged) !== 7) { throw 'error' }
        //
        if (rmOps.get(12)(merged) !== 5) { throw 'error' }
        if (rmOps.get(15)(merged) !== 5) { throw 'error' }
        //
        if (rmOps.get(16)(merged) !== 0) { throw 'error' }
    },
    merge: [
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = null
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = null
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['c'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['d'], 4]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['d'], 4]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['c'], 3]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 1], [['a'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2], [['a'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 5]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            if (result !== '[[["a"],1],[["a","b"],2],[["a"],5]]') { throw result }
        }
    ],
    get: () => {
        const sortedSetEmpty: SortedSet<string> = []
        const at = get(sortedSetEmpty)
        return [
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(5)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(10)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(15)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(20)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(25)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(30)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(35)(rm))
                if (result !== '[]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = []
                const result = str(at(10)(rm))
                if (result !== '[]') { throw result }
            }
        ]
    },
    fromRange: () => {
        const def = -1
        const rm = fromRange(def)([1, 7])(42)
        return [
            () => {
                const result = get(def)(0)(rm)
                if (result !== -1) { throw result }
            },
            () => {
                const result = get(def)(1)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = get(def)(3)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = get(def)(7)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = get(def)(9)(rm)
                if (result !== -1) { throw result }
            },
        ]
    }
}
