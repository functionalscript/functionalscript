import { arrayWrap, boolSerialize, numberSerialize, objectWrap, stringSerialize } from './module.f.ts'
import * as list from '../../types/list/module.f.ts'
const { toArray } = list

export default {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(arrayWrap(null)))
            if (result !== '["[","]"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a','b']])))
            if (result !== '["[","a","b","]"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a'],['b']])))
            if (result !== '["[","a",",","b","]"]') { throw result }
        }
    ],
    objectWrap: [
        () => {
            const result = JSON.stringify(toArray(objectWrap(null)))
            if (result !== '["{","}"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(objectWrap([['a','b']])))
            if (result !== '["{","a","b","}"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(objectWrap([['a'],['b']])))
            if (result !== '["{","a",",","b","}"]') { throw result }
        }
    ],
    stringSerialize: [
        () => {
            const result = JSON.stringify(toArray(stringSerialize('abc')))
            if (result !== '["\\"abc\\""]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(stringSerialize('123')))
            if (result !== '["\\"123\\""]') { throw result }
        }
    ],
    numberSerialize: [
        () => {
            const result = JSON.stringify(toArray(numberSerialize(123)))
            if (result !== '["123"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(numberSerialize(10e20)))
            if (result !== '["1e+21"]') { throw result }
        }
    ],
    boolSerialize: [
        () => {
            const result = JSON.stringify(toArray(boolSerialize(false)))
            if (result !== '["false"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(boolSerialize(true)))
            if (result !== '["true"]') { throw result }
        }
    ]
}
