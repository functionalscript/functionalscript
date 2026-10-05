/**
 * Array construction retains ordinary values and shallow spread elements,
 * iterates strings by code point, and stops at the first failed operand.
 *
 * @import { EdagValue, Values } from '../types.ts'
 * @import { ItemsOver } from '../../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { array } from './module.f.mjs'

/** A later operand that must never be evaluated. @type {() => never} */
const skipped = () => { assert(false, 'an operand after a failure was evaluated') }

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', [1]])
const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])

/** @type {readonly EdagValue[]} */
const values = [
    null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
    '', 'value', 0n, 1n, -1n, ['[]', []], ['{}', []], ['=>', 0, [], 0],
    data, object, func,
]

/** Checks exact elements, including signed zero, NaN and represented identities. @type {(items: ItemsOver<ValueThunk>, expected: Values) => void} */
const expectValues = (items, expected) => {
    const [tag, actual] = assertOk(array(items))
    assertEq(tag, '[]')
    assertEq(actual.length, expected.length)
    for (let i = 0; i < expected.length; i += 1) {
        assertEq(Object.is(actual[i], expected[i]), true)
    }
}

export const proof = {
    empty: () => {
        expectValues([], [])
        expectValues([['...', () => ok(['[]', []])]], [])
        expectValues([['...', () => ok('')], ['...', () => ok(['[]', []])]], [])
    },
    ordinaryValues: () => {
        expectValues(values.map(value => () => ok(value)), values)
    },
    mixedSpreads: () => {
        const source = /** @type {const} */ (['[]', [data, object, func]])
        expectValues([
            () => ok(0),
            ['...', () => ok(source)],
            () => ok(source),
            ['...', () => ok('xy')],
            () => ok(undefinedValue),
        ], [0, data, object, func, source, 'x', 'y', undefinedValue])
    },
    stringCodePoints: () => {
        expectValues([['...', () => ok('a😀𝄞b')]], ['a', '😀', '𝄞', 'b'])
        expectValues([['...', () => ok('\ud800x\udc00')]], ['\ud800', 'x', '\udc00'])
    },
    freshIdentity: () => {
        assertEq(Object.is(assertOk(array([])), assertOk(array([]))), false)
        const source = /** @type {const} */ (['[]', [data, object, func]])
        /** @type {ItemsOver<ValueThunk>} */
        const items = [['...', () => ok(source)]]
        const first = assertOk(array(items))
        const second = assertOk(array(items))
        assertEq(Object.is(first, source), false)
        assertEq(Object.is(second, source), false)
        assertEq(Object.is(first, second), false)
        for (let i = 0; i < source[1].length; i += 1) {
            assertEq(first[1][i], source[1][i])
            assertEq(second[1][i], source[1][i])
        }
    },
    dataOnly: () => {
        const tags = /** @type {const} */ (['undefined', '[]', '{}', '=>', '...', 'args', 'throw', 'frame', 'arg'])
        expectValues(tags.map(value => () => ok(value)), tags)
        const quoted = /** @type {const} */ (['[]', ['+', 1, 2, undefinedValue, data]])
        const throws = /** @type {const} */ (['=>', 0, [], ['throw', 'body remains code']])
        expectValues([() => ok(quoted), () => ok(throws)], [quoted, throws])
        expectValues([['...', () => ok(quoted)]], ['+', 1, 2, undefinedValue, data])
        expectValues([['...', () => ok('=>')]], ['=', '>'])
    },
    operandFailures: () => {
        for (const failure of [error(data), error(object), error(func), error(undefinedValue), error(NaN)]) {
            const fail = () => failure
            assertEq(array([fail, skipped]), failure)
            assertEq(array([() => ok(1), fail, skipped]), failure)
            assertEq(array([() => ok(1), () => ok(2), fail]), failure)
            assertEq(array([['...', fail], skipped]), failure)
            assertEq(array([() => ok(1), ['...', fail], skipped]), failure)
            assertEq(array([() => ok(1), () => ok(2), ['...', fail]]), failure)
        }
    },
    nonIterableSpreads: () => {
        /** @type {readonly EdagValue[]} */
        const nonIterable = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            0n, 1n, -1n, ['{}', []], ['=>', 0, [], 0], object, func,
        ]
        for (const value of nonIterable) {
            assertStructurallySame(assertError(array([['...', () => ok(value)], skipped])), ['undefined'])
        }
        /** @type {ItemsOver<ValueThunk>} */
        const prefix = [() => ok(1), ['...', () => ok(data)], ['...', () => ok('ab')]]
        assertStructurallySame(assertError(array([...prefix, ['...', () => ok(object)], skipped])), ['undefined'])
        assertStructurallySame(assertError(array([...prefix, ['...', () => ok(func)]])), ['undefined'])
    },
}
