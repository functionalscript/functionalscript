/**
 * Execute the common prepared plan through the JavaScript output boundary.
 * Host compilation observes nonlocal return behavior, closure lifetimes and
 * simultaneous state changes, which inspecting the IR alone cannot establish.
 *
 * @import { BindingId, Function as FastFunction, Value as FastValue } from '../types.ts'
 */

import { throws } from 'node:assert/strict'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { prepare, prepareFunction } from './module.f.mjs'
import { functionStringify } from '../serializer/module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(fn: FastFunction) => (...args: readonly unknown[]) => any} */
const compile = fn => Function(`"use strict";return (${functionStringify(prepareFunction(fn))});`)()

export const proof = {
    memberReturnOperands: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const selected = id(100)
        const result = id(101)
        /** @type {(value?: FastValue) => FastValue} */
        const escape = (value = 7) => ['block', { statements: [], exit: ['return', target, value] }]
        /** @type {(normal: FastValue) => FastValue} */
        const choice = normal => ['if', ['ref', selected], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', [normal]] }]
        /** @type {(value: FastValue) => (...args: readonly unknown[]) => any} */
        const valueFunction = value => compile({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: { statements: [['define', result, value, 'required']], exit: ['return', target, ['ref', result]] },
        })

        throws(() => valueFunction(['.', null, 'x', ['|()', [escape()]]])(), TypeError)
        for (const receiver of /** @type {readonly FastValue[]} */ ([['object', []], ['object', [[':', 'x', 0]]]])) {
            const fn = valueFunction(['.', receiver, 'x', ['|()', [choice(1)]]])
            assertEq(fn(true), 7)
            throws(() => fn(false), TypeError)
        }
        const native = valueFunction(['.', 'abc', 'slice', ['|()', [choice(1)]]])
        assertEq(native(true), 7)
        assertEq(native(false), 'bc')
        const directNative = valueFunction(['()', ['.', 'abc', 'slice'], [choice(1)]])
        assertEq(directNative(true), 7)
        assertEq(directNative(false), 'bc')
        assertEq(valueFunction(['()', ['.', 'abc', 'slice'], [1]])(), 'bc')
        const directReceiver = valueFunction(['()', ['.', choice('abc'), 'slice'], [1]])
        assertEq(directReceiver(true), 7)
        assertEq(directReceiver(false), 'bc')
        const directKey = valueFunction(['()', ['.', null, ['Number', choice(0)]], []])
        assertEq(directKey(true), 7)
        throws(() => directKey(false), TypeError)
        throws(() => valueFunction(['()', ['.', null, 'x'], [escape()]])(), TypeError)
        const directNoncallable = valueFunction(['()', ['.', ['object', [[':', 'x', 0]]], 'x'], [choice(1)]])
        assertEq(directNoncallable(true), 7)
        throws(() => directNoncallable(false), TypeError)
        assertEq(valueFunction(['.', null, ['Number', escape()]])(), 7)

        const skippedKey = valueFunction(['?.', null, ['Number', choice(0)]])
        assertEq(skippedKey(true), undefined)
        const reachedKey = valueFunction(['?.', ['object', [[':', '0', 5]]], ['Number', choice(0)]])
        assertEq(reachedKey(true), 7)
        assertEq(reachedKey(false), 5)
        for (const value of [null, undefined]) {
            assertEq(valueFunction(['.', ['object', [[':', 'x', value]]], 'x', ['|?.()', [escape()]]])(), undefined)
        }
        const present = valueFunction(['.', ['object', [[':', 'x', 0]]], 'x', ['|?.()', [choice(1)]]])
        assertEq(present(true), 7)
        throws(() => present(false), TypeError)
        assertEq(valueFunction(['?.()', undefined, [escape()]])(), undefined)
        assertEq(valueFunction(['?.()', 0, [escape()]])(), 7)
        assertEq(valueFunction(['?.', null, 'x', ['|()', [escape()]]])(), undefined)
        assertEq(valueFunction(['?.', null, 'x', ['|!()', [escape()]]])(), 7)
        assertEq(valueFunction(['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [], ['|!()', [escape()]]]])(), 7)

        const payload = /** @type {readonly unknown[]} */ ([])
        assertEq(valueFunction(['.', ['object', [[':', 'x', 0]]], 'x', ['|()', [escape(['ref', selected])]]])(payload), payload)
        const receiver = id(102)
        const memo = compile({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: { statements: [
                ['define', receiver, ['array', [1, 2]], 'lazy'],
                ['define', result, ['.', ['ref', receiver], 'slice', ['|()', [choice(1)]]], 'required'],
            ], exit: ['return', target, ['ref', result]] },
        })
        assertEq(memo(true), 7)
        assertStructurallySame(memo(false), [2])

        const childTarget = { kind: /** @type {const} */ ('function'), index: 0 }
        const child = valueFunction(['function', {
            target: childTarget, parameters: [], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['return', childTarget, ['.', ['object', [[':', 'x', 0]]], 'x', ['|()', [
                ['block', { statements: [], exit: ['return', childTarget, 9] }],
            ]]]] },
        }])()
        assertEq(child(), 9)
        const capture = id(103)
        assertEq(valueFunction(['function', {
            target: childTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ['.', ['object', [[':', 'x', 0]]], 'x', ['|()', [escape()]]] }],
            body: { statements: [], exit: ['return', childTarget, ['ref', capture]] },
        }])(), 7)
    },
    directMemberLoopTransfers: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        const selected = id(0)
        const count = id(1)
        const value = id(2)
        const result = id(3)
        /** @type {(callee: FastValue, argument: FastValue) => FastFunction} */
        const fn = (callee, argument) => ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: {
                statements: [['loop', {
                    target: loop, parameters: [count], initial: [0], results: [result],
                    body: {
                        statements: [['define', value, ['()', callee, [argument]], 'required']],
                        exit: ['break', loop, [['ref', value]]],
                    },
                }]],
                exit: ['return', target, ['ref', result]],
            },
        })
        /** @type {FastValue} */
        const leave = ['block', { statements: [], exit: ['break', loop, [9]] }]
        /** @type {FastValue} */
        const choice = ['if', ['ref', selected], { statements: [], exit: ['break', loop, [9]] }, { statements: [], exit: ['yield', [1]] }]
        /** @type {(source: FastFunction) => (...args: readonly unknown[]) => any} */
        const standalone = source => Function(`"use strict";return (${functionStringify({ ...source, captures: [], body: prepare(source.body) })});`)()
        for (const render of [compile, standalone]) {
            // A former bare-call path must retain lookup before a successful
            // outer break, and preserve the receiver on a normal argument.
            throws(() => render(fn(['.', null, 'x'], leave))(), TypeError)
            assertEq(render(fn(['.', ['object', [[':', 'x', 0]]], 'x'], leave))(), 9)
            const native = render(fn(['.', 'abc', 'slice'], choice))
            assertEq(native(true), 9)
            assertEq(native(false), 'bc')
        }
        /** @type {FastValue} */
        const receiver = ['if', ['===', ['ref', count], 0],
            { statements: [], exit: ['continue', loop, [1]] },
            { statements: [], exit: ['yield', ['abc']] },
        ]
        const argument = /** @type {FastValue} */ (['if', ['ref', selected],
            { statements: [], exit: ['return', target, 7] },
            { statements: [], exit: ['yield', [1]] },
        ])
        const mixed = compile(fn(['.', receiver, 'slice'], argument))
        assertEq(mixed(true), 7)
        assertEq(mixed(false), 'bc')
    },
    returnThroughValue: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const condition = id(0)
        const result = id(1)
        const fn = compile({
            target, parameters: [condition], rest: null, self: null, captures: [],
            body: {
                statements: [['define', result, ['if', ['ref', condition],
                    { statements: [], exit: ['return', target, 7] },
                    { statements: [], exit: ['yield', [2]] },
                ], 'required']],
                exit: ['return', target, ['+', ['ref', result], 1]],
            },
        })
        assertEq(fn(true), 7)
        assertEq(fn(false), 3)
        /** @type {readonly (readonly [FastValue, unknown, unknown, number])[]} */
        const cases = [
            [['if', ['ref', condition], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', [['ref', condition]]] }], true, false, 1],
            [['if', ['ref', condition], { statements: [], exit: ['yield', [['ref', condition]]] }, { statements: [], exit: ['return', target, 7] }], false, true, 2],
            [['if', ['if', ['===', ['ref', condition], null], { statements: [], exit: ['yield', [true]] }, { statements: [], exit: ['yield', [['===', ['ref', condition], undefined]]] }],
                { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', [['ref', condition]]] }], null, 0, 1],
        ]
        for (const [value, selected, skipped, expected] of cases) {
            const lazy = compile({
                target, parameters: [condition], rest: null, self: null, captures: [],
                body: {
                    statements: [['define', result, value, 'required']],
                    exit: ['return', target, ['+', ['ref', result], 1]],
                },
            })
            assertEq(lazy(selected), 7)
            assertEq(lazy(skipped), expected)
        }
    },
    conditionalValues: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const value = id(0)
        const signed = compile({
            target, parameters: [value], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['return', target, ['if', ['ref', value], { statements: [], exit: ['yield', [3]] }, { statements: [], exit: ['yield', [['ref', value]]] }]] },
        })
        assertEq(signed(-0), -0)
        const result = id(1)
        const allocation = compile({
            target, parameters: [], rest: null, self: null, captures: [],
            body: {
                statements: [
                    ['define', value, ['array', []], 'required'],
                    ['define', result, ['if', ['ref', value], { statements: [], exit: ['yield', [['ref', value]]] }, { statements: [], exit: ['yield', [3]] }], 'required'],
                ],
                exit: ['return', target, ['array', [['ref', value], ['ref', result]]]],
            },
        })()
        assertEq(allocation[0], allocation[1])
    },
    parallelState: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        const count = id(0)
        const a = id(1)
        const b = id(2)
        const result = id(3)
        const fn = compile({
            target, parameters: [], rest: null, self: null, captures: [],
            body: {
                statements: [['loop', {
                    target: loop, parameters: [count, a, b], initial: [0, 1, 2], results: [result],
                    body: {
                        statements: [['if', [], ['<', ['ref', count], 3],
                            { statements: [], exit: ['continue', loop, [['+', ['ref', count], 1], ['ref', b], ['+', ['ref', a], ['ref', b]]]] },
                            { statements: [], exit: ['break', loop, [['ref', a]]] },
                        ]],
                        exit: ['continue', loop, [['ref', count], ['ref', a], ['ref', b]]],
                    },
                }]],
                exit: ['return', target, ['ref', result]],
            },
        })
        assertEq(fn(), 5)
    },
    iterationCaptures: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const child = { kind: /** @type {const} */ ('function'), index: 1 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        const count = id(0)
        const accumulated = id(1)
        const captured = id(2)
        const result = id(3)
        const fn = compile({
            target, parameters: [], rest: null, self: null, captures: [],
            body: {
                statements: [['loop', {
                    target: loop, parameters: [count, accumulated], initial: [0, ['array', []]], results: [result],
                    body: {
                        statements: [['if', [], ['<', ['ref', count], 3],
                            { statements: [], exit: ['continue', loop, [['+', ['ref', count], 1], ['array', [
                                ['...', ['ref', accumulated]],
                                ['function', { target: child, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ['ref', count] }], body: { statements: [], exit: ['return', child, ['ref', captured]] } }],
                            ]]]] },
                            { statements: [], exit: ['break', loop, [['ref', accumulated]]] },
                        ]],
                        exit: ['continue', loop, [['ref', count], ['ref', accumulated]]],
                    },
                }]],
                exit: ['return', target, ['ref', result]],
            },
        })
        const functions = /** @type {readonly (() => number)[]} */ (fn())
        assertStructurallySame(functions.map(fn => fn()), [0, 1, 2])
    },
    lazyInvocationValues: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const parameter = id(0)
        const shared = id(1)
        const fn = compile({
            target, parameters: [parameter], rest: null, self: null, captures: [],
            body: {
                statements: [['define', shared, ['array', [['ref', parameter]]], 'lazy']],
                exit: ['return', target, ['array', [['ref', shared], ['ref', shared]]]],
            },
        })
        const first = fn(1)
        const second = fn(2)
        assertEq(first[0], first[1])
        assertEq(second[0], second[1])
        assertEq(first[0] === second[0], false)
        const lazyFailure = compile({
            target, parameters: [parameter], rest: null, self: null, captures: [],
            body: {
                statements: [['define', shared, ['block', { statements: [], exit: ['throw', 1] }], 'lazy']],
                exit: ['return', target, ['?:', ['ref', parameter], ['ref', shared], 0]],
            },
        })
        assertEq(lazyFailure(false), 0)
        throws(() => lazyFailure(true))
    },
}
