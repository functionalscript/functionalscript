/**
 * @import { BindingId, FunctionTarget, LoopTarget } from '../../types.ts'
 * @import { SourceBlock, SourceFunction, SourceValue } from '../source.ts'
 */

import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { writes } from './module.f.mjs'

export const proof = {
    forUpdatesContributeToNormalAndTerminalLoopEffects: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const body = /** @type {SourceBlock} */ ({ statements: [], exit: ['yield', undefined] })
        const step = /** @type {SourceBlock} */ ({ statements: [['compound-write', id, '+', 1]], exit: ['yield', undefined] })
        const loop = { target, events: [], condition: true, body, step }
        for (const root of /** @type {readonly SourceBlock[]} */ ([
            { statements: [['while', loop]], exit: ['yield', undefined] },
            { statements: [], exit: ['terminal-loop', loop] },
        ])) {
            const indexed = writes(root, new Map())
            assertStructurallySame(indexed.get(step), [id])
            assertStructurallySame(indexed.get(root), [id])
        }
    },
    compoundTargetsAndOperandsContributeWrites: () => {
        const x = /** @type {BindingId} */ ({ index: 0 })
        const y = /** @type {BindingId} */ ({ index: 1 })
        const operand = /** @type {SourceBlock} */ ({ statements: [['compound-write', y, '+', 2]], exit: ['yield', 3] })
        const body = /** @type {SourceBlock} */ ({ statements: [['compound-write', x, '+', ['block', operand]]], exit: ['yield', 0] })
        const indexed = writes(body, new Map())
        assertStructurallySame(indexed.get(operand), [y])
        assertStructurallySame(indexed.get(body), [x, y])
    },
    regionsAndInvocationBoundaries: () => {
        const x = /** @type {BindingId} */ ({ index: 0 })
        const y = /** @type {BindingId} */ ({ index: 1 })
        const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 0 })
        const loop = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const empty = /** @type {SourceBlock} */ ({ statements: [], exit: ['yield', 0] })
        const assigned = /** @type {SourceBlock} */ ({ statements: [['write', x, 1]], exit: ['return', target, ['ref', x]] })
        const terminalIf = /** @type {SourceBlock} */ ({ statements: [], exit: ['if', true, assigned, empty] })
        const terminalSwitch = /** @type {SourceBlock} */ ({ statements: [], exit: ['switch', 0, [{ labels: [0], body: assigned }], empty] })
        const body = /** @type {SourceBlock} */ ({ statements: [
            ['initialize', { reads: [], ids: [] }, ['+', 1, 2]],
            ['write', y, 2], ['if', true, terminalIf, terminalSwitch],
            ['while', { target: loop, events: [], condition: false, body: assigned }],
            ['switch', { target: loop, events: [], discriminant: 0, cases: [{ labels: [1], body: assigned }], otherwise: empty }],
            ['break', loop], ['continue', loop], ['return', target, 0], ['throw', 7],
        ], exit: ['throw', null] })
        const fn = /** @type {SourceFunction} */ ({ target, length: 0, rest: null, self: null, body, parameters: [
            { plan: { reads: [], ids: [] }, default: null },
            { plan: { reads: [], ids: [] }, default: { value: ['block', assigned] } },
        ] })
        const held = /** @type {SourceValue} */ (['function', fn])
        const call = /** @type {SourceValue} */ (['()', held, []])
        const root = /** @type {SourceValue} */ (['array', [held, call]])
        const indexed = writes(root, new Map([[target, [x, y]]]))
        assertStructurallySame(indexed.get(held), [])
        assertStructurallySame(indexed.get(call), [x, y])
        assertEq(indexed.get(root)?.includes(x), true)
        assertEq(indexed.get(root)?.includes(y), true)
        assertEq(indexed.get(body)?.includes(x), true)
        assertEq(indexed.get(body)?.includes(y), true)
        assertStructurallySame(indexed.get(terminalIf), [x])
        assertStructurallySame(indexed.get(terminalSwitch), [x])
    },
    ordinaryCallsDoNotExecuteHeldBodies: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const value = /** @type {SourceValue} */ (['()', ['ref', id], [0]])
        assertStructurallySame(writes(value, new Map()).get(value), [])
    },
    terminalBodiesAreIndexedBehindTheirInvocationBoundary: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 0 })
        const loop = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const body = /** @type {SourceBlock} */ ({ statements: [['compound-write', id, '+', 1]], exit: ['yield', 0] })
        const terminal = /** @type {SourceBlock} */ ({ statements: [], exit: ['terminal-loop', { target: loop, events: [], condition: true, body }] })
        const held = /** @type {SourceValue} */ (['function', { target, length: 0, parameters: [], rest: null, self: null, body: terminal }])
        const call = /** @type {SourceValue} */ (['()', held, []])
        const indexed = writes(call, new Map([[target, [id]]]))
        assertStructurallySame(indexed.get(body), [id])
        assertStructurallySame(indexed.get(terminal), [id])
        assertStructurallySame(indexed.get(held), [])
        assertStructurallySame(indexed.get(call), [id])
    },
}
