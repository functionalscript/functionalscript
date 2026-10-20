import { assertEq } from '../../../asserts/module.f.js'
import { isNegativeZero } from './module.f.js'

export const proof = {
    negativeZero: () => [-0, 0 * -1, -1 / Infinity, Number('-0')]
        .forEach(n => assertEq(isNegativeZero(n), true)),
    numbers: () => [
        0, 1, -1, 0.5, -5e-324, NaN, Infinity, -Infinity,
    ].forEach(n => assertEq(isNegativeZero(n), false, n)),
    nonNumbers: () => [
        '-0', '', true, false, null, undefined, 0n, -0n, {}, [], [-0], () => -0,
    ].forEach(n => assertEq(isNegativeZero(n), false, n)),
    // the built-in's answer, value for value
    builtIn: () => [-0, 0, 1, NaN, '-0', 0n, null, undefined]
        .forEach(n => assertEq(isNegativeZero(n), Object.is(n, -0), n)),
}
