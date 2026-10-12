import { assertEq } from '../../../asserts/module.f.mjs'
import { max } from './module.f.js'

const values = [NaN, -Infinity, -1.5, -1, -0, 0, 1, 1.5, Infinity]

// `Object.is`, not `===`: `===` holds `NaN` unequal to itself and the two
// zeros equal, the two cases the built-in's answer turns on.
/** @type {(a: unknown, b: unknown) => void} */
const same = (a, b) => assertEq(Object.is(a, b), true, [a, b])

export const proof = {
    everyPair: () => values.forEach(a => values.forEach(b =>
        same(max(a, b), Math.max(a, b)))),
    zeros: () => {
        same(max(0, -0), 0)
        same(max(-0, 0), 0)
        same(max(0, 0), 0)
        same(max(-0, -0), -0)
    },
    nan: () => {
        same(max(NaN, 1), NaN)
        same(max(1, NaN), NaN)
    },
}
