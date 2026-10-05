/**
 * Outbound data conversion erases EDAG tuples while preserving primitive
 * values, own fields and graph sharing. Callables remain an explicit refusal.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { toUnknown } from './module.f.mjs'

/** @type {(value: unknown) => readonly unknown[]} */
const elements = value => {
    assert(value instanceof Array)
    return value
}

/** Reads a proved own data field, without accepting an inherited property. @type {(value: unknown, key: string) => unknown} */
const field = (value, key) => {
    assert(typeof value === 'object' && value !== null && !(value instanceof Array))
    return assertNotNullish(Object.entries(value).find(([name]) => name === key))[1]
}

const undefinedValue = /** @type {const} */ (['undefined'])

export const proof = {
    primitives: () => {
        for (const value of [null, false, true, 0, -0, NaN, Infinity, -Infinity, '', 'undefined', '😀\ud800', 0n, 1n, -1n]) {
            assertEq(Object.is(assertOk(toUnknown(value)), value), true)
        }
        assertEq(assertOk(toUnknown(undefinedValue)), undefined)
    },
    arrays: () => {
        assertStructurallySame(assertOk(toUnknown(['[]', []])), [])
        assertStructurallySame(assertOk(toUnknown(['[]', ['=>', 0, ['[]', []], 1]])), ['=>', 0, [], 1])
        const source = /** @type {const} */ (['[]', ['+', 1, undefinedValue, null, ['[]', [2, 3]], -0, NaN]])
        const actual = elements(assertOk(toUnknown(source)))
        assertEq(actual.length, 7)
        assertStructurallySame(actual.slice(0, 5), ['+', 1, undefined, null, [2, 3]])
        assertEq(Object.is(actual[5], -0), true)
        assertEq(Object.is(actual[6], NaN), true)
        assertEq(Object.is(actual, source), false)
        assertEq(Object.is(actual, source[1]), false)
    },
    ownFields: () => {
        assertStructurallySame(assertOk(toUnknown(['{}', []])), {})
        const actual = assertOk(toUnknown(['{}', [
            [':', '2', 'two'], [':', '10', 'ten'],
            [':', 'present', undefinedValue], [':', '__proto__', 'ordinary data'],
            [':', 'constructor', 4], [':', 'toString', false], [':', '01', null], [':', '', 0n],
        ]]))
        assert(typeof actual === 'object' && actual !== null)
        assertEq(actual instanceof Array, false)
        assertStructurallySame(Object.keys(actual), ['2', '10', 'present', '__proto__', 'constructor', 'toString', '01', ''])
        assertEq(field(actual, '2'), 'two')
        assertEq(field(actual, '10'), 'ten')
        assertEq(field(actual, 'present'), undefined)
        assertEq(Object.keys(actual).includes('absent'), false)
        assertEq(field(actual, '__proto__'), 'ordinary data')
        assertEq(field(actual, 'constructor'), 4)
        assertEq(field(actual, 'toString'), false)
        assertEq(field(actual, '01'), null)
        assertEq(field(actual, ''), 0n)
    },
    sharedGraph: () => {
        const data = /** @type {const} */ (['[]', [7]])
        const nested = /** @type {const} */ (['{}', [[':', 'data', data]]])
        const left = /** @type {const} */ (['{}', [[':', 'nested', nested], [':', 'data', data]]])
        const right = /** @type {const} */ (['[]', [nested, data]])
        const source = /** @type {const} */ (['{}', [[':', 'left', left], [':', 'right', right], [':', 'shared', data]]])
        const actual = assertOk(toUnknown(source))
        assertStructurallySame(actual, {
            left: { nested: { data: [7] }, data: [7] },
            right: [{ data: [7] }, [7]],
            shared: [7],
        })
        const actualLeft = field(actual, 'left')
        const actualRight = elements(field(actual, 'right'))
        const actualData = field(actual, 'shared')
        assertEq(field(actualLeft, 'nested'), actualRight[0])
        assertEq(field(actualLeft, 'data'), actualData)
        assertEq(actualRight[1], actualData)
        assertEq(field(actualRight[0], 'data'), actualData)
        assertEq(Object.is(actualData, data), false)
        assertEq(Object.is(actualData, data[1]), false)
        assertEq(Object.is(field(actualLeft, 'nested'), nested), false)
    },
    distinctAndFresh: () => {
        const items = /** @type {const} */ ([])
        const firstArray = /** @type {const} */ (['[]', items])
        const secondArray = /** @type {const} */ (['[]', items])
        const firstObject = /** @type {const} */ (['{}', []])
        const secondObject = /** @type {const} */ (['{}', []])
        const source = /** @type {const} */ (['[]', [firstArray, secondArray, firstObject, secondObject, firstArray, firstObject]])
        const first = elements(assertOk(toUnknown(source)))
        const second = elements(assertOk(toUnknown(source)))
        assertStructurallySame(first, [[], [], {}, {}, [], {}])
        assertStructurallySame(second, [[], [], {}, {}, [], {}])
        assertEq(Object.is(first, second), false)
        for (const actual of [first, second]) {
            assertEq(Object.is(actual[0], actual[1]), false)
            assertEq(Object.is(actual[2], actual[3]), false)
            assertEq(actual[0], actual[4])
            assertEq(actual[2], actual[5])
        }
        for (let i = 0; i < first.length; i += 1) {
            assertEq(Object.is(first[i], second[i]), false)
        }
    },
    callables: () => {
        const func = /** @type {const} */ (['=>', 0, [], 1])
        /** @type {readonly EdagValue[]} */
        const values = [
            func,
            ['[]', [func]],
            ['[]', [1, ['{}', [[':', 'function', func]]]]],
            ['{}', [[':', 'before', 1], [':', 'nested', ['[]', [func]]]]],
        ]
        for (const value of values) {
            assertEq(assertError(toUnknown(value)), 'callable materialization requires a target compile/load boundary')
        }
    },
}
