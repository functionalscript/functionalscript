const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.mjs').default
const jsonT = require('../../json/module.f.mjs')
const json = jsonT.default
const { sort } = require('../object/module.f.mjs').default
const { toArray, countdown, length } = require('../list/module.f.mjs').default
const map = require('../map/module.f.cjs')
const { flip } = require('../function/module.f.mjs').default

/** @type {(a: readonly jsonT.Unknown[]) => string} */
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
    ],
    intersect: [
        () => {
            const result = stringify(toArray(_.intersect(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[3]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.intersect(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[]') { throw result }
        }
    ],
    has: [
        () => {
            const result = _.has(unsafeCmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        }
    ]
}