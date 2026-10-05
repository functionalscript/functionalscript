/**
 * Primitive arithmetic distinguishes string addition, number and bigint;
 * unary operations distinguish abstract ToNumber from explicit Number.
 * Binary bitwise operations distinguish signed 32-bit numbers from exact bigints.
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
            [1.5, 1.5], ['', 0], [' \t-0\n', -0], ['0x10', 16], ['1e3', 1000],
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
            [9007199254740993n, 9007199254740992],
            [-9007199254740993n, -9007199254740992],
            [2n ** 1024n, Infinity], [-(2n ** 1024n), -Infinity],
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
            [9007199254740993n, -9007199254740993n],
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
            [1.9, -2], [-1.9, 0], [2147483648, 2147483647], [4294967297, -2],
            ['', -1], ['1.9', -2], ['value', -1],
            [0n, -1n], [1n, -2n], [-1n, 0n], [4294967297n, -4294967298n],
            [9007199254740993n, -9007199254740994n],
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
            ['', 9007199254740993n, '9007199254740993'],
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
            ['+', 9007199254740993n, 2n, 9007199254740995n], ['+', 0n, -1n, -1n],
            ['-', 9007199254740993n, 2n, 9007199254740991n], ['-', -1n, 2n, -3n],
            ['*', 9007199254740993n, 2n, 18014398509481986n], ['*', -2n, -3n, 6n],
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
            [2147483648, -1, -2147483648, -1, 2147483647],
            [4294967297, 3, 1, 3, 2], [-4294967297, 3, 3, -1, -4],
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
            [9007199254740993n, 3n, 1n, 9007199254740995n, 9007199254740994n],
            [9007199254740993n, -1n, 9007199254740993n, -1n, -9007199254740994n],
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
    mixedNumericTypes: () => {
        for (const operator of /** @type {const} */ (['+', '-', '*', '/', '%', '&', '|', '^'])) {
            for (const value of [0, 1, null, true, false, undefinedValue]) {
                assertStructurallySame(assertError(binary[operator](1n, value)), ['undefined'])
                assertStructurallySame(assertError(binary[operator](value, 1n)), ['undefined'])
            }
        }
        // Numeric strings still become numbers; only addition concatenates.
        for (const operator of /** @type {const} */ (['-', '*', '/', '%', '&', '|', '^'])) {
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
