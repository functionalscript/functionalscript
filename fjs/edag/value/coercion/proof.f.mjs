/**
 * Object conversion orders methods by hint and preserves primitive results;
 * primitive conversion follows string formatting and abstract ToNumber.
 *
 * @import { EdagValue, Primitive, Property, Object as ValueObject, Function as ValueFunction } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { object } from '../object/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { objectToPrimitive, primitiveToString, primitiveToNumber, primitiveToNumeric } from './module.f.mjs'

/** An invocation that must never happen. @type {() => never} */
const skipped = () => { assert(false, 'an unselected conversion method was invoked') }

/** @type {(properties: readonly Property[]) => ValueObject} */
const receiver = properties => assertOk(object(properties.map(property => () => ok(property))))

/** Predetermined method results; an unlisted method must remain uncalled. @type {(entries: readonly (readonly [ValueFunction, ValueResult])[]) => Invoke} */
const answers = entries => fn => assertNotNullish(entries.find(([method]) => method === fn))[1]

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', [1]])
const valueOf = assertOk(func(0, [() => ok(data)], ['throw', 'valueOf remains code']))
const toString = assertOk(func(0, [], ['throw', 'toString remains code']))
const methods = receiver([[':', 'valueOf', valueOf], [':', 'toString', toString]])

export const proof = {
    hintOrder: () => {
        const number = ok(7)
        const string = ok('text')
        assertEq(objectToPrimitive(methods, 'number', answers([[valueOf, number]])), number)
        assertEq(objectToPrimitive(methods, 'string', answers([[toString, string]])), string)
    },
    primitiveResults: () => {
        /** @type {readonly Primitive[]} */
        const primitives = [null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity, '', 'value', 0n, 1n, -1n]
        for (const primitive of primitives) {
            const selected = ok(primitive)
            assertEq(objectToPrimitive(methods, 'number', answers([[valueOf, selected]])), selected)
            assertEq(objectToPrimitive(methods, 'string', answers([[toString, selected]])), selected)
        }
    },
    absentMethods: () => {
        for (const hint of /** @type {const} */ (['number', 'string'])) {
            assertEq(assertOk(objectToPrimitive(receiver([]), hint, skipped)), '[object Object]')
        }
        const ownValueOf = receiver([[':', 'valueOf', valueOf]])
        assertEq(assertOk(objectToPrimitive(ownValueOf, 'string', skipped)), '[object Object]')
        assertEq(assertOk(objectToPrimitive(ownValueOf, 'number', answers([[valueOf, ok(data)]]))), '[object Object]')
        const selected = ok('own toString')
        const ownToString = receiver([[':', 'toString', toString]])
        assertEq(objectToPrimitive(ownToString, 'number', answers([[toString, selected]])), selected)
        assertStructurallySame(assertError(objectToPrimitive(ownToString, 'string', answers([[toString, ok(data)]]))), ['undefined'])
    },
    shadows: () => {
        /** @type {readonly EdagValue[]} */
        const noncallable = [null, undefinedValue, false, true, 0, NaN, '', 'method', 0n, data, receiver([])]
        for (const value of noncallable) {
            const both = receiver([[':', 'toString', value], [':', 'valueOf', value]])
            for (const hint of /** @type {const} */ (['number', 'string'])) {
                assertStructurallySame(assertError(objectToPrimitive(both, hint, skipped)), ['undefined'])
            }
            const selected = ok(42)
            assertEq(objectToPrimitive(
                receiver([[':', 'toString', value], [':', 'valueOf', valueOf]]),
                'string', answers([[valueOf, selected]]),
            ), selected)
            assertEq(objectToPrimitive(
                receiver([[':', 'valueOf', value], [':', 'toString', toString]]),
                'number', answers([[toString, selected]]),
            ), selected)
        }
    },
    nonprimitiveResults: () => {
        // A returned object has its own methods, but conversion must not
        // recursively invoke them or convert arrays/functions either.
        const nested = receiver([[':', 'valueOf', valueOf], [':', 'toString', toString]])
        for (const value of [data, nested, valueOf]) {
            const nonprimitive = ok(value)
            const selected = ok('fallback')
            assertEq(objectToPrimitive(methods, 'number', answers([
                [valueOf, nonprimitive], [toString, selected],
            ])), selected)
            assertEq(objectToPrimitive(methods, 'string', answers([
                [toString, nonprimitive], [valueOf, selected],
            ])), selected)
            for (const hint of /** @type {const} */ (['number', 'string'])) {
                assertStructurallySame(assertError(objectToPrimitive(methods, hint, answers([
                    [valueOf, nonprimitive], [toString, nonprimitive],
                ]))), ['undefined'])
            }
        }
    },
    methodFailures: () => {
        for (const failure of [error(null), error(undefinedValue), error(data), error(methods), error(valueOf), error(NaN)]) {
            assertEq(objectToPrimitive(methods, 'number', answers([[valueOf, failure]])), failure)
            assertEq(objectToPrimitive(methods, 'string', answers([[toString, failure]])), failure)
            assertEq(objectToPrimitive(methods, 'number', answers([
                [valueOf, ok(data)], [toString, failure],
            ])), failure)
            assertEq(objectToPrimitive(methods, 'string', answers([
                [toString, ok(data)], [valueOf, failure],
            ])), failure)
        }
    },
    invocationBindings: () => {
        for (const length of [0, 1, 16]) {
            const method = assertOk(func(length, [() => ok(data)], ['throw', 'invoker owns execution']))
            const value = receiver([[':', 'valueOf', method]])
            const captures = method[2]
            const body = method[3]
            /** @type {Invoke} */
            const invoke = (fn, fixed, rest) => {
                assertEq(fn, method)
                assert(fn[0] === '=>')
                assertEq(fn[2], captures)
                assertEq(fn[2][0], data)
                assertEq(fn[3], body)
                assertEq(fixed.length, length)
                for (const argument of fixed) { assertStructurallySame(argument, ['undefined']) }
                assertStructurallySame(rest, ['[]', []])
                return error(rest)
            }
            const firstRest = assertError(objectToPrimitive(value, 'number', invoke))
            const secondRest = assertError(objectToPrimitive(value, 'number', invoke))
            assertEq(Object.is(firstRest, secondRest), false)
            assertEq(method[2], captures)
            assertEq(method[3], body)
        }
    },
    primitiveStrings: () => {
        /** @type {readonly (readonly [Primitive, string])[]} */
        const cases = [
            [undefinedValue, 'undefined'], [null, 'null'], [false, 'false'], [true, 'true'],
            [0, '0'], [-0, '0'], [NaN, 'NaN'], [Infinity, 'Infinity'], [-Infinity, '-Infinity'],
            [1, '1'], [-1, '-1'], [1.5, '1.5'],
            [1e20, '100000000000000000000'], [1e21, '1e+21'], [-1e21, '-1e+21'],
            [1e-6, '0.000001'], [1e-7, '1e-7'],
            ['', ''], ['undefined', 'undefined'], ['  value  ', '  value  '], ['😀\ud800', '😀\ud800'],
            [0n, '0'], [1n, '1'], [-1n, '-1'],
            [123_456_789_012_345_678_901_234_567_890n, '123456789012345678901234567890'],
        ]
        for (const [value, expected] of cases) { assertEq(primitiveToString(value), expected) }
    },
    primitiveNumbers: () => {
        /** @type {readonly (readonly [Primitive, number])[]} */
        const cases = [
            [undefinedValue, NaN], [null, 0], [false, 0], [true, 1],
            [0, 0], [-0, -0], [NaN, NaN], [Infinity, Infinity], [-Infinity, -Infinity],
            [1, 1], [-1, -1], [1.5, 1.5],
        ]
        for (const [value, expected] of cases) {
            assertEq(Object.is(assertOk(primitiveToNumber(value)), expected), true)
            assertEq(Object.is(primitiveToNumeric(value), expected), true)
        }
    },
    numericStrings: () => {
        /** @type {readonly (readonly [string, number])[]} */
        const cases = [
            ['', 0], ['\t\n\r \u00a0\ufeff\u2028\u2029', 0], ['\u00a0-1\u2029', -1],
            ['0', 0], ['-0', -0], [' \t-0\n', -0], ['+1', 1], ['1.5', 1.5], ['.5', 0.5],
            ['1e3', 1_000], ['1e-3', 0.001], ['0x10', 16], ['0b101', 5], ['0o17', 15],
            ['Infinity', Infinity], ['+Infinity', Infinity], ['-Infinity', -Infinity],
            ['NaN', NaN], ['undefined', NaN], ['null', NaN], ['true', NaN],
            ['12x', NaN], ['1_000', NaN], ['1n', NaN], ['0x', NaN], ['-0x10', NaN], ['1 2', NaN],
        ]
        for (const [value, expected] of cases) {
            assertEq(Object.is(assertOk(primitiveToNumber(value)), expected), true)
            assertEq(Object.is(primitiveToNumeric(value), expected), true)
        }
    },
    bigintNumbers: () => {
        // The explicit Number constructor accepts bigint; abstract
        // ToNumber rejects it, including values exactly representable.
        assertEq(Number(1n), 1)
        for (const value of [0n, 1n, -1n, 123_456_789_012_345_678_901_234_567_890n]) {
            assertStructurallySame(assertError(primitiveToNumber(value)), ['undefined'])
            assertEq(primitiveToNumeric(value), value)
        }
    },
    primitiveComposition: () => {
        const string = assertOk(objectToPrimitive(methods, 'number', answers([[valueOf, ok(' 0x10 ')]])))
        assertEq(primitiveToString(string), ' 0x10 ')
        assertEq(assertOk(primitiveToNumber(string)), 16)
        const bigint = assertOk(objectToPrimitive(methods, 'number', answers([[valueOf, ok(1n)]])))
        assertEq(primitiveToString(bigint), '1')
        assertStructurallySame(assertError(primitiveToNumber(bigint)), ['undefined'])
    },
}
