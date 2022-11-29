const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const sortedSet = require('../sorted_set/module.f.cjs')
const { list } = require('../module.f.cjs')
const operator = require("../function/operator/module.f.cjs")

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {_.Operators<sortedSet.SortedSet<string>>} */
const op = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }

module.exports = {
    merge: [
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = null
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = null
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['a'], 1], [['b'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['c'], 3]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['d'], 4]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['d'], 4]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['c'], 3]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 1], [['a'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2], [['a'], 3]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['a'], 5]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["a","b"],2],[["a"],5]]') { throw result }
        }
    ],
    get: () => {
        /** @type {sortedSet.SortedSet<string>} */
        const sortedSetEmpty = []
        const get = _.get(sortedSetEmpty)
        return [
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(5)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(10)(rm))
                if (result !== '["a"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(15)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(20)(rm))
                if (result !== '["b"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(25)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(30)(rm))
                if (result !== '["c"]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
                const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
                const result = stringify(get(35)(rm))
                if (result !== '[]') { throw result }
            },
            () => {
                /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
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
