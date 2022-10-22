const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const sortedSet = require('../sorted_set/module.f.cjs')
const sortedList = require('../sorted_list/module.f.cjs')
const map = require('../map/module.f.cjs')
const { list } = require('../module.f.cjs')
const operator = require("../function/operator/module.f.cjs")

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

module.exports = {
    merge: [
        () => {
            /** @type {_.Operators<sortedSet.SortedSet<string>>} */
            const op = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['c'], 3]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['d'], 4]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","c"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {_.Operators<sortedSet.SortedSet<string>>} */
            const op = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['d'], 4]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 2], [['c'], 3]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],1],[["b","d"],2],[["c","d"],3],[["d"],4]]') { throw result }
        },
        () => {
            /** @type {_.Operators<sortedSet.SortedSet<string>>} */
            const op = { union: sortedSet.union(unsafeCmp), equal: list.equal(operator.strictEqual) }
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const a = [[['a'], 1], [['b'], 2]]
            /** @type {_.RangeMap<sortedSet.SortedSet<string>>} */
            const b = [[['b'], 1], [['a'], 2]]
            const merged = _.merge(op)(a)(b)
            const result = stringify(list.toArray(merged))
            if (result !== '[[["a","b"],2]]') { throw result }
        }
    ]
}