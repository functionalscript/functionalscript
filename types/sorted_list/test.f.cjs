const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.mjs').default
const jsonT = require('../../json/module.f.mjs')
const json = jsonT.default
const { sort } = require('../../types/object/module.f.cjs')
const { toArray, countdown, length } = require('../list/module.f.cjs')
const map = require('../map/module.f.cjs')
const { flip } = require('../function/module.f.cjs')

/** @type {(a: readonly jsonT.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {<T>(a: T) => (b: T) => map.Sign} */
const reverseCmp = flip(unsafeCmp)

module.exports = {
    sortedMergre: [
        () => {
            const result = stringify(toArray(_.merge(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.merge(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const list = countdown(n)
            const result = _.merge(reverseCmp)(list)(list)
            const len = length(result)
            if (len != n) { throw result }
        }
    ],
    find: [
        () => {
            const result = _.find(unsafeCmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 0) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 80) { throw result }
        }
    ]
}