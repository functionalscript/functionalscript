/**
 * Object construction normalizes ordered properties, decodes spreads and
 * preserves field values while stopping at the first failed operand.
 *
 * @import { EdagValue, Property } from '../types.ts'
 * @import { PropertyThunk, ObjectItems } from './types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { object } from './module.f.mjs'

/** A later operand that must never be evaluated. @type {() => never} */
const skipped = () => { assert(false, 'an operand after a failure was evaluated') }

/** @type {(key: string, value: EdagValue) => PropertyThunk} */
const field = (key, value) => () => ok([':', key, value])

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', ['+', 1, 2]])
const record = /** @type {const} */ (['{}', [[':', 'value', data]]])
const func = /** @type {const} */ (['=>', 0, [data], ['throw', 'body remains code']])

/** Checks enumeration order and exact field values, including NaN and signed zero. @type {(items: ObjectItems, expected: readonly Property[]) => void} */
const expectProperties = (items, expected) => {
    const [tag, actual] = assertOk(object(items))
    assertEq(tag, '{}')
    assertEq(actual.length, expected.length)
    for (let i = 0; i < expected.length; i += 1) {
        const [propertyTag, key, value] = actual[i]
        const [, expectedKey, expectedValue] = expected[i]
        assertEq(propertyTag, ':')
        assertEq(key, expectedKey)
        assertEq(Object.is(value, expectedValue), true)
    }
}

export const proof = {
    empty: () => {
        expectProperties([], [])
        expectProperties([
            ['...', () => ok(['{}', []])],
            ['...', () => ok(['[]', []])],
            ['...', () => ok('')],
        ], [])
    },
    ordinaryFields: () => {
        /** @type {readonly EdagValue[]} */
        const values = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            '', 'undefined', '=>', '[]', '{}', '...', 0n, 1n, -1n,
            ['[]', []], ['{}', []], ['=>', 0, [], 0], data, record, func,
        ]
        expectProperties(
            values.map((value, i) => field(`key${i}`, value)),
            values.map((value, i) => /** @type {const} */ ([':', `key${i}`, value])),
        )
    },
    decodedSpreads: () => {
        expectProperties([['...', () => ok(record)]], record[1])
        const source = /** @type {const} */ (['[]', [data, record, func, undefinedValue]])
        expectProperties([['...', () => ok(source)]], [
            [':', '0', data], [':', '1', record], [':', '2', func], [':', '3', undefinedValue],
        ])
    },
    ignoredSpreads: () => {
        /** @type {readonly EdagValue[]} */
        const values = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            0n, 1n, -1n, ['=>', 0, [], 0], func,
        ]
        for (const value of values) {
            expectProperties([['...', () => ok(value)]], [])
        }
        expectProperties([field('kept', data), ['...', () => ok(func)]], [[':', 'kept', data]])
    },
    stringCodeUnits: () => {
        expectProperties([['...', () => ok('a😀b')]], [
            [':', '0', 'a'], [':', '1', '\ud83d'], [':', '2', '\ude00'], [':', '3', 'b'],
        ])
        expectProperties([['...', () => ok('\ud800x\udc00')]], [
            [':', '0', '\ud800'], [':', '1', 'x'], [':', '2', '\udc00'],
        ])
        expectProperties([['...', () => ok('=>')]], [[':', '0', '='], [':', '1', '>']])
    },
    normalization: () => {
        expectProperties([
            field('b', data), field('10', 10), field('a', 1), field('2', 2), field('b', record),
        ], [[':', '2', 2], [':', '10', 10], [':', 'b', record], [':', 'a', 1]])
        expectProperties([
            field('4294967295', data), field('01', 1), field('-0', -0),
            field('4294967294', record), field('0', 0),
        ], [
            [':', '0', 0], [':', '4294967294', record],
            [':', '4294967295', data], [':', '01', 1], [':', '-0', -0],
        ])
    },
    mixedSpreads: () => {
        const source = /** @type {const} */ (['{}', [[':', 'x', data], [':', 'b', func]]])
        expectProperties([
            field('x', 0), field('a', 1), ['...', () => ok(source)], field('b', record),
            ['...', () => ok(['[]', ['array', data]])],
            ['...', () => ok('ab')], field('0', func), field('z', undefinedValue),
        ], [
            [':', '0', func], [':', '1', 'b'], [':', 'x', data],
            [':', 'a', 1], [':', 'b', record], [':', 'z', undefinedValue],
        ])
    },
    specialKeys: () => {
        expectProperties([
            field('__proto__', data), field('constructor', func), field('toString', 'data'),
            field('', undefinedValue), field('__proto__', record),
        ], [
            [':', '__proto__', record], [':', 'constructor', func],
            [':', 'toString', 'data'], [':', '', undefinedValue],
        ])
    },
    freshIdentity: () => {
        assertEq(Object.is(assertOk(object([])), assertOk(object([]))), false)
        const source = /** @type {const} */ (['{}', [[':', 'data', data], [':', 'func', func]]])
        /** @type {ObjectItems} */
        const items = [['...', () => ok(source)]]
        const first = assertOk(object(items))
        const second = assertOk(object(items))
        assertEq(Object.is(first, source), false)
        assertEq(Object.is(second, source), false)
        assertEq(Object.is(first, second), false)
        const [, firstProperties] = first
        const [, secondProperties] = second
        for (let i = 0; i < source[1].length; i += 1) {
            const [, , value] = source[1][i]
            assertEq(firstProperties[i][2], value)
            assertEq(secondProperties[i][2], value)
        }
    },
    operandFailures: () => {
        for (const failure of [error(data), error(record), error(func), error(undefinedValue), error(NaN)]) {
            const fail = () => failure
            assertEq(object([fail, skipped]), failure)
            assertEq(object([field('a', 1), fail, skipped]), failure)
            assertEq(object([field('a', 1), ['...', () => ok(record)], fail]), failure)
            assertEq(object([['...', fail], skipped]), failure)
            assertEq(object([field('a', 1), ['...', fail], skipped]), failure)
            assertEq(object([field('a', 1), ['...', () => ok('ab')], ['...', fail]]), failure)
        }
    },
}
