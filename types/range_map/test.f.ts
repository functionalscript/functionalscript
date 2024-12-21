import * as _ from './module.f.ts'
import * as compare from '../function/compare/module.f.ts'
const { unsafeCmp } = compare
import * as json from '../../json/module.f.ts'
import * as object from '../object/module.f.ts'
const { sort } = object
import * as sortedSet from '../sorted_set/module.f.ts'
import * as list from '../list/module.f.mjs'
import * as operator from '../function/operator/module.f.mjs'

const stringify
    : (a: readonly json.Unknown[]) => string
    = json.stringify(sort)

const op
    : _.Operators<sortedSet.SortedSet<string>>
    = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }

export default {
    merge: [
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = null
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = null
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['c'], 3]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['b'], 2], [['d'], 4]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['d'], 4]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['b'], 2], [['c'], 3]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['b'], 1], [['a'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        },
        () => {
            const a
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 1], [['b'], 2], [['a'], 3]]
            const b
                : _.RangeMap<sortedSet.SortedSet<string>>
                = [[['a'], 5]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["a","b"],2],[["a"],5]]') { throw result }
        }
    ],
    get: () => {
        const sortedSetEmpty
            : sortedSet.SortedSet<string>
            = []
        const get = _.get(sortedSetEmpty)
        return [
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(5)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(10)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(15)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(20)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(25)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(30)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(35)(rm))
                if (result !== '[]') { throw result }
            },
            () => {
                const rm
                    : _.RangeMapArray<sortedSet.SortedSet<string>>
                    = []
                const result = stringify(get(10)(rm))
                if (result !== '[]') { throw result }
            }
        ]
    },
    fromRange: () => {
        const def = -1
        const rm = _.fromRange(def)([1, 7])(42)
        return [
            () => {
                const result = _.get(def)(0)(rm)
                if (result !== -1) { throw result }
            },
            () => {
                const result = _.get(def)(1)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = _.get(def)(3)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = _.get(def)(7)(rm)
                if (result !== 42) { throw result }
            },
            () => {
                const result = _.get(def)(9)(rm)
                if (result !== -1) { throw result }
            },
        ]
    }
}
