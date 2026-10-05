/**
 * Ordinary object conversion orders methods by hint, distinguishes absent
 * methods from shadows, and propagates primitive results and failures.
 *
 * @import { EdagValue, Property, Object as ValueObject, Function as ValueFunction } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { object } from '../object/module.f.mjs'
import { func } from '../function/module.f.mjs'
import { objectToPrimitive } from './module.f.mjs'

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
        /** @type {readonly EdagValue[]} */
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
}
