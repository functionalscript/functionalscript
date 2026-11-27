/**
 * Function construction retains evaluated captures and the body code it was
 * given; `ownBodies` gives each function of a value a copy of its own,
 * preserving sharing without merging distinct nodes.
 *
 * @import { EdagValue, Closure, GroupFunction, Object as ValueObject } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { isArray } from '../../../types/array/module.f.js'
import { ok, error } from '../../../types/result/module.f.js'
import { validateClosure } from '../closure/module.f.js'
import { codeLength, func, ownBodies } from './module.f.js'

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
        assertEq(value[3], template)
        const undefinedBody = assertOk(func(0, [], undefinedValue))
        assertEq(undefinedBody[3], undefinedValue)
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
            assertEq(Object.is(actual[Number(i)], expected[Number(i)]), true)
        }
        assertEq(capturedFunction[3][0], 'throw')
        assertEq(capturedFunction[2][0], data)
    },
    // Two functions made from one arrow are two functions over one body.
    sharedBody: () => {
        const template = /** @type {const} */ (['[]', [['+', ['arg', 0], 1]]])
        const first = assertOk(func(1, [], template))
        const second = assertOk(func(1, [], template))
        assertEq(Object.is(first, second), false)
        assertEq(first[3], template)
        assertEq(second[3], template)
    },
    unevaluatedBody: () => {
        const template = /** @type {const} */ (['throw', 'body remains code'])
        assertEq(assertOk(func(0, [], template))[3], template)
    },
    groupMembers: () => {
        const group = /** @type {const} */ (['group', [data], [[0, ['self', 1]], [1, ['frame', 0]]]])
        const pair = /** @type {const} */ (['[]', [['fn', group, 0], ['fn', group, 1]]])
        const copy = ownBodies(pair)
        assertOk(validateClosure(copy))
        const [, items] = /** @type {import('../types.ts').Array} */ (copy)
        const [a, b] = /** @type {readonly GroupFunction[]} */ (items)
        assertEq(a[1], b[1])
        assertEq(a[1] === group, false)
        assertEq(a[1][2][0][1] === group[2][0][1], false)
        assertEq(codeLength(['=>', 2, [], 0]), 2)
        assertEq(codeLength(a), 0)
        assertEq(codeLength(b), 1)
    },
    ownBodies: {
        // What has no items and no body is the value itself.
        leaves: () => {
            for (const value of [null, false, 0, -0, '', '=>', 1n]) {
                assertEq(Object.is(ownBodies(value), value), true)
            }
            const entry = /** @type {const} */ (['entry'])
            const builtIn = /** @type {const} */ (['Object.is'])
            assertEq(ownBodies(undefinedValue), undefinedValue)
            assertEq(ownBodies(entry), entry)
            assertEq(ownBodies(builtIn), builtIn)
        },
        // Sharing within a body is kept, distinct nodes stay distinct, and
        // no node is the template's or another function's.
        bodyScopesAndSharing: () => {
            const operation = /** @type {const} */ (['+', ['arg', 0], 1])
            const left = /** @type {const} */ (['[]', []])
            const right = /** @type {const} */ (['[]', []])
            const template = /** @type {const} */ (['[]', [operation, operation, left, right]])
            const expected = /** @type {const} */ (['[]', [
                ['+', ['arg', 0], 1], ['+', ['arg', 0], 1], ['[]', []], ['[]', []],
            ]])
            const made = /** @type {const} */ (['[]', [assertOk(func(1, [], template)), assertOk(func(1, [], template))]])
            const [, [first, second]] = /** @type {readonly ['[]', readonly [Closure, Closure]]} */ (ownBodies(made))
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
            // Structural assertions establish this shape; the type Exp does
            // not retain the template's particular tuple type.
            const copied = /** @type {typeof template} */ (first[3])
            assertEq(copied[1][0], copied[1][1])
            assertEq(Object.is(copied[1][2], copied[1][3]), false)
            // the value given is left as it was
            assertEq(made[1][0][3], template)
            assertEq(template[1][0], operation)
            assertEq(template[1][2], left)
        },
        // A function made by a body shares that body's code; with bodies
        // of their own, the maker and what it made coexist in one closed
        // value, which the analysis refuses of the value as made.
        nestedFunctions: () => {
            const inner = /** @type {const} */ (['[]', [['frame', 0], ['arg', 0]]])
            const template = /** @type {const} */ (['=>', 1, [['arg', 0]], inner])
            const maker = assertOk(func(1, [], template))
            const made = assertOk(func(1, [() => ok(data)], inner))
            const again = assertOk(func(1, [() => ok(data)], inner))
            const graph = /** @type {const} */ (['[]', [data, maker, made, again]])
            assertEq(validateClosure(graph)[0], 'error')
            const [, [captured, ownMaker, ownMade, ownAgain]] = /** @type {readonly ['[]', readonly [EdagValue, Closure, Closure, Closure]]} */ (ownBodies(graph))
            assertStructurallySame(ownMaker[3], template)
            assertStructurallySame(ownMade[3], inner)
            for (const node of arrays(ownMade[3])) {
                assertEq(arrays(ownMaker[3]).includes(node), false)
                assertEq(arrays(ownAgain[3]).includes(node), false)
            }
            // evaluated captures are values: answered once, and shared
            assertStructurallySame(captured, data)
            assertEq(ownMade[2][0], captured)
            assertEq(ownAgain[2][0], captured)
            const owned = ownBodies(graph)
            assertEq(assertOk(validateClosure(owned)), owned)
        },
        // One value reached twice is one value; two equal values are two.
        identity: () => {
            const fn = assertOk(func(0, [() => ok(data)], ['frame', 0]))
            const twin = /** @type {const} */ (['[]', ['+', 1, 2]])
            const value = /** @type {const} */ (['{}', [[':', 'a', fn], [':', 'b', fn], [':', 'c', data], [':', 'd', twin], [':', 'e', ['[]', [record, record]]]]])
            const [, properties] = /** @type {ValueObject} */ (ownBodies(value))
            assertStructurallySame(properties.map(([, key]) => key), ['a', 'b', 'c', 'd', 'e'])
            const [a, b, c, d, e] = properties.map(([, , item]) => item)
            assertEq(a, b)
            assertEq(Object.is(a, fn), false)
            assertEq(/** @type {Closure} */ (a)[2][0], c)
            assertStructurallySame(c, data)
            assertStructurallySame(d, twin)
            assertEq(Object.is(c, d), false)
            const [, [first, second]] = /** @type {readonly ['[]', readonly [ValueObject, ValueObject]]} */ (e)
            assertEq(first, second)
            assertEq(first[1][0][2], c)
        },
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
