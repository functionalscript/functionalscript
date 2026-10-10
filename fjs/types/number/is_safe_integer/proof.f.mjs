import { assertEq } from '../../../asserts/module.f.mjs'
import { isSafeInteger } from './module.f.js'

export const proof = {
    integers: () => {
        for (const value of [0, -0, 1, -1, 0xFFFF_FFFF, -0xFFFF_FFFF]) {
            assertEq(isSafeInteger(value), true)
        }
    },
    bounds: () => {
        for (const value of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
            assertEq(isSafeInteger(value), true)
        }
        for (const value of [Number.MIN_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER + 1]) {
            assertEq(isSafeInteger(value), false)
        }
    },
    nonIntegers: () => {
        for (const value of [0.5, -0.5, NaN, Infinity, -Infinity]) {
            assertEq(isSafeInteger(value), false)
        }
    },
    nonNumbers: () => {
        for (const value of [undefined, null, false, true, '1', 1n, [], {}]) {
            assertEq(isSafeInteger(value), false)
        }
    },
}
