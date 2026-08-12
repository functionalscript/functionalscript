/** @import { Unknown } from '../../media/json/types.ts' */

/** @import { RangeMapArray, Properties, RangeMap } from './types.ts' */
import { get, merge, fromRange, rangeMap } from './module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { sort } from '../object/module.f.mjs'
import { union } from '../sorted_set/module.f.mjs'
/** @import { SortedSet } from '../sorted_set/types.ts' */
import { equal, toArray } from '../list/module.f.mjs'
import { strictEqual } from '../function/operator/module.f.mjs'
import { cmp } from '../string/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

/** @type {(a: readonly Unknown[]) => string} */
const str = stringify(sort)

/** @type {Properties<SortedSet<string>>} */
const op = {
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
        const range1 = rmOps.fromRange(2)([0, 10])
        const range2 = rmOps.fromRange(5)([5, 15])

        // Merge range maps
        const merged = toArray(rmOps.merge(range1)(range2))

        // Retrieve values from the merged range map
        //
        const get = rmOps.get(merged)
        assertEq(get(-1), 0, 'error')
        //
        assertEq(get(0), 2, 'error')
        assertEq(get(2), 2, 'error')
        // 2 | 5 = 7
        assertEq(get(7), 7, 'error')
        //
        assertEq(get(12), 5, 'error')
        assertEq(get(15), 5, 'error')
        //
        assertEq(get(16), 0, 'error')
    },
    merge: [
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = null
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = null
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["b"],2]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['c'], 3]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['b'], 2], [['d'], 4]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['d'], 4]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['b'], 2], [['c'], 3]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['b'], 1], [['a'], 2]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a","b"],2]]')
        },
        () => {
            /** @type {RangeMap<SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2], [['a'], 3]]
            /** @type {RangeMap<SortedSet<string>>} */
            const b = [[['a'], 5]]
            const merged = merge(op)(a)(b)
            const result = str(toArray(merged))
            assertEq(result, '[[["a"],1],[["a","b"],2],[["a"],5]]')
        }
    ],
    get: () => {
        /** @type {SortedSet<string>} */
        const sortedSetEmpty = []
        const at = get(sortedSetEmpty)
        return [
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(5))
                assertEq(result, '["a"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(10))
                assertEq(result, '["a"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(15))
                assertEq(result, '["b"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(20))
                assertEq(result, '["b"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(25))
                assertEq(result, '["c"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(30))
                assertEq(result, '["c"]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = str(at(rm)(35))
                assertEq(result, '[]')
            },
            () => {
                /** @type {RangeMapArray<SortedSet<string>>} */
                const rm = []
                const result = str(at(rm)(10))
                assertEq(result, '[]')
            }
        ]
    },
    fromRange: () => {
        const def = -1
        const rm = fromRange(def)(42)([1, 7])
        const g = get(def)(rm)
        return [
            () => assertEq(g(0), -1),
            () =>assertEq(g(1), 42),
            () => assertEq(g(3), 42),
            () =>assertEq(g(7), 42),
            () => assertEq(g(9), -1),
        ]
    },
}
