/**
 * Control flow demands only the selected operands and preserves their
 * Result tuples, including failures and represented value identities.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertError } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { throwValue, and, or, coalesce, conditional } from './module.f.mjs'

/** A thunk that must never be demanded. @type {() => never} */
const skipped = () => { assert(false, 'an unselected operand was evaluated') }

const data = /** @type {const} */ (['[]', [1]])
const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])

/** @type {readonly EdagValue[]} */
const falsy = [null, ['undefined'], false, 0, -0, NaN, '', 0n]

/** @type {readonly EdagValue[]} */
const truthy = [
    true, 1, -1, 0.5, Infinity, -Infinity, 1n, -1n,
    'value', '0', 'undefined', '=>', '[]', '{}',
    ['[]', []], ['{}', []], ['=>', 0, [], 0], data, object, func,
]

/** @type {readonly EdagValue[]} */
const values = [...falsy, ...truthy]

export const proof = {
    shortCircuit: () => {
        for (const value of falsy) {
            const result = ok(value)
            assertEq(and(result, skipped), result)
        }
        for (const value of truthy) {
            const result = ok(value)
            assertEq(or(result, skipped), result)
        }
    },
    logicalSelection: () => {
        const selected = ok(func)
        for (const value of truthy) {
            assertEq(and(ok(value), () => selected), selected)
        }
        for (const value of falsy) {
            assertEq(or(ok(value), () => selected), selected)
        }
    },
    nullishSelection: () => {
        const selected = ok(object)
        assertEq(coalesce(ok(null), () => selected), selected)
        assertEq(coalesce(ok(['undefined']), () => selected), selected)
        // Falsy values other than null and undefined are retained.
        for (const value of [false, 0, -0, NaN, '', 0n, ...truthy]) {
            const result = ok(value)
            assertEq(coalesce(result, skipped), result)
        }
    },
    branches: () => {
        const selected = ok(data)
        for (const value of truthy) {
            assertEq(conditional(ok(value), () => selected, skipped), selected)
        }
        for (const value of falsy) {
            assertEq(conditional(ok(value), skipped, () => selected), selected)
        }
    },
    selectedResults: () => {
        // Selected successes and failures keep their complete Result,
        // regardless of the kind or truthiness of its payload.
        for (const value of values) {
            for (const selected of [ok(value), error(value)]) {
                const right = () => selected
                assertEq(and(ok(true), right), selected)
                assertEq(or(ok(false), right), selected)
                assertEq(coalesce(ok(null), right), selected)
                assertEq(coalesce(ok(['undefined']), right), selected)
                assertEq(conditional(ok(true), right, skipped), selected)
                assertEq(conditional(ok(false), skipped, right), selected)
            }
        }
    },
    firstFailure: () => {
        for (const value of values) {
            const failure = error(value)
            assertEq(and(failure, skipped), failure)
            assertEq(or(failure, skipped), failure)
            assertEq(coalesce(failure, skipped), failure)
            assertEq(conditional(failure, skipped, skipped), failure)
        }
    },
    throwValue: () => {
        for (const value of values) {
            assertEq(Object.is(assertError(throwValue(ok(value))), value), true)
            const failure = error(value)
            assertEq(throwValue(failure), failure)
        }
    },
    composition: () => {
        const selected = ok(object)
        const success = and(
            or(ok(false), () => ok(true)),
            () => conditional(ok('value'), () => selected, skipped),
        )
        assertEq(success, selected)
        assertEq(assertOk(success), object)
        const failure = throwValue(ok(func))
        assertEq(conditional(
            or(coalesce(ok(['undefined']), () => failure), skipped),
            skipped,
            skipped,
        ), failure)
        assertEq(assertError(failure), func)
    },
}
