/**
 * Execute the common prepared plan through the JavaScript output boundary.
 * Host compilation observes nonlocal return behavior, closure lifetimes and
 * simultaneous state changes, which inspecting the IR alone cannot establish.
 *
 * @import { BindingId, Function as FastFunction, Value as FastValue } from '../types.ts'
 */

import { throws } from 'node:assert/strict'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { prepareFunction } from './module.f.mjs'
import { functionStringify } from '../serializer/module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(fn: FastFunction) => (...args: readonly unknown[]) => any} */
const compile = fn => Function(`"use strict";return (${functionStringify(prepareFunction(fn))});`)()

export const proof = {
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
