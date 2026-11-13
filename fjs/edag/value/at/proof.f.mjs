/**
 * Relative indexing preserves represented elements and returns UTF-16 code
 * units from strings.
 *
 * @import { Array as ValueArray, EdagValue } from '../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { at } from './module.f.js'

const undefinedValue = /** @type {const} */ (['undefined'])
const letters = /** @type {const} */ (['[]', ['a', 'b', 'c']])

export const proof = {
    indices: () => {
        /** @type {readonly (readonly [number, EdagValue])[]} */
        const cases = [
            [0, 'a'], [-0, 'a'], [NaN, 'a'], [1, 'b'], [2, 'c'],
            [-1, 'c'], [-2, 'b'], [-3, 'a'],
            [0.9, 'a'], [-0.9, 'a'], [1.9, 'b'], [-1.9, 'c'],
            [2.9, 'c'], [-3.9, 'a'],
            [3, undefinedValue], [-4, undefinedValue],
            [Infinity, undefinedValue], [-Infinity, undefinedValue],
            [1e100, undefinedValue], [-1e100, undefinedValue],
        ]
        for (const [index, expected] of cases) {
            for (const receiver of [letters, 'abc']) {
                assertStructurallySame(at(receiver, index), expected)
            }
        }
    },
    emptyReceivers: () => {
        /** @type {readonly (ValueArray | string)[]} */
        const receivers = [['[]', []], '']
        for (const receiver of receivers) {
            for (const index of [0, -1, NaN, Infinity, -Infinity]) {
                assertStructurallySame(at(receiver, index), undefinedValue)
            }
        }
    },
    elementIdentity: () => {
        const data = /** @type {const} */ (['[]', [1]])
        const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
        const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        /** @type {ValueArray} */
        const receiver = ['[]', [null, undefinedValue, false, true, 0, -0, NaN, '', 0n, data, object, func, data]]
        const [, values] = receiver
        for (let i = 0; i < values.length; i += 1) {
            assertEq(Object.is(at(receiver, i), values[i]), true)
            assertEq(Object.is(at(receiver, i - values.length), values[i]), true)
        }
    },
    stringCodeUnits: () => {
        /** @type {readonly (readonly [number, EdagValue])[]} */
        const cases = [
            [0, 'a'], [1, '\ud83d'], [2, '\ude00'], [3, 'b'],
            [-4, 'a'], [-3, '\ud83d'], [-2, '\ude00'], [-1, 'b'],
            [4, undefinedValue], [-5, undefinedValue],
        ]
        for (const [index, expected] of cases) {
            assertStructurallySame(at('a😀b', index), expected)
        }
        assertEq(at('\ud800x\udc00', 0), '\ud800')
        assertEq(at('\ud800x\udc00', -1), '\udc00')
    },
}
