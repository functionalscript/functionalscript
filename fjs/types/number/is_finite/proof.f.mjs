import { assertEq } from '../../../asserts/module.f.mjs'
import { isFinite_ } from './module.f.js'

export const proof = {
    finite: () => [
        0, -0, 1, -1, 0.5, 2 ** 53, 5e-324, 1.7976931348623157e308, -1.7976931348623157e308,
    ].forEach(n => assertEq(isFinite_(n), true, n)),
    nonFinite: () => [NaN, Infinity, -Infinity]
        .forEach(n => assertEq(isFinite_(n), false, n)),
    nonNumbers: () => [
        '1', '', true, false, null, undefined, 1n, {}, [], [1], () => 1,
    ].forEach(n => assertEq(isFinite_(n), false, n)),
}
