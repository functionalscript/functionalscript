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
            const b = undefined
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a"],1],[["b"],2]]') { throw result }
        },
        () => {
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = undefined
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
    get: [
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(5)(rm))
            if (result !== '["a"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(10)(rm))
            if (result !== '["a"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(15)(rm))
            if (result !== '["b"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(20)(rm))
            if (result !== '["b"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(25)(rm))
            if (result !== '["c"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = stringify(_.get(30)(rm))
            if (result !== '["c"]') { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = [[['a'], 10], [['b'], 20], [['c'], 30]]
            const result = _.get(35)(rm)
            if (result !== undefined) { throw result }
        },
        () => {
            /** @type {_.RangeMapArray<sortedSet.SortedSet<string>>} */
            const rm = []
            const result = _.get(10)(rm)
            if (result !== undefined) { throw result }
        }
    ]
}