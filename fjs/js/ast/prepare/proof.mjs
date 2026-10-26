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
    objectSpreadReturnOperands: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const child = /** @type {const} */ ({ kind: 'function', index: 0 })
        const selected = id(100), result = id(101), payload = id(102), capture = id(103)
        /** @type {(value?: FastValue) => FastValue} */
        const escape = (value = 7) => ['block', { statements: [], exit: ['return', target, value] }]
        /** @type {(normal: FastValue) => FastValue} */
        const choice = normal => ['if', ['ref', selected], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', [normal]] }]
        /** @type {(value: FastValue) => FastFunction} */
        const sourceFunction = value => ({ target, parameters: [selected, payload], rest: null, self: null, captures: [],
            body: { statements: [['define', result, value, 'required']], exit: ['return', target, ['ref', result]] } })
        /** @type {(value: FastValue) => (...args: readonly unknown[]) => any} */
        const standalone = value => {
            const source = sourceFunction(value)
            return Function(`"use strict";return (${functionStringify({ ...source, captures: [], body: prepare(source.body) })});`)()
        }
        /** @type {FastValue} */
        const failingKey = ['object', [[':', 'toString', ['function', { target: child, parameters: [], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['throw', 'key'] } }]]]]
        /** @type {FastValue} */
        const captureReturn = ['function', { target: child, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: escape() }], body: { statements: [], exit: ['return', child, ['ref', capture]] } }]
        /** @type {readonly ((value: FastValue) => (...args: readonly unknown[]) => any)[]} */
        const renders = [value => compile(sourceFunction(value)), standalone]
        for (const render of renders) {
            for (const value of /** @type {readonly FastValue[]} */ ([null, undefined, 0, false, 0n, '', ['entry']])) {
                const fn = render(['object', [['...', value], [':', 'x', choice(5)]]])
                assertEq(fn(true), 7)
                assertStructurallySame(fn(false), { x: 5 })
            }
            const contributed = render(['object', [['...', choice(['object', [[':', 'x', 1]]])], [':', 'y', 2]]])
            assertEq(contributed(true), 7)
            assertStructurallySame(contributed(false), { x: 1, y: 2 })
            const unicode = render(['object', [['...', 'A😀\ud800B'], [':', 'x', choice(5)]]])
            assertEq(unicode(true), 7)
            assertStructurallySame(unicode(false), { 0: 'A', 1: '\ud83d', 2: '\ude00', 3: '\ud800', 4: 'B', x: 5 })
            const mixed = render(['object', [
                [':', 'a', 1], ['...', ['object', [[':', 'b', 2], [':', 'a', 3]]]],
                [':', 'a', 4], ['...', ['array', ['u', 'v']]], [':', '__proto__', ['ref', payload]],
                [':', '2', 'two'], ['...', 'x'], [':', 'z', choice(9)],
            ]])
            assertEq(mixed(true, {}), 7)
            const data = /** @type {const} */ ({ held: [] })
            const object = mixed(false, data)
            assertStructurallySame(Object.keys(object), ['0', '1', '2', 'a', 'b', '__proto__', 'z'])
            assertStructurallySame([object[0], object[1], object[2], object.a, object.b, object.z], ['x', 'v', 'two', 4, 2, 9])
            assertEq(Object.getOwnPropertyDescriptor(object, '__proto__')?.value, data)
            assertEq(Object.getPrototypeOf(object), Object.prototype)
            const shared = render(['object', [['...', ['ref', payload]], [':', 'z', choice(9)]]])(false, data)
            assertEq(shared.held, data.held)
            assertEq(shared === data, false)
            assertEq(render(['object', [[':', 'before', 1], ['...', escape(['ref', payload])], [':', failingKey, 0]]])(false, data), data)
            assertEq(render(['object', [['...', null], [':', escape(['ref', payload]), failingKey]]])(false, data), data)
            throws(() => render(['object', [['...', null], [':', failingKey, escape()]]])(), value => value === 'key')
            throws(() => render(['object', [[':', failingKey, 1], ['...', escape()]]])(), value => value === 'key')
            throws(() => render(['object', [['...', null], [':', 'x', ['block', { statements: [], exit: ['throw', 'value'] }]], ['...', escape()]]])(), value => value === 'value')
            assertEq(render(['object', [['...', null], [':', 'f', captureReturn]]])(), 7)
        }
        /** @type {(value: FastValue) => (...args: readonly unknown[]) => any} */
        const native = value => compile(sourceFunction(value))
        assertEq(native(['.', ['object', []], 'x', ['|()', [['object', [['...', escape()]]]]]])(), 7)
        throws(() => native(['.', null, 'x', ['|()', [['object', [['...', escape()]]]]]])(), TypeError)
        assertEq(native(['?.', null, 'x', ['|()', [['object', [['...', escape()]]]]]])(), undefined)
        assertEq(native(['?.', null, 'x', ['|!()', [['object', [['...', escape()]]]]]])(), 7)
        // Object construction with no lifted prelude retains its ordinary
        // source-key conversion and own-property copy semantics.
        assertStructurallySame(compile(sourceFunction(['object', [['...', 'ab'], [':', 'x', 3]]]))(), { 0: 'a', 1: 'b', x: 3 })
    },
    objectSpreadLoopTransfers: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const loop = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const child = /** @type {const} */ ({ kind: 'function', index: 0 })
        const value = id(0), result = id(1)
        /** @type {FastValue} */
        const leave = ['block', { statements: [], exit: ['break', loop, [9]] }]
        /** @type {FastValue} */
        const failingKey = ['object', [[':', 'toString', ['function', { target: child, parameters: [], rest: null, self: null, captures: [],
            body: { statements: [], exit: ['throw', 'key'] } }]]]]
        /** @type {(expression: FastValue) => FastFunction} */
        const fn = expression => ({ target, parameters: [], rest: null, self: null, captures: [], body: {
            statements: [['loop', { target: loop, parameters: [], initial: [], results: [result], body: {
                statements: [['define', value, expression, 'required']], exit: ['break', loop, [['ref', value]]],
            } }]], exit: ['return', target, ['ref', result]],
        } })
        /** @type {(source: FastFunction) => (...args: readonly unknown[]) => any} */
        const standalone = source => Function(`"use strict";return (${functionStringify({ ...source, captures: [], body: prepare(source.body) })});`)()
        for (const render of [compile, standalone]) {
            assertEq(render(fn(['object', [['...', null], [':', 'x', leave]]]))(), 9)
            assertEq(render(fn(['object', [['...', leave], [':', failingKey, 0]]]))(), 9)
            throws(() => render(fn(['object', [['...', null], [':', failingKey, leave]]]))(), value => value === 'key')
        }
    },
    spreadReturnOperands: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const selected = id(100), result = id(101), rest = id(102)
        /** @type {(value?: FastValue) => FastValue} */
        const escape = (value = 7) => ['block', { statements: [], exit: ['return', target, value] }]
        /** @type {(normal: FastValue) => FastValue} */
        const choice = normal => ['if', ['ref', selected], { statements: [], exit: ['return', target, 7] }, { statements: [], exit: ['yield', [normal]] }]
        /** @type {(value: FastValue) => FastFunction} */
        const sourceFunction = value => ({ target, parameters: [selected], rest: null, self: null, captures: [],
            body: { statements: [['define', result, value, 'required']], exit: ['return', target, ['ref', result]] } })
        /** @type {(value: FastValue) => (...args: readonly unknown[]) => any} */
        const valueFunction = value => compile(sourceFunction(value))
        /** @type {(value: FastValue) => (...args: readonly unknown[]) => any} */
        const standalone = value => {
            const source = sourceFunction(value)
            return Function(`"use strict";return (${functionStringify({ ...source, captures: [], body: prepare(source.body) })});`)()
        }
        const child = { kind: /** @type {const} */ ('function'), index: 0 }
        const collect = /** @type {FastValue} */ (['function', { target: child, parameters: [], rest, self: null, captures: [],
            body: { statements: [], exit: ['return', child, ['ref', rest]] } }])
        for (const value of /** @type {readonly FastValue[]} */ ([0, null, undefined, ['object', []]])) {
            throws(() => valueFunction(['array', [['...', value], escape()]])(), TypeError)
            throws(() => valueFunction(['()', collect, [['...', value], escape()]])(), TypeError)
        }
        assertEq(valueFunction(['array', [escape(), ['...', 0]]])(), 7)
        assertEq(valueFunction(['array', [['...', ['array', []]], escape()]])(), 7)
        const expanded = valueFunction(['array', [['...', choice('A😀B')], 5]])
        assertEq(expanded(true), 7)
        assertStructurallySame(expanded(false), ['A', '😀', 'B', 5])
        const collected = valueFunction(['()', collect, [['...', 'A😀B'], choice(5)]])
        assertEq(collected(true), 7)
        assertStructurallySame(collected(false), ['A', '😀', 'B', 5])
        assertEq(valueFunction(['()', 0, [['...', ['array', []]], escape()]])(), 7)
        throws(() => valueFunction(['()', 0, [['...', 0], escape()]])(), TypeError)
        assertEq(valueFunction(['()', ['block', { statements: [], exit: ['return', target, 7] }], [['...', ['array', []]]]])(), 7)
        assertEq(valueFunction(['()', escape(), [['...', 0]]])(), 7)
        const callee = valueFunction(['()', choice(collect), [['...', ['array', [1, 2]]]]])
        assertEq(callee(true), 7)
        assertStructurallySame(callee(false), [1, 2])
        assertEq(valueFunction(['()', ['Number.isInteger'], [['...', ['array', []]], escape()]])(), 7)
        const captured = id(104)
        const captureReturn = /** @type {FastValue} */ (['function', { target: child, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: escape() }], body: { statements: [], exit: ['return', child, ['ref', captured]] } }])
        for (const render of [valueFunction, standalone]) {
            throws(() => render(['array', [['...', 0], escape()]])(), TypeError)
            throws(() => render(['()', collect, [['...', 0], escape()]])(), TypeError)
            assertEq(render(['array', [['...', ['array', []]], escape()]])(), 7)
            assertEq(render(['()', collect, [['...', ['array', []]], escape()]])(), 7)
            assertEq(render(['array', [['...', escape()], 0]])(), 7)
            for (const control of /** @type {readonly FastValue[]} */ ([['object', [['...', escape()]]], captureReturn])) {
                assertEq(render(['()', collect, [['...', ['array', []]], control]])(), 7)
                throws(() => render(['()', collect, [['...', 0], control]])(), TypeError)
            }
        }
        const native = valueFunction(['.', 'abc', 'slice', ['|()', [['...', ['array', [1]]], choice(2)]]])
        assertEq(native(true), 7)
        assertEq(native(false), 'b')
        const direct = valueFunction(['()', ['.', 'abc', 'slice'], [['...', ['array', [1]]], choice(2)]])
        assertEq(direct(true), 7)
        assertEq(direct(false), 'b')
        throws(() => valueFunction(['.', null, 'x', ['|()', [['...', ['array', []]], escape()]]])(), TypeError)
        assertEq(valueFunction(['.', ['object', []], 'x', ['|()', [['...', ['array', []]], escape()]]])(), 7)
        assertEq(valueFunction(['?.', null, 'x', ['|()', [['...', 0], escape()]]])(), undefined)
        assertEq(valueFunction(['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [['...', 0], escape()]]])(), undefined)
        assertEq(valueFunction(['?.()', undefined, [['...', 0], escape()]])(), undefined)
        assertEq(valueFunction(['?.', null, 'x', ['|!()', [['...', ['array', []]], escape()]]])(), 7)
        throws(() => valueFunction(['?.', null, 'x', ['|!()', [['...', 0], escape()]]])(), TypeError)
        const payload = /** @type {readonly unknown[]} */ ([])
        assertEq(valueFunction(['array', [['...', ['array', [1]]], escape(['ref', selected])]])(payload), payload)
        const memo = id(103)
        const remembered = compile({ target, parameters: [selected], rest: null, self: null, captures: [],
            body: { statements: [
                ['define', memo, ['array', [1, 2]], 'lazy'],
                ['define', result, ['array', [['...', ['ref', memo]], choice(3)]], 'required'],
            ], exit: ['return', target, ['ref', result]] } })
        assertEq(remembered(true), 7)
        assertStructurallySame(remembered(false), [1, 2, 3])
    },
    spreadLoopTransfers: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        const value = id(0), result = id(1), rest = id(2)
        const child = { kind: /** @type {const} */ ('function'), index: 0 }
        const collect = /** @type {FastValue} */ (['function', { target: child, parameters: [], rest, self: null, captures: [],
            body: { statements: [], exit: ['return', child, ['ref', rest]] } }])
        const leave = /** @type {FastValue} */ (['block', { statements: [], exit: ['break', loop, [9]] }])
        /** @type {(expression: FastValue) => FastFunction} */
        const fn = expression => ({ target, parameters: [], rest: null, self: null, captures: [], body: {
            statements: [['loop', { target: loop, parameters: [], initial: [], results: [result], body: {
                statements: [['define', value, expression, 'required']], exit: ['break', loop, [['ref', value]]],
            } }]], exit: ['return', target, ['ref', result]],
        } })
        /** @type {(source: FastFunction) => (...args: readonly unknown[]) => any} */
        const standalone = source => Function(`"use strict";return (${functionStringify({ ...source, captures: [], body: prepare(source.body) })});`)()
        for (const render of [compile, standalone]) {
            throws(() => render(fn(['array', [['...', 0], leave]]))(), TypeError)
            throws(() => render(fn(['()', collect, [['...', 0], leave]]))(), TypeError)
            assertEq(render(fn(['array', [['...', ['array', []]], leave]]))(), 9)
            assertEq(render(fn(['()', collect, [['...', ['array', []]], leave]]))(), 9)
            assertEq(render(fn(['array', [['...', leave], 0]]))(), 9)
        }
    },
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
