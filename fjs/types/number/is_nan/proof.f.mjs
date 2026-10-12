import { assertEq } from '../../../asserts/module.f.mjs'
import { isNaN } from './module.f.js'

export const proof = {
    nan: () => [NaN, 0 / 0, Infinity - Infinity, Number('x')]
        .forEach(n => assertEq(isNaN(n), true)),
    numbers: () => [
        0, -0, 1, -1, 0.5, 2 ** 53, Infinity, -Infinity, 5e-324,
    ].forEach(n => assertEq(isNaN(n), false, n)),
    nonNumbers: () => [
        'NaN', '', 'x', true, false, null, undefined, 1n, {}, [], [NaN], () => NaN,
    ].forEach(n => assertEq(isNaN(n), false, n)),
}
