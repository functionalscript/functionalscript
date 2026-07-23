import { arrayWrap, boolSerialize, numberSerialize, objectWrap, stringSerialize } from './module.f.ts'
import * as list from '../../../types/list/module.f.ts'
import { assertEq } from '../../../asserts/module.f.ts'

const { toArray } = list

export const proof = {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(arrayWrap(null)))
            assertEq(result, '["[","]"]')
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a','b']])))
            assertEq(result, '["[","a","b","]"]')
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a'],['b']])))
            assertEq(result, '["[","a",",","b","]"]')
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
            assertEq(result, '["\\"abc\\""]')
        },
        () => {
            const result = JSON.stringify(toArray(stringSerialize('123')))
            assertEq(result, '["\\"123\\""]')
        }
    ],
    numberSerialize: [
        () => {
            const result = JSON.stringify(toArray(numberSerialize(123)))
            assertEq(result, '["123"]')
        },
        () => {
            const result = JSON.stringify(toArray(numberSerialize(10e20)))
            assertEq(result, '["1e+21"]')
        }
    ],
    boolSerialize: [
        () => {
            const result = JSON.stringify(toArray(boolSerialize(false)))
            assertEq(result, '["false"]')
        },
        () => {
            const result = JSON.stringify(toArray(boolSerialize(true)))
            assertEq(result, '["true"]')
        }
    ]
}
