/**
 * Resolved-key lookup preserves stored values and failures, decodes indexed
 * receivers, and exposes function length without exposing tuple metadata.
 * These cases exercise the kernel, independently of source-name admission.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.js'
import { array } from '../array/module.f.mjs'
import { object } from '../object/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { call } from '../call/module.f.mjs'
import { entry, findProperty, functionAt, read } from './module.f.mjs'

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
        /** The one value an option holds, kept by identity. @type {(option: EdagValue) => EdagValue} */
        const some = option => {
            assert(isArray(option) && option[0] === '[]' && option[1].length === 1)
            return option[1][0]
        }
        /** @type {(receiver: EdagValue, key: string) => void} */
        const none = (receiver, key) => assertStructurallySame(assertOk(entry(receiver, key)), ['[]', []])
        assertEq(some(assertOk(entry(record, 'value'))), data)
        none(record, 'length')
        assertEq(some(assertOk(entry(['{}', [[':', 'length', 3]]], 'length'))), 3)
        // an entry holding `undefined` is an entry, where the read alone
        // could not tell it from none
        assertStructurallySame(assertOk(entry(['{}', [[':', 'u', undefinedValue]]], 'u')), ['[]', [['undefined']]])
        // a fresh option every call
        assert(assertOk(entry(record, 'value')) !== assertOk(entry(record, 'value')))
        const items = assertOk(array([() => ok(data), () => ok(record)]))
        assertEq(some(assertOk(entry(items, '1'))), record)
        for (const key of ['length', '2', '01', '-1']) { none(items, key) }
        assertEq(some(assertOk(entry('ab', '1'))), 'b')
        for (const key of ['length', '2', '01']) { none('ab', key) }
        /** @type {readonly EdagValue[]} */
        const entryless = [functionValue, ['entry'], ['hasEntry'], ['Object.entries'], true, 0, 1n]
        for (const receiver of entryless) {
            for (const key of ['length', '0', 'name']) { none(receiver, key) }
        }
        for (const receiver of [null, undefinedValue]) {
            assertStructurallySame(assertError(entry(receiver, 'a')), ['undefined'])
        }
        // the helper owns the `length` every function does, read as a property
        expectValue(['entry'], 'length', 2)
        missing(['entry'], '0')
        expectValue(['hasEntry'], 'length', 2)
        missing(['hasEntry'], '0')
        // and so does a static function: `Object.entries` its `1`, with no
        // runtime to ask, and every other the length of the body the
        // runtime holds at its path, failing by name with no runtime or
        // none at the path
        expectValue(['Object.entries'], 'length', 1)
        missing(['Object.entries'], 'name')
        /** @type {import('../types.ts').Runtime} */
        const runtime = ['{}', [[':', 'static', ['{}', [[':', 'Object', ['{}', [[':', 'is', ['=>', 2, [], ['===', ['arg', 0], ['arg', 1]]]]]]]]]]]]
        assertEq(assertOk(read(ok(['Object.is']), 'length', runtime)), 2)
        assertStructurallySame(assertOk(read(ok(['Object.is']), 'name', runtime)), ['undefined'])
        missing(['Object.is'], 'name')
        assertEq(assertError(read(ok(['Object.is']), 'length')), 'no binding for the static Object.is')
        assertEq(assertError(read(ok(['Number.isNaN']), 'length', runtime)), 'no binding for the static Number.isNaN')
        for (const key of ['length', '0', 'name']) { none(['Object.is'], key) }
    },
    // The function value at a path into an object: the value at the end
    // where every step is an object with the key and the end a function;
    // `undefined` with no object, a step that is none, a key missing or an
    // end that is no function.
    functionAt: () => {
        /** @type {import('../types.ts').Runtime} */
        const runtime = ['{}', [[':', 'member', ['{}', [[':', 'String', ['{}', [[':', 'x', functionValue], [':', 'y', 1]]]]]]]]]
        assertEq(functionAt(runtime, ['member', 'String', 'x']), functionValue)
        assertEq(functionAt(functionValue, []), functionValue)
        assertEq(functionAt(data, []), undefined)
        assertEq(functionAt(undefined, ['member']), undefined)
        assertEq(functionAt(runtime, ['member', 'String', 'y']), undefined)
        assertEq(functionAt(runtime, ['member', 'String', 'z']), undefined)
        assertEq(functionAt(runtime, ['member', 'Number', 'x']), undefined)
        assertEq(functionAt(runtime, ['static', 'Object', 'is']), undefined)
        assertEq(functionAt(data, ['0']), undefined)
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
