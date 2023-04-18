const _ = require('./module.f.cjs')
const { toArray } = require('../../types/list/module.f.cjs')

module.exports = {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(_.arrayWrap([['a','b']])))
            if (result !== '["[","a","b","]"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(_.arrayWrap([['a'],['b']])))
            if (result !== '["[","a",",","b","]"]') { throw result }
        }
    ],
    objectWrap: [
        () => {
            const result = JSON.stringify(toArray(_.objectWrap([['a','b']])))
            if (result !== '["{","a","b","}"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(_.objectWrap([['a'],['b']])))
            if (result !== '["{","a",",","b","}"]') { throw result }
        }
    ],
    stringSerialize: [
        () => {
            const result = JSON.stringify(toArray(_.stringSerialize('abc')))
            if (result !== '["\\"abc\\""]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(_.stringSerialize('123')))
            if (result !== '["\\"123\\""]') { throw result }
        }
    ]
}