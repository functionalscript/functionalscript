import { assertEq } from '../../../asserts/module.f.js'
import { ceil } from './module.f.js'

/** @type {readonly number[]} */
const values = [
    NaN, -Infinity, Infinity, -0, 0,
    -Number.MIN_VALUE, Number.MIN_VALUE, -(2 ** -1022), 2 ** -1022,
    -0.1, 0.1, -0.5, 0.5, -0.9, 0.9,
    -(1 - 2 ** -53), 1 - 2 ** -53, -1, 1,
    -(1 + 2 ** -52), 1 + 2 ** -52,
    -1.1, 1.1, -1.5, 1.5, -42, 42, -42.25, 42.25,
    -(2 ** 52 - 0.5), 2 ** 52 - 0.5, -(2 ** 52), 2 ** 52,
    -(2 ** 53 - 1), 2 ** 53 - 1, -(2 ** 53), 2 ** 53,
    -(2 ** 53 + 2), 2 ** 53 + 2, -Number.MAX_VALUE, Number.MAX_VALUE,
]

export const proof = /** @type {const} */ ({
    numbers: () => {
        for (const value of values) {
            assertEq(Object.is(ceil(value), Math.ceil(value)), true, value)
        }
    },
})
