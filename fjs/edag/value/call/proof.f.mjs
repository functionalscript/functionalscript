/**
 * Calls evaluate arguments before checking callability, split fixed and rest
 * values, and preserve the invoked function and returned Result identities.
 *
 * @import { EdagValue, Values } from '../types.ts'
 * @import { ItemsOver } from '../../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Body, Invoke } from './types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.js'
import { func } from '../function/module.f.mjs'
import { call, invoker, prepare, settle } from './module.f.mjs'

/** An argument or invocation that must never be demanded. @type {() => never} */
const skipped = () => { assert(false, 'a skipped call step was evaluated') }

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', [1]])
const record = /** @type {const} */ (['{}', [[':', 'value', data]]])
const functionValue = assertOk(func(1, [() => ok(record)], ['frame', 0]))

/** @type {(length: number, items: ItemsOver<ValueThunk>, expectedFixed: Values, expectedRest: Values) => void} */
const expectCall = (length, items, expectedFixed, expectedRest) => {
    const fn = /** @type {const} */ (['=>', length, [], 0])
    const selected = ok('invoked')
    assertEq(call(ok(fn), items, (actual, fixed, rest) => {
        assertEq(actual, fn)
        assertStructurallySame(fixed, expectedFixed)
        assertStructurallySame(rest, ['[]', expectedRest])
        return selected
    }), selected)
}

export const proof = {
    fixedSlots: () => {
        expectCall(0, [], [], [])
        expectCall(0, [() => ok(null), () => ok(undefinedValue)], [], [null, undefinedValue])
        expectCall(1, [], [undefinedValue], [])
        expectCall(1, [() => ok(null)], [null], [])
        expectCall(1, [() => ok(undefinedValue), () => ok(data)], [undefinedValue], [data])
        const full = Array.from({ length: 16 }, (_, i) => i)
        const items = full.map(value => () => ok(value))
        expectCall(16, items, full, [])
        expectCall(16, [...items, () => ok(data), () => ok(record)], full, [data, record])
        expectCall(16, [() => ok(null), () => ok(undefinedValue)], [
            null, undefinedValue, ...Array.from({ length: 14 }, () => undefinedValue),
        ], [])
    },
    spreadBoundary: () => {
        expectCall(3, [
            () => ok(null),
            ['...', () => ok(['[]', [data, undefinedValue, record]])],
            ['...', () => ok('a😀b')],
            () => ok(functionValue),
        ], [null, data, undefinedValue], [record, 'a', '😀', 'b', functionValue])
    },
    invocationResults: () => {
        const captures = functionValue[2]
        const body = functionValue[3]
        for (const selected of [ok(data), ok(functionValue), error(record), error(functionValue), error(undefinedValue)]) {
            assertEq(call(ok(functionValue), [
                () => ok(data), ['...', () => ok(['[]', [data, functionValue]])],
            ], (fn, fixed, rest) => {
                assertEq(fn, functionValue)
                assert(fn[0] === '=>')
                assertEq(fn[2], captures)
                assertEq(fn[3], body)
                assertEq(fn[2][0], record)
                assertEq(fixed[0], data)
                const firstRead = rest[1][0]
                assertEq(firstRead, data)
                assertEq(rest[1][1], functionValue)
                assertEq(firstRead, fixed[0])
                assertEq(rest[1][0], firstRead)
                return selected
            }), selected)
        }
        assertEq(functionValue[2], captures)
        assertEq(functionValue[3], body)
    },
    freshRest: () => {
        const zero = /** @type {const} */ (['=>', 0, [], 0])
        const source = /** @type {const} */ (['[]', [data, data]])
        /** @type {ItemsOver<ValueThunk>} */
        const items = [['...', () => ok(source)]]
        /** @type {Invoke} */
        const returnRest = (fn, fixed, rest) => {
            assertEq(fn, zero)
            assertEq(fixed.length, 0)
            return ok(rest)
        }
        const first = assertOk(call(ok(zero), items, returnRest))
        const second = assertOk(call(ok(zero), items, returnRest))
        assertStructurallySame(first, source)
        assertStructurallySame(second, source)
        assertEq(Object.is(first, source), false)
        assertEq(Object.is(second, source), false)
        assertEq(Object.is(first, second), false)
        const emptyFirst = assertOk(call(ok(zero), [], returnRest))
        const emptySecond = assertOk(call(ok(zero), [], returnRest))
        assertStructurallySame(emptyFirst, ['[]', []])
        assertStructurallySame(emptySecond, ['[]', []])
        assertEq(Object.is(emptyFirst, emptySecond), false)
    },
    calleeFailure: () => {
        for (const failure of [error(data), error(functionValue), error(undefinedValue), error(NaN)]) {
            assertEq(call(failure, [skipped, ['...', skipped]], skipped), failure)
        }
    },
    nonFunctions: () => {
        /** @type {readonly EdagValue[]} */
        const values = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            '', 'undefined', '=>', 0n, 1n, -1n, ['[]', []], ['{}', []], data, record,
        ]
        const failure = error(functionValue)
        for (const value of values) {
            assertStructurallySame(assertError(call(ok(value), [() => ok(data)], skipped)), ['undefined'])
            // An argument failure wins even when the callee is non-callable.
            assertEq(call(ok(value), [() => ok(data), () => failure, skipped], skipped), failure)
        }
    },
    argumentFailure: () => {
        const failure = error(record)
        const fail = () => failure
        assertEq(call(ok(functionValue), [fail, skipped], skipped), failure)
        assertEq(call(ok(functionValue), [() => ok(data), ['...', fail], skipped], skipped), failure)
        assertEq(call(ok(functionValue), [() => ok(data), fail], skipped), failure)
    },
    invalidSpread: () => {
        assertStructurallySame(assertError(call(ok(functionValue), [
            () => ok(data), ['...', () => ok(record)], skipped,
        ], skipped)), ['undefined'])
    },
    // `prepare` is the binding alone, the call left to make: the function
    // and its bindings, as the invoker receives them; a failure is the
    // call's, as before any invoker
    prepared: () => {
        const prepared = prepare(ok(functionValue), [() => ok(data), () => ok(record)])
        assert(prepared[0] === 'call')
        assertEq(prepared[1], functionValue)
        assertEq(prepared[2][0], data)
        assertStructurallySame(prepared[3], ['[]', [record]])
        const failure = error(record)
        assertEq(prepare(failure, [skipped]), failure)
        assertStructurallySame(prepare(ok(data), []), ['error', ['undefined']])
        // the `entry` helper binds its two; a static function binds none
        // here, its arguments all rest for the invoker to bind to the body
        // it finds
        assertStructurallySame(prepare(ok(['entry']), [() => ok(data)]), ['call', ['entry'], [data, ['undefined']], ['[]', []]])
        assertStructurallySame(prepare(ok(['Object.entries']), [() => ok(data), () => ok(record)]), ['call', ['Object.entries'], [], ['[]', [data, record]]])
        assertStructurallySame(prepare(ok(['Object.is']), [() => ok(data)]), ['call', ['Object.is'], [], ['[]', [data]]])
    },
    // `settle` makes the one call an outcome leaves and passes a value or a
    // throw through; `invoker` makes every call a body leaves, one after
    // the other, as many as the chain is long — far more than the host
    // stack holds frames, since none is made inside another
    tailCalls: () => {
        /** A body counting its function's `length` down through a call each, to the array of its fixed values. @type {Body} */
        const body = (fn, fixed, rest) => {
            assert(fn[0] === '=>')
            return fn[1] === 0 ? ok(['[]', fixed]) : ['call', ['=>', fn[1] - 1, [], 0], fixed, rest]
        }
        const invoke = invoker(body)
        const value = ok(data)
        assertEq(settle(invoke)(value), value)
        const failure = error(record)
        assertEq(settle(invoke)(failure), failure)
        assertStructurallySame(settle(invoke)(['call', ['=>', 2, [], 0], [data], ['[]', []]]), ['ok', ['[]', [data]]])
        assertStructurallySame(invoke(['=>', 100_000, [], 0], [record], ['[]', []]), ['ok', ['[]', [record]]])
        assertStructurallySame(invoke(['=>', 0, [], 0], [], ['[]', []]), ['ok', ['[]', []]])
        // `call` is the two composed, through a prepared call of `length` 2
        assertStructurallySame(call(ok(['=>', 2, [], 0]), [() => ok(data)], invoke), ['ok', ['[]', [data, undefinedValue]]])
    },
}
