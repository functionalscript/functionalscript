/**
 * Slicing converts and clamps bounds, creates fresh array values with shared
 * elements, and counts UTF-16 code units for strings.
 *
 * @import { Array as ValueArray, Primitive } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { slice } from './module.f.mjs'

const undefinedValue = /** @type {const} */ (['undefined'])
const letters = /** @type {const} */ (['[]', ['a', 'b', 'c']])

/** Common range expectations over the same ASCII letters. @param {readonly (readonly [Primitive, Primitive, string])[]} cases */
const expectRanges = cases => {
    for (const [start, end, expected] of cases) {
        assertEq(assertOk(slice('abc', start, end)), expected)
        assertStructurallySame(assertOk(slice(letters, start, end)), ['[]', [...expected]])
    }
}

export const proof = {
    numericRanges: () => {
        expectRanges([
            [0, undefinedValue, 'abc'], [1, undefinedValue, 'bc'],
            [0, 2, 'ab'], [1, 2, 'b'], [1, 1, ''], [2, 1, ''],
            [-1, undefinedValue, 'c'], [-2, -1, 'b'], [-4, undefinedValue, 'abc'],
            [0, -1, 'ab'], [0, -4, ''], [3, undefinedValue, ''],
            [1.9, 2.9, 'b'], [-2.9, -1.9, 'b'], [-0.9, 2.9, 'ab'],
            [0.9, undefinedValue, 'abc'], [-0, undefinedValue, 'abc'],
            [NaN, undefinedValue, 'abc'], [0, NaN, ''],
            [-Infinity, Infinity, 'abc'], [Infinity, undefinedValue, ''],
            [0, -Infinity, ''], [-1e100, 1e100, 'abc'], [1e100, undefinedValue, ''],
        ])
    },
    primitiveBounds: () => {
        expectRanges([
            [undefinedValue, undefinedValue, 'abc'], [null, undefinedValue, 'abc'],
            [false, true, 'a'], [true, undefinedValue, 'bc'],
            [0, null, ''], [0, false, ''], [0, true, 'a'],
            ['1', '2', 'b'], ['-2', '-1', 'b'], ['1.9', '2.9', 'b'],
            [' 0x1 ', '0b10', 'b'], ['0o1', 2, 'b'],
            ['', 2, 'ab'], [' \t\n', undefinedValue, 'abc'], ['-0.9', undefinedValue, 'abc'],
            ['invalid', undefinedValue, 'abc'], [0, 'invalid', ''], [0, 'undefined', ''],
            [0, 'Infinity', 'abc'], [0, '-Infinity', ''],
        ])
    },
    emptyReceivers: () => {
        /** @type {readonly (readonly [Primitive, Primitive])[]} */
        const bounds = [[undefinedValue, undefinedValue], [0, 0], [1, -1], [NaN, NaN], [-Infinity, Infinity], ['invalid', null]]
        for (const [start, end] of bounds) {
            assertEq(assertOk(slice('', start, end)), '')
            assertStructurallySame(assertOk(slice(['[]', []], start, end)), ['[]', []])
        }
    },
    bigintBounds: () => {
        /** @type {readonly (ValueArray | string)[]} */
        const receivers = [['[]', []], letters, '', 'abc']
        for (const receiver of receivers) {
            for (const bigint of [0n, 1n, -1n, 123456789012345678901234567890n]) {
                assertStructurallySame(assertError(slice(receiver, bigint, undefinedValue)), undefinedValue)
                assertStructurallySame(assertError(slice(receiver, bigint, bigint)), undefinedValue)
                for (const start of [undefinedValue, 0, 4, Infinity, -Infinity]) {
                    assertStructurallySame(assertError(slice(receiver, start, bigint)), undefinedValue)
                }
            }
        }
    },
    freshArrays: () => {
        const data = /** @type {const} */ (['[]', [1]])
        const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
        const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        /** @type {ValueArray} */
        const source = ['[]', [null, undefinedValue, false, true, 0, -0, NaN, '', 0n, data, object, func, data]]
        /** @type {readonly ValueArray[]} */
        const receivers = [source, ['[]', []]]
        for (const receiver of receivers) {
            const first = assertOk(slice(receiver, 0, undefinedValue))
            const second = assertOk(slice(receiver, 0, undefinedValue))
            assert(typeof first !== 'string' && typeof second !== 'string')
            assertEq(first[0], '[]')
            assertEq(second[0], '[]')
            assertEq(Object.is(first, receiver), false)
            assertEq(Object.is(second, receiver), false)
            assertEq(Object.is(first, second), false)
            const [, values] = receiver
            assertEq(first[1].length, values.length)
            assertEq(second[1].length, values.length)
            for (let i = 0; i < values.length; i += 1) {
                assertEq(Object.is(first[1][i], values[i]), true)
                assertEq(Object.is(second[1][i], values[i]), true)
            }
        }
        const selected = assertOk(slice(source, -4, undefinedValue))
        assert(typeof selected !== 'string')
        assertEq(selected[1].length, 4)
        assertEq(selected[1][0], data)
        assertEq(selected[1][1], object)
        assertEq(selected[1][2], func)
        assertEq(selected[1][3], data)
        const empty = assertOk(slice(source, 2, 1))
        const otherEmpty = assertOk(slice(source, 2, 1))
        assertStructurallySame(empty, ['[]', []])
        assertStructurallySame(otherEmpty, ['[]', []])
        assertEq(Object.is(empty, otherEmpty), false)
    },
    stringCodeUnits: () => {
        /** @type {readonly (readonly [number, number, string])[]} */
        const cases = [
            [0, 1, 'a'], [1, 2, '\ud83d'], [2, 3, '\ude00'], [1, 3, '😀'],
            [-3, -2, '\ud83d'], [-2, -1, '\ude00'], [-3, -1, '😀'],
            [0, 3, 'a😀'], [3, 4, 'b'],
        ]
        for (const [start, end, expected] of cases) {
            assertEq(assertOk(slice('a😀b', start, end)), expected)
        }
        assertEq(assertOk(slice('\ud800x\udc00', 0, 1)), '\ud800')
        assertEq(assertOk(slice('\ud800x\udc00', -1, undefinedValue)), '\udc00')
    },
}
