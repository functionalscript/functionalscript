import { get, merge, type RangeMapArray, type Properties, type RangeMap, fromRange, rangeMap } from './module.f.ts'
import { stringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { union, type SortedSet } from '../sorted_set/module.f.ts'
import { equal, toArray } from '../list/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import { cmp } from '../string/module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

const str
    : (a: readonly Unknown[]) => string
    = stringify(sort)

const op: Properties<SortedSet<string>>
    = {
        union: union(cmp),
        equal: equal(strictEqual),
        def: []
    }

export const proof = {
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
        assertEq(rmOps.get(-1)(merged), 0, 'error')
        //
        assertEq(rmOps.get(0)(merged), 2, 'error')
        assertEq(rmOps.get(2)(merged), 2, 'error')
        // 2 | 5 = 7
        assertEq(rmOps.get(7)(merged), 7, 'error')
        //
        assertEq(rmOps.get(12)(merged), 5, 'error')
        assertEq(rmOps.get(15)(merged), 5, 'error')
        //
        assertEq(rmOps.get(16)(merged), 0, 'error')
    },
    merge: [
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = null
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = null
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['c'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['d'], 4]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['d'], 4]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['c'], 3]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 1], [['a'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],2]]')
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2], [['a'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 5]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["a","b"],2],[["a"],5]]')
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
                assertEq(result, '["a"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(10)(rm))
                assertEq(result, '["a"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(15)(rm))
                assertEq(result, '["b"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(20)(rm))
                assertEq(result, '["b"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(25)(rm))
                assertEq(result, '["c"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(30)(rm))
                assertEq(result, '["c"]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(35)(rm))
                assertEq(result, '[]')
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = []
                const result = str(at(10)(rm))
                assertEq(result, '[]')
            }
        ]
    },
    fromRange: () => {
        const def = -1
        const rm = fromRange(def)([1, 7])(42)
        return [
            () => {
                const result = get(def)(0)(rm)
                assertEq(result, -1)
            },
            () => {
                const result = get(def)(1)(rm)
                assertEq(result, 42)
            },
            () => {
                const result = get(def)(3)(rm)
                assertEq(result, 42)
            },
            () => {
                const result = get(def)(7)(rm)
                assertEq(result, 42)
            },
            () => {
                const result = get(def)(9)(rm)
                assertEq(result, -1)
            },
        ]
    }
}
