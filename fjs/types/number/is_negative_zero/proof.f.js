import { assertEq } from '../../../asserts/module.f.js'
import { isNegativeZero } from './module.f.js'

export const proof = {
    negativeZero: () => { for (const n of [-0, 0 * -1, -1 / Infinity, Number('-0')]) { assertEq(isNegativeZero(n), true) } },
    numbers: () => { for (const n of [
        0, 1, -1, 0.5, -5e-324, NaN, Infinity, -Infinity,
    ]) { assertEq(isNegativeZero(n), false, n) } },
    nonNumbers: () => { for (const n of [
        '-0', '', true, false, null, undefined, 0n, -0n, {}, [], [-0], () => -0,
    ]) { assertEq(isNegativeZero(n), false, n) } },
    // the built-in's answer, value for value
    builtIn: () => { for (const n of [-0, 0, 1, NaN, '-0', 0n, null, undefined]) { assertEq(isNegativeZero(n), Object.is(n, -0), n) } },
}
