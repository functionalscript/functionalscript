import _, * as T from './module.f.mjs'
import * as compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare
import * as json from '../../json/module.f.mjs'
import object from '../object/module.f.mjs'
const { sort } = object
import sortedSet, * as SortedSet from '../sorted_set/module.f.mjs'
import * as list from '../list/module.f.mjs'
import * as operator from '../function/operator/module.f.mjs'

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = json.stringify(sort)

/** @type {T.Operators<SortedSet.SortedSet<string>>} */
const op = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }

export default {
    merge: [
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = null
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = null
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['c'], 3]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['d'], 4]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['d'], 4]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['c'], 3]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['b'], 1], [['a'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        },
        () => {
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2], [['a'], 3]]
            /** @type {T.RangeMap<SortedSet.SortedSet<string>>} */
            const b = [[['a'], 5]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["a","b"],2],[["a"],5]]') { throw result }
        }
    ],
    get: () => {
        /** @type {SortedSet.SortedSet<string>} */
        const sortedSetEmpty = []
        const get = _.get(sortedSetEmpty)
        return [
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(5)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(10)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(15)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(20)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(25)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(30)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(35)(rm))
                if (result !== '[]') { throw result }
            },
            () => {
                /** @type {T.RangeMapArray<SortedSet.SortedSet<string>>} */
                const rm = []
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
