import { assertEq } from '../../../asserts/module.f.js'
import { abs } from './module.f.js'

/** @type {readonly number[]} */
const values = [
    NaN, -Infinity, -Number.MAX_VALUE, -42, -1.5, -Number.MIN_VALUE, -0,
    0, Number.MIN_VALUE, 1.5, 42, Number.MAX_VALUE, Infinity,
]

export const proof = /** @type {const} */ ({
    numbers: () => {
        for (const value of values) {
            assertEq(Object.is(abs(value), Math.abs(value)), true, value)
        }
    },
})
