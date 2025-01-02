import { get, merge, type RangeMapArray, type Operators, type RangeMap, fromRange } from './module.f.ts'
import { unsafeCmp } from '../function/compare/module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { union, type SortedSet } from '../sorted_set/module.f.ts'
import { equal, toArray } from '../list/module.f.ts'
import * as operator from '../function/operator/module.f.ts'

const stringify
    : (a: readonly json.Unknown[]) => string
    = json.stringify(sort)

const op: Operators<SortedSet<string>>
    = { union: union(unsafeCmp), equal: equal(operator.strictEqual) }

export default {
    merge: [
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = null
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = null
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['c'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['d'], 4]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['d'], 4]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 2], [['c'], 3]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b: RangeMap<SortedSet<string>>
                = [[['b'], 1], [['a'], 2]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        },
        () => {
            const a: RangeMap<SortedSet<string>>
                = [[['a'], 1], [['b'], 2], [['a'], 3]]
            const b: RangeMap<SortedSet<string>>
                = [[['a'], 5]]
            const merged = merge(op)(a)(b)
            const result = stringify(toArray(merged))
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
                const result = stringify(at(5)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(10)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(15)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(20)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(25)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(30)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(at(35)(rm))
                if (result !== '[]') { throw result }
            },
            () => {
                const rm: RangeMapArray<SortedSet<string>>
                    = []
                const result = stringify(at(10)(rm))
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
