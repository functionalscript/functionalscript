const _ = require('./module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const json = require('../json/module.f.cjs')
const { sort } = require('../types/object/module.f.cjs')
const { toArray } = require('../types/list/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

module.exports = {
    toRangeMap: [
        () => {
            const result = stringify(toArray(_.toRangeMap(byteSet.empty)('a')))
            if (result !== '[]') { throw result }
        },
        // () => {
        //     const result = stringify(toArray(_.toRangeMap(byteSet.universe)('a')))
        //     if (result !== '[[["a"],63]]') { throw result }
        // },
        // () => {
        //     const s = byteSet.set(0)(byteSet.empty)
        //     const result = stringify(toArray(_.toRangeMap(s)('a')))
        //     if (result !== '[[["a"],1]]') { throw result }
        // }
    ]
}
