import * as _ from './module.f.mjs'
import list from '../../types/list/module.f.mjs'
const { toArray } = list

export default {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(_.arrayWrap(null)))
            if (result !== '["[","]"]') { throw result }
        },
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
            const result = JSON.stringify(toArray(_.objectWrap(null)))
            if (result !== '["{","}"]') { throw result }
        },
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
    ],
    numberSerialize: [
        () => {
            const result = JSON.stringify(toArray(_.numberSerialize(123)))
            if (result !== '["123"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(_.numberSerialize(10e20)))
            if (result !== '["1e+21"]') { throw result }
        }
    ],
    boolSerialize: [
        () => {
            const result = JSON.stringify(toArray(_.boolSerialize(false)))
            if (result !== '["false"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(_.boolSerialize(true)))
            if (result !== '["true"]') { throw result }
        }
    ]
}