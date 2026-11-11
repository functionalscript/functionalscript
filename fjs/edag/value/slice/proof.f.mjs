/**
 * Slicing clamps bounds, creates fresh array values with shared elements,
 * and counts UTF-16 code units for strings.
 *
 * @import { Array as ValueArray } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { slice } from './module.f.js'

const undefinedValue = /** @type {const} */ (['undefined'])
const letters = /** @type {const} */ (['[]', ['a', 'b', 'c']])

/** Common range expectations over the same ASCII letters. @param {readonly (readonly [number, number | undefined, string])[]} cases */
const expectRanges = cases => {
    for (const [start, end, expected] of cases) {
        assertEq(slice('abc', start, end), expected)
        assertStructurallySame(slice(letters, start, end), ['[]', [...expected]])
    }
}

export const proof = {
    numericRanges: () => {
        expectRanges([
            [0, undefined, 'abc'], [1, undefined, 'bc'],
            [0, 2, 'ab'], [1, 2, 'b'], [1, 1, ''], [2, 1, ''],
            [-1, undefined, 'c'], [-2, -1, 'b'], [-4, undefined, 'abc'],
            [0, -1, 'ab'], [0, -4, ''], [3, undefined, ''],
            [1.9, 2.9, 'b'], [-2.9, -1.9, 'b'], [-0.9, 2.9, 'ab'],
            [0.9, undefined, 'abc'], [-0, undefined, 'abc'],
            [NaN, undefined, 'abc'], [0, NaN, ''],
            [-Infinity, Infinity, 'abc'], [Infinity, undefined, ''],
            [0, -Infinity, ''], [-1e100, 1e100, 'abc'], [1e100, undefined, ''],
        ])
    },
    emptyReceivers: () => {
        /** @type {readonly (readonly [number, number | undefined])[]} */
        const bounds = [[0, undefined], [0, 0], [1, -1], [NaN, NaN], [-Infinity, Infinity]]
        for (const [start, end] of bounds) {
            assertEq(slice('', start, end), '')
            assertStructurallySame(slice(['[]', []], start, end), ['[]', []])
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
            const first = slice(receiver, 0, undefined)
            const second = slice(receiver, 0, undefined)
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
        const selected = slice(source, -4, undefined)
        assert(typeof selected !== 'string')
        assertEq(selected[1].length, 4)
        assertEq(selected[1][0], data)
        assertEq(selected[1][1], object)
        assertEq(selected[1][2], func)
        assertEq(selected[1][3], data)
        const empty = slice(source, 2, 1)
        const otherEmpty = slice(source, 2, 1)
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
            assertEq(slice('a😀b', start, end), expected)
        }
        assertEq(slice('\ud800x\udc00', 0, 1), '\ud800')
        assertEq(slice('\ud800x\udc00', -1, undefined), '\udc00')
    },
}
