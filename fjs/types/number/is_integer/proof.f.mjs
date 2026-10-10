import { assertEq } from '../../../asserts/module.f.mjs'
import { isInteger } from './module.f.js'

export const proof = {
    integers: () => [
        0, -0, 1, -1, 2 ** 53, -(2 ** 53), 1e100, 1.7976931348623157e308,
    ].forEach(n => assertEq(isInteger(n), true, n)),
    fractions: () => [
        0.5, -0.5, 1.5, -1.5, 5e-324, -5e-324,
    ].forEach(n => assertEq(isInteger(n), false, n)),
    nonFinite: () => [NaN, Infinity, -Infinity]
        .forEach(n => assertEq(isInteger(n), false, n)),
    nonNumbers: () => [
        '1', '', true, false, null, undefined, 1n, {}, [], [1], () => 1,
    ].forEach(n => assertEq(isInteger(n), false, n)),
}
