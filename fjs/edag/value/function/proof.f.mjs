/**
 * Function construction retains evaluated captures and gives copied body
 * code its own scope, preserving sharing without merging distinct nodes.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { validateClosure } from '../closure/module.f.mjs'
import { func } from './module.f.mjs'

/** A later capture that must never be evaluated. @type {() => never} */
const skipped = () => { assert(false, 'a capture after a failure was evaluated') }

/** Collect code-array references for comparisons between scopes. @type {(part: unknown) => readonly (readonly unknown[])[]} */
const arrays = part => isArray(part) ? [part, ...part.flatMap(arrays)] : []

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', ['+', 1, 2]])
const record = /** @type {const} */ (['{}', [[':', 'value', data]]])
const capturedFunction = /** @type {const} */ (['=>', 0, [data], ['throw', 'capture stays code']])

export const proof = {
    primitiveBodies: () => {
        for (const body of [null, false, true, 0, -0, NaN, Infinity, -Infinity, '', 'undefined', '=>', '[]', 0n, 1n, -1n]) {
            const [tag, length, captures, actual] = assertOk(func(0, [], body))
            assertEq(tag, '=>')
            assertEq(length, 0)
            assertEq(captures.length, 0)
            assertEq(Object.is(actual, body), true)
        }
    },
    emptyBody: () => {
        const template = /** @type {const} */ (['[]', []])
        const value = assertOk(func(0, [], template))
        assertStructurallySame(value, ['=>', 0, [], ['[]', []]])
        for (const node of arrays(value[3])) {
            assertEq(arrays(template).includes(node), false)
        }
        assertStructurallySame(template, ['[]', []])
        const undefinedBody = assertOk(func(0, [], undefinedValue))
        assertStructurallySame(undefinedBody[3], ['undefined'])
        assertEq(Object.is(undefinedBody[3], undefinedValue), false)
    },
    parameterLength: () => {
        assertStructurallySame(assertOk(func(16, [], ['arg', 15])), ['=>', 16, [], ['arg', 15]])
    },
    captures: () => {
        /** @type {readonly EdagValue[]} */
        const expected = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            '', 'undefined', 0n, 1n, -1n, data, record, capturedFunction, data, capturedFunction,
        ]
        const [, , actual] = assertOk(func(0, expected.map(value => () => ok(value)), 0))
        assertEq(actual.length, expected.length)
        for (let i = 0; i < expected.length; i += 1) {
            assertEq(Object.is(actual[i], expected[i]), true)
        }
        assertEq(capturedFunction[3][0], 'throw')
        assertEq(capturedFunction[2][0], data)
    },
    bodyScopesAndSharing: () => {
        const operation = /** @type {const} */ (['+', ['arg', 0], 1])
        const left = /** @type {const} */ (['[]', []])
        const right = /** @type {const} */ (['[]', []])
        const template = /** @type {const} */ (['[]', [operation, operation, left, right]])
        const expected = /** @type {const} */ (['[]', [
            ['+', ['arg', 0], 1], ['+', ['arg', 0], 1], ['[]', []], ['[]', []],
        ]])
        const first = assertOk(func(1, [], template))
        const second = assertOk(func(1, [], template))
        assertEq(Object.is(first, second), false)
        assertStructurallySame(first[3], expected)
        assertStructurallySame(second[3], expected)
        assertStructurallySame(template, expected)
        const originalArrays = arrays(template)
        const firstArrays = arrays(first[3])
        const secondArrays = arrays(second[3])
        for (const node of firstArrays) { assertEq(originalArrays.includes(node), false) }
        for (const node of secondArrays) {
            assertEq(originalArrays.includes(node), false)
            assertEq(firstArrays.includes(node), false)
        }
        // Structural assertions establish this shape; the return type Exp
        // does not retain the template's particular tuple type.
        const copied = /** @type {typeof template} */ (first[3])
        assertEq(copied[1][0], copied[1][1])
        assertEq(Object.is(copied[1][2], copied[1][3]), false)
        assertEq(template[1][0], operation)
        assertEq(template[1][1], operation)
        assertEq(template[1][2], left)
        assertEq(template[1][3], right)
    },
    nestedFunctions: () => {
        const template = /** @type {const} */ (['=>', 0,
            [['arg', 0], ['frame', 0]],
            ['[]', [['frame', 0], ['frame', 1]]],
        ])
        const first = assertOk(func(1, [() => ok(data)], template))
        const second = assertOk(func(1, [() => ok(data)], template))
        assertStructurallySame(first[3], template)
        assertStructurallySame(second[3], template)
        assertEq(first[2][0], data)
        assertEq(second[2][0], data)
        for (const node of arrays(first[3])) { assertEq(arrays(template).includes(node), false) }
        for (const node of arrays(second[3])) {
            assertEq(arrays(template).includes(node), false)
            assertEq(arrays(first[3]).includes(node), false)
        }
        // Both outer functions and their nested body scopes must coexist
        // in one closed value while sharing evaluated captures.
        const graph = /** @type {const} */ (['[]', [data, first, second]])
        assertEq(assertOk(validateClosure(graph)), graph)
    },
    unevaluatedBody: () => {
        const template = /** @type {const} */ (['throw', 'body remains code'])
        const value = assertOk(func(0, [], template))
        assertStructurallySame(value[3], template)
        assertEq(Object.is(value[3], template), false)
    },
    captureFailures: () => {
        for (const failure of [error(data), error(record), error(capturedFunction), error(undefinedValue), error(NaN)]) {
            const fail = () => failure
            assertEq(func(0, [fail, skipped], 0), failure)
            assertEq(func(0, [() => ok(data), fail, skipped], 0), failure)
            assertEq(func(0, [() => ok(data), () => ok(record), fail], 0), failure)
        }
    },
}
