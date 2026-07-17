import { arrayWrap, boolSerialize, numberSerialize, objectWrap, stringSerialize } from './module.f.ts'
import * as list from '../../../types/list/module.f.ts'
import { assert } from '../../../asserts/module.f.ts'

const { toArray } = list

export const proof = {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(arrayWrap(null)))
            assert(result === '["[","]"]', result)
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a','b']])))
            assert(result === '["[","a","b","]"]', result)
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a'],['b']])))
            assert(result === '["[","a",",","b","]"]', result)
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
            assert(result === '["\\"abc\\""]', result)
        },
        () => {
            const result = JSON.stringify(toArray(stringSerialize('123')))
            assert(result === '["\\"123\\""]', result)
        }
    ],
    numberSerialize: [
        () => {
            const result = JSON.stringify(toArray(numberSerialize(123)))
            assert(result === '["123"]', result)
        },
        () => {
            const result = JSON.stringify(toArray(numberSerialize(10e20)))
            assert(result === '["1e+21"]', result)
        }
    ],
    boolSerialize: [
        () => {
            const result = JSON.stringify(toArray(boolSerialize(false)))
            assert(result === '["false"]', result)
        },
        () => {
            const result = JSON.stringify(toArray(boolSerialize(true)))
            assert(result === '["true"]', result)
        }
    ]
}
