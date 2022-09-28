const _ = require('./module.f.cjs')
const { unsafeCmp } = require('../function/compare/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

module.exports = {
    sortedMergre: [
        () => {
            const result = stringify(_.sortedMerge(unsafeCmp)([2, 3, 4])([1, 3, 5]))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(_.sortedMerge(unsafeCmp)([1, 2, 3])([]))
            if (result !== '[1,2,3]') { throw result }
        }
    ]
}