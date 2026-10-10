/**
 * Primitive arithmetic distinguishes string addition, number and bigint;
 * unary operations distinguish abstract ToNumber from explicit Number.
 * Bitwise operations distinguish 32-bit numbers from exact bigints;
 * shifts preserve operand order and bigint counts reverse direction when negative.
 *
 * @import { Primitive } from '../types.ts'
 */

import { assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'
import { objectToPrimitive } from '../coercion/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { binary, unary } from './module.f.mjs'

const undefinedValue = /** @type {const} */ (['undefined'])

export const proof = {
    numberPrimitives: () => {
        /** @type {readonly (readonly [Primitive, number])[]} */
        const cases = [
            [undefinedValue, NaN], [null, 0], [false, 0], [true, 1],
            [0, 0], [-0, -0], [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
            [1.5, 1.5], ['', 0], [' \t-0\n', -0], ['0x10', 16], ['1e3', 1_000],
            ['-Infinity', -Infinity], ['value', NaN], ['1n', NaN],
        ]
        for (const operator of /** @type {const} */ (['+', 'Number'])) {
            for (const [value, expected] of cases) {
                assertEq(Object.is(assertOk(unary[operator](value)), expected), true)
            }
        }
    },
    bigintNumbers: () => {
        /** @type {readonly (readonly [bigint, number])[]} */
        const cases = [
            [0n, 0], [1n, 1], [-1n, -1],
            [9_007_199_254_740_993n, 9_007_199_254_740_992],
            [-9_007_199_254_740_993n, -9_007_199_254_740_992],
            [2n ** 1_024n, Infinity], [-(2n ** 1_024n), -Infinity],
        ]
        for (const [value, expected] of cases) {
            assertStructurallySame(assertError(unary['+'](value)), ['undefined'])
            assertEq(Object.is(assertOk(unary.Number(value)), expected), true)
        }
    },
    negate: () => {
        /** @type {readonly (readonly [Primitive, number | bigint])[]} */
        const cases = [
            [undefinedValue, NaN], [null, -0], [false, -0], [true, -1],
            [0, -0], [-0, 0], [NaN, NaN], [Infinity, -Infinity], [-Infinity, Infinity],
            [1.5, -1.5], [-1.5, 1.5], ['', -0], ['-0', 0], ['0x10', -16], ['value', NaN],
            [0n, 0n], [1n, -1n], [-1n, 1n],
            [9_007_199_254_740_993n, -9_007_199_254_740_993n],
        ]
        for (const [value, expected] of cases) {
            assertEq(Object.is(assertOk(unary['-'](value)), expected), true)
        }
    },
    complement: () => {
        /** @type {readonly (readonly [Primitive, number | bigint])[]} */
        const cases = [
            [undefinedValue, -1], [null, -1], [false, -1], [true, -2],
            [0, -1], [-0, -1], [NaN, -1], [Infinity, -1], [-Infinity, -1],
            [1.9, -2], [-1.9, 0], [2_147_483_648, 2_147_483_647], [4_294_967_297, -2],
            ['', -1], ['1.9', -2], ['value', -1],
            [0n, -1n], [1n, -2n], [-1n, 0n], [4_294_967_297n, -4_294_967_298n],
            [9_007_199_254_740_993n, -9_007_199_254_740_994n],
        ]
        for (const [value, expected] of cases) {
            assertEq(Object.is(assertOk(unary['~'](value)), expected), true)
        }
    },
    objectComposition: () => {
        const method = assertOk(func(0, [], 7n))
        const primitive = assertOk(objectToPrimitive(
            ['{}', [[':', 'valueOf', method]]], 'number', fn => {
                assertEq(fn, method)
                return ok(7n)
            },
        ))
        assertStructurallySame(assertError(unary['+'](primitive)), ['undefined'])
        assertEq(assertOk(unary['-'](primitive)), -7n)
        assertEq(assertOk(unary['~'](primitive)), -8n)
        assertEq(assertOk(unary.Number(primitive)), 7)
    },
    stringAddition: () => {
        /** @type {readonly (readonly [Primitive, Primitive, string])[]} */
        const cases = [
            ['1', '2', '12'], ['1', 2, '12'], [1, '2', '12'],
            ['1', 2n, '12'], [1n, '2', '12'],
            ['', 9_007_199_254_740_993n, '9007199254740993'],
            [undefinedValue, '', 'undefined'], ['', undefinedValue, 'undefined'],
            [null, '!', 'null!'], ['!', null, '!null'],
            [true, '', 'true'], ['', false, 'false'],
            [-0, '', '0'], ['', -0, '0'],
            [NaN, '', 'NaN'], ['', Infinity, 'Infinity'],
        ]
        for (const [left, right, expected] of cases) {
            assertEq(assertOk(binary['+'](left, right)), expected)
        }
    },
    numberArithmetic: () => {
        /** @type {readonly (readonly [keyof typeof binary, Primitive, Primitive, number])[]} */
        const cases = [
            ['+', null, false, 0], ['+', true, 2, 3], ['+', undefinedValue, 1, NaN],
            ['+', -0, -0, -0], ['+', 0, -0, 0], ['+', Infinity, -Infinity, NaN],
            ['-', '0x10', '2', 14], ['-', null, true, -1], ['-', false, -0, 0],
            ['-', -0, 0, -0], ['-', Infinity, Infinity, NaN], ['-', 'value', 1, NaN],
            ['*', ' 2 ', 1.5, 3], ['*', null, -1, -0], ['*', 0, Infinity, NaN],
            ['*', -0, -3, 0], ['*', Infinity, -2, -Infinity], ['*', undefinedValue, 1, NaN],
            ['/', '7', '2', 3.5], ['/', 1, 0, Infinity], ['/', 1, -0, -Infinity],
            ['/', -1, -0, Infinity], ['/', 0, 0, NaN], ['/', 0, -1, -0],
            ['/', -0, -1, 0], ['/', Infinity, Infinity, NaN],
            ['/', 1, Infinity, 0], ['/', -1, Infinity, -0],
            ['%', '7', 2, 1], ['%', -7, 2, -1], ['%', 7, -2, 1],
            ['%', -4, 2, -0], ['%', 1, 0, NaN], ['%', Infinity, 2, NaN],
            ['%', 2, Infinity, 2], ['%', undefinedValue, 1, NaN],
        ]
        for (const [operator, left, right, expected] of cases) {
            assertEq(Object.is(assertOk(binary[operator](left, right)), expected), true)
        }
    },
    bigintArithmetic: () => {
        /** @type {readonly (readonly [keyof typeof binary, bigint, bigint, bigint])[]} */
        const cases = [
            ['+', 9_007_199_254_740_993n, 2n, 9_007_199_254_740_995n], ['+', 0n, -1n, -1n],
            ['-', 9_007_199_254_740_993n, 2n, 9_007_199_254_740_991n], ['-', -1n, 2n, -3n],
            ['*', 9_007_199_254_740_993n, 2n, 18_014_398_509_481_986n], ['*', -2n, -3n, 6n],
            ['/', 7n, 2n, 3n], ['/', -7n, 2n, -3n],
            ['/', 7n, -2n, -3n], ['/', -7n, -2n, 3n], ['/', -2n, 7n, 0n],
            ['%', 7n, 2n, 1n], ['%', -7n, 2n, -1n],
            ['%', 7n, -2n, 1n], ['%', -7n, -2n, -1n], ['%', -4n, 2n, 0n],
        ]
        for (const [operator, left, right, expected] of cases) {
            assertEq(assertOk(binary[operator](left, right)), expected)
        }
    },
    numberBitwise: () => {
        /** @type {readonly (readonly [Primitive, Primitive, number, number, number])[]} */
        const cases = [
            // Left, right, AND, OR, XOR.
            [6, 3, 2, 7, 5], [6.9, 3.9, 2, 7, 5], [-6.9, 3.9, 2, -5, -7],
            [2_147_483_648, -1, -2_147_483_648, -1, 2_147_483_647],
            [4_294_967_297, 3, 1, 3, 2], [-4_294_967_297, 3, 3, -1, -4],
            [-0, 0, 0, 0, 0], [null, false, 0, 0, 0],
            [NaN, 5, 0, 5, 5], [Infinity, 5, 0, 5, 5], [-Infinity, 5, 0, 5, 5],
            [undefinedValue, 5, 0, 5, 5], ['value', 5, 0, 5, 5],
            [true, '2', 0, 3, 3], ['0x10', '3', 0, 19, 19],
        ]
        for (const [left, right, and, or, xor] of cases) {
            for (const [a, b] of [[left, right], [right, left]]) {
                assertEq(Object.is(assertOk(binary['&'](a, b)), and), true)
                assertEq(Object.is(assertOk(binary['|'](a, b)), or), true)
                assertEq(Object.is(assertOk(binary['^'](a, b)), xor), true)
            }
        }
    },
    bigintBitwise: () => {
        /** @type {readonly (readonly [bigint, bigint, bigint, bigint, bigint])[]} */
        const cases = [
            [6n, 3n, 2n, 7n, 5n], [-6n, 3n, 2n, -5n, -7n],
            [9_007_199_254_740_993n, 3n, 1n, 9_007_199_254_740_995n, 9_007_199_254_740_994n],
            [9_007_199_254_740_993n, -1n, 9_007_199_254_740_993n, -1n, -9_007_199_254_740_994n],
            [0n, 0n, 0n, 0n, 0n],
        ]
        for (const [left, right, and, or, xor] of cases) {
            for (const [a, b] of [[left, right], [right, left]]) {
                assertEq(assertOk(binary['&'](a, b)), and)
                assertEq(assertOk(binary['|'](a, b)), or)
                assertEq(assertOk(binary['^'](a, b)), xor)
            }
        }
    },
    numberExponentiation: () => {
        /** @type {readonly (readonly [Primitive, Primitive, number])[]} */
        const cases = [
            [2, 3, 8], [3, 2, 9], [2, -3, 0.125], [-2, 3, -8], [-2, 4, 16],
            [4, 0.5, 2], [-4, 0.5, NaN],
            [0, 0, 1], [0, -1, Infinity], [NaN, 0, 1], [NaN, -0, 1], [1, NaN, NaN],
            [-0, 3, -0], [-0, 2, 0], [-0, -3, -Infinity], [-0, -2, Infinity],
            [Infinity, 2, Infinity], [-Infinity, 3, -Infinity], [-Infinity, 2, Infinity],
            [Infinity, -1, 0], [-Infinity, -3, -0], [-Infinity, -2, 0],
            [1, Infinity, NaN], [-1, -Infinity, NaN],
            [2, Infinity, Infinity], [0.5, Infinity, 0],
            [2, -Infinity, 0], [0.5, -Infinity, Infinity],
            [undefinedValue, 0, 1], [undefinedValue, 1, NaN], [2, undefinedValue, NaN],
            [null, true, 0], [true, false, 1], ['3', '2', 9], ['value', 0, 1],
        ]
        for (const [base, exponent, expected] of cases) {
            assertEq(Object.is(assertOk(binary['**'](base, exponent)), expected), true)
        }
    },
    bigintExponentiation: () => {
        /** @type {readonly (readonly [bigint, bigint, bigint])[]} */
        const cases = [
            [0n, 0n, 1n], [0n, 3n, 0n], [2n, 0n, 1n],
            [-3n, 3n, -27n], [-3n, 4n, 81n],
            [3n, 34n, 16_677_181_699_666_569n],
        ]
        for (const [base, exponent, expected] of cases) {
            assertEq(assertOk(binary['**'](base, exponent)), expected)
        }
    },
    negativeBigintExponents: () => {
        for (const base of [-2n, 0n, 1n, 2n]) {
            for (const exponent of [-1n, -2n]) {
                assertStructurallySame(assertError(binary['**'](base, exponent)), ['undefined'])
            }
        }
    },
    numberShifts: () => {
        /** @type {readonly (readonly [Primitive, Primitive, number, number, number])[]} */
        const cases = [
            // Value, count, left shift, signed right shift, unsigned right shift.
            [9, 2, 36, 2, 2], [2, 9, 1_024, 0, 0],
            [-5.9, 1.9, -10, -3, 2_147_483_645],
            [4_294_967_297, 1, 2, 0, 0],
            [2_147_483_648, 1, 0, -1_073_741_824, 1_073_741_824],
            [-1, 0, -1, -1, 4_294_967_295], [-0, -0, 0, 0, 0],
            [1, 32, 1, 1, 1], [1, 33, 2, 0, 0], [1, -1, -2_147_483_648, 0, 0],
            [NaN, 1, 0, 0, 0], [Infinity, 1, 0, 0, 0], [-Infinity, 1, 0, 0, 0],
            [5, Infinity, 5, 5, 5], [undefinedValue, 2, 0, 0, 0],
            [2, undefinedValue, 2, 2, 2], ['5', '1', 10, 2, 2], ['value', 1, 0, 0, 0],
            [null, true, 0, 0, 0], [true, false, 1, 1, 1],
        ]
        for (const [value, count, left, right, unsigned] of cases) {
            assertEq(Object.is(assertOk(binary['<<'](value, count)), left), true)
            assertEq(Object.is(assertOk(binary['>>'](value, count)), right), true)
            assertEq(Object.is(assertOk(binary['>>>'](value, count)), unsigned), true)
        }
    },
    bigintShifts: () => {
        /** @type {readonly (readonly [bigint, bigint, bigint, bigint])[]} */
        const cases = [
            [5n, 3n, 40n, 0n], [-5n, 3n, -40n, -1n],
            [5n, -3n, 0n, 40n], [-5n, -3n, -1n, -40n],
            [5n, 0n, 5n, 5n], [0n, 100n, 0n, 0n], [1n, 33n, 8_589_934_592n, 0n],
            [18_014_398_509_481_987n, 1n, 36_028_797_018_963_974n, 9_007_199_254_740_993n],
        ]
        for (const [value, count, left, right] of cases) {
            assertEq(assertOk(binary['<<'](value, count)), left)
            assertEq(assertOk(binary['>>'](value, count)), right)
        }
    },
    bigintUnsignedShift: () => {
        for (const value of [-1n, 0n, 1n]) {
            for (const count of [-1n, 0n, 1n]) {
                assertStructurallySame(assertError(binary['>>>'](value, count)), ['undefined'])
            }
        }
    },
    mixedNumericTypes: () => {
        for (const operator of /** @type {const} */ (['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>'])) {
            for (const value of [0, 1, null, true, false, undefinedValue]) {
                assertStructurallySame(assertError(binary[operator](1n, value)), ['undefined'])
                assertStructurallySame(assertError(binary[operator](value, 1n)), ['undefined'])
            }
        }
        // Numeric strings still become numbers; only addition concatenates.
        for (const operator of /** @type {const} */ (['-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>'])) {
            assertStructurallySame(assertError(binary[operator](1n, '2')), ['undefined'])
            assertStructurallySame(assertError(binary[operator]('2', 1n)), ['undefined'])
        }
    },
    bigintZeroDivisors: () => {
        for (const operator of /** @type {const} */ (['/', '%'])) {
            for (const dividend of [-1n, 0n, 1n]) {
                assertStructurallySame(assertError(binary[operator](dividend, 0n)), ['undefined'])
            }
        }
    },
}
