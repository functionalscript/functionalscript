/**
 * Unary numeric operations distinguish abstract ToNumber from explicit Number,
 * preserve bigint arithmetic, and follow number signed-zero and ToInt32 rules.
 *
 * @import { Primitive } from '../types.ts'
 */

import { assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'
import { objectToPrimitive } from '../coercion/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { unary } from './module.f.mjs'

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
}
