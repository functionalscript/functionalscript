/**
 * Resolved-key lookup preserves stored values and failures, decodes indexed
 * receivers, and exposes function length without exposing tuple metadata.
 * These cases exercise the kernel, independently of source-name admission.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { array } from '../array/module.f.mjs'
import { object } from '../object/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { call } from '../call/module.f.mjs'
import { entry, findProperty, read } from './module.f.mjs'

/** @type {(receiver: EdagValue, key: string, expected: EdagValue) => void} */
const expectValue = (receiver, key, expected) => {
    assertEq(Object.is(assertOk(read(ok(receiver), key)), expected), true)
}

/** @type {(receiver: EdagValue, key: string) => void} */
const missing = (receiver, key) => {
    assertStructurallySame(assertOk(read(ok(receiver), key)), ['undefined'])
}

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', ['+', 1, 2]])
const record = /** @type {const} */ (['{}', [[':', 'value', data]]])
const functionValue = assertOk(func(1, [() => ok(data)], ['frame', 0]))
const nonIndices = /** @type {const} */ (['-1', '-0', '01', '+1', '1.0', '1.5', '1e0', ' 1', '1 ', '', '4294967295'])

export const proof = {
    storedProperty: () => {
        const property = /** @type {const} */ ([':', 'value', undefinedValue])
        const receiver = /** @type {const} */ (['{}', [property]])
        assertEq(findProperty(receiver, 'value'), property)
        assertEq(findProperty(receiver, 'missing'), undefined)
        assertEq(assertOk(read(ok(receiver), 'value')), undefinedValue)
    },
    objects: () => {
        /** @type {readonly EdagValue[]} */
        const values = [null, undefinedValue, false, true, 0, -0, NaN, Infinity, '', 'undefined', 0n, 1n, data, record, functionValue]
        const receiver = assertOk(object(values.map((value, i) => () => ok([':', `field${i}`, value]))))
        for (let i = 0; i < values.length; i += 1) {
            expectValue(receiver, `field${i}`, values[i])
        }
        missing(receiver, 'notStored')
    },
    storedKeys: () => {
        const receiver = assertOk(object([
            () => ok([':', '__proto__', data]), () => ok([':', 'constructor', functionValue]),
            () => ok([':', 'toString', record]), () => ok([':', 'length', null]),
            () => ok([':', '0', undefinedValue]), () => ok([':', '01', -0]), () => ok([':', '', NaN]),
        ]))
        expectValue(receiver, '__proto__', data)
        expectValue(receiver, 'constructor', functionValue)
        expectValue(receiver, 'toString', record)
        expectValue(receiver, 'length', null)
        expectValue(receiver, '0', undefinedValue)
        expectValue(receiver, '01', -0)
        expectValue(receiver, '', NaN)
        missing(receiver, 'valueOf')
    },
    arrays: () => {
        const values = /** @type {const} */ ([data, record, functionValue, null, undefinedValue, NaN, -0])
        const receiver = assertOk(array(values.map(value => () => ok(value))))
        expectValue(receiver, 'length', values.length)
        for (let i = 0; i < values.length; i += 1) { expectValue(receiver, String(i), values[i]) }
        for (const key of nonIndices) { missing(receiver, key) }
        for (const key of ['7', '4294967294', 'constructor', '__proto__']) { missing(receiver, key) }
        expectValue(['[]', []], 'length', 0)
        missing(['[]', []], '0')
    },
    strings: () => {
        const text = 'a😀b'
        expectValue(text, 'length', 4)
        expectValue(text, '0', 'a')
        expectValue(text, '1', '\ud83d')
        expectValue(text, '2', '\ude00')
        expectValue(text, '3', 'b')
        for (const key of nonIndices) { missing(text, key) }
        missing(text, '4')
        expectValue('', 'length', 0)
        missing('', '0')
        const spread = assertOk(array([['...', () => ok(text)]]))
        expectValue(spread, 'length', 3)
        expectValue(spread, '1', '😀')
        expectValue(spread, '2', 'b')
    },
    functions: () => {
        for (const length of [0, 1, 16]) {
            const receiver = assertOk(func(length, [() => ok(data)], ['throw', 'body remains code']))
            expectValue(receiver, 'length', length)
            for (const key of ['0', '1', '2', '3', 'captures', 'body', 'edag', 'constructor', 'toString']) {
                missing(receiver, key)
            }
        }
    },
    primitiveReceivers: () => {
        for (const receiver of [false, true, 0, -0, NaN, Infinity, -Infinity, 0n, 1n, -1n]) {
            missing(receiver, 'length')
            missing(receiver, '0')
        }
        for (const receiver of [null, undefinedValue]) {
            for (const key of ['length', '0', 'value']) {
                assertStructurallySame(assertError(read(ok(receiver), key)), ['undefined'])
            }
        }
    },
    // The `entry` helper's read: an object's field, an array's element and
    // a string's code unit by its canonical index — never a `length`, which
    // the three own without enumerating it — nothing of a function, the
    // helper itself included, nothing of any other primitive, and a failure
    // for a nullish receiver.
    entry: () => {
        assertEq(assertOk(entry(record, 'value')), data)
        assertStructurallySame(assertOk(entry(record, 'length')), ['undefined'])
        assertEq(assertOk(entry(['{}', [[':', 'length', 3]]], 'length')), 3)
        const items = assertOk(array([() => ok(data), () => ok(record)]))
        assertEq(assertOk(entry(items, '1')), record)
        for (const key of ['length', '2', '01', '-1']) { assertStructurallySame(assertOk(entry(items, key)), ['undefined']) }
        assertEq(assertOk(entry('ab', '1')), 'b')
        for (const key of ['length', '2', '01']) { assertStructurallySame(assertOk(entry('ab', key)), ['undefined']) }
        /** @type {readonly EdagValue[]} */
        const entryless = [functionValue, ['entry'], true, 0, 1n]
        for (const receiver of entryless) {
            for (const key of ['length', '0', 'name']) { assertStructurallySame(assertOk(entry(receiver, key)), ['undefined']) }
        }
        for (const receiver of [null, undefinedValue]) {
            assertStructurallySame(assertError(entry(receiver, 'a')), ['undefined'])
        }
        // the helper owns the `length` every function does, read as a property
        expectValue(['entry'], 'length', 2)
        missing(['entry'], '0')
    },
    receiverFailures: () => {
        for (const failure of [error(null), error(undefinedValue), error(data), error(record), error(functionValue), error(NaN)]) {
            for (const key of ['length', '0', '__proto__']) { assertEq(read(failure, key), failure) }
        }
    },
    invocation: () => {
        const fn = assertOk(func(1, [() => ok(record)], ['.', ['frame', 0], 'value']))
        const argumentsValue = assertOk(array([() => ok(data)]))
        const holder = assertOk(object([
            () => ok([':', 'fn', fn]), () => ok([':', 'arguments', argumentsValue]),
        ]))
        const result = call(read(ok(holder), 'fn'), [() => read(read(ok(holder), 'arguments'), '0')], (actual, fixed, rest) => {
            assertEq(actual, fn)
            assert(actual[0] === '=>')
            assertEq(fixed[0], data)
            assertEq(rest[1].length, 0)
            return read(ok(actual[2][0]), 'value')
        })
        assertEq(assertOk(result), data)
    },
}
