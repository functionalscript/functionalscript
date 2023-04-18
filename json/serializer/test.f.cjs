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
    ]
}