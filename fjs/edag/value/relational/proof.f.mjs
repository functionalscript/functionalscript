/**
 * Primitive relations preserve string ordering and mixed numeric precision.
 * Unordered comparisons succeed with false in all four relations.
 *
 * @import { Primitive } from '../types.ts'
 */

import { assertEq, assertOk } from '../../../asserts/module.f.mjs'
import { binary } from './module.f.mjs'

const undefinedValue = /** @type {const} */ (['undefined'])

/** Rows list the operands and their <, <=, >, >= results, checked in both orders.
 * @type {(cases: readonly (readonly [Primitive, Primitive, boolean, boolean, boolean, boolean])[]) => void}
 */
const check = cases => {
    for (const [a, b, lt, le, gt, ge] of cases) {
        assertEq(assertOk(binary['<'](a, b)), lt)
        assertEq(assertOk(binary['<='](a, b)), le)
        assertEq(assertOk(binary['>'](a, b)), gt)
        assertEq(assertOk(binary['>='](a, b)), ge)
        assertEq(assertOk(binary['<'](b, a)), gt)
        assertEq(assertOk(binary['<='](b, a)), ge)
        assertEq(assertOk(binary['>'](b, a)), lt)
        assertEq(assertOk(binary['>='](b, a)), le)
    }
}

export const proof = {
    numbers: () => check([
        [1, 2, true, true, false, false],
        [2, 2, false, true, false, true],
        [0, -0, false, true, false, true],
        [-0.5, 0, true, true, false, false],
        [-Infinity, 0, true, true, false, false],
        [0, Infinity, true, true, false, false],
        [Infinity, Infinity, false, true, false, true],
    ]),
    strings: () => check([
        ['10', '2', true, true, false, false],
        ['', 'a', true, true, false, false],
        ['ab', 'abc', true, true, false, false],
        ['same', 'same', false, true, false, true],
        ['B', 'a', true, true, false, false],
        // UTF-16 code units, rather than Unicode code points.
        ['😀', '\uE000', true, true, false, false],
    ]),
    coercion: () => check([
        ['10', 2, false, false, true, true],
        [' 0x10 ', 16, false, true, false, true],
        ['1e3', 1_000, false, true, false, true],
        ['1.5', 2, true, true, false, false],
        [null, 0, false, true, false, true],
        [false, '', false, true, false, true],
        [true, '1', false, true, false, true],
        [true, false, false, false, true, true],
    ]),
    bigints: () => check([
        [-5n, 3n, true, true, false, false],
        [3n, 3n, false, true, false, true],
        [5n, 5, false, true, false, true],
        [5n, 5.5, true, true, false, false],
        [-5n, -5.5, false, false, true, true],
        [9_007_199_254_740_993n, 9_007_199_254_740_992, false, false, true, true],
        [9_007_199_254_740_993n, 9_007_199_254_740_994, true, true, false, false],
        [5n, Infinity, true, true, false, false],
        [-Infinity, 5n, true, true, false, false],
        [1n, true, false, true, false, true],
        [0n, null, false, true, false, true],
        [9_007_199_254_740_993n, '9007199254740993', false, true, false, true],
        ['0x10', 16n, false, true, false, true],
        [' 10 ', 20n, true, true, false, false],
        ['', 0n, false, true, false, true],
    ]),
    unordered: () => check([
        [NaN, 1, false, false, false, false],
        [NaN, NaN, false, false, false, false],
        [NaN, 1n, false, false, false, false],
        [undefinedValue, 0, false, false, false, false],
        [undefinedValue, undefinedValue, false, false, false, false],
        [undefinedValue, 0n, false, false, false, false],
        ['value', 1, false, false, false, false],
        ['value', 1n, false, false, false, false],
        ['1.5', 2n, false, false, false, false],
        ['1e3', 1_001n, false, false, false, false],
        ['1n', 1n, false, false, false, false],
    ]),
}
