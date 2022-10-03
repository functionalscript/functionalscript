const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const { toArray, countdown, length } = require('../list/module.f.cjs')
const map = require('../map/module.f.cjs')
const { flip } = require('../function/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {<T>(a: T) => (b: T) => map.Sign} */
const reverseCmp = flip(unsafeCmp)

module.exports = {
    union: [
        () => {
            const result = stringify(toArray(_.union(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.union(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const sortedSet = toArray(countdown(n))
            const result = _.union(reverseCmp)(sortedSet)(sortedSet)
            const len = length(result)
            if (len != n) { throw result }
        }
    ]
}