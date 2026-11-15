/**
 * @import { BindingId, FunctionTarget, LoopTarget } from '../../types.ts'
 * @import { SourceBlock, SourceFunction, SourceValue } from '../source.ts'
 */

import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { writes } from './module.f.js'
import { empty as emptyMap, fromEntries, mapGet, mapHas, size } from '../../../../types/map/module.f.js'

export const proof = {
    emptyWritesKeepNodeIdentity: () => {
        for (const value of /** @type {readonly SourceValue[]} */ ([undefined, null, false, 0, '', 0n])) {
            assertEq(size(writes(value, emptyMap)), 0)
        }
        const id = /** @type {BindingId} */ ({ index: 0 })
        const reference = /** @type {const} */ (['ref', id])
        const indexed = writes(reference, emptyMap)
        assertEq(size(indexed), 1)
        assertStructurallySame(mapGet(indexed, reference), [])
        assertEq(mapHas(indexed, /** @type {const} */ (['ref', id])), false)
    },
    patternDefaultsContributeOnlyWhenTheirRegionRuns: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const selected = /** @type {SourceBlock} */ ({ statements: [['write', id, 1]], exit: ['yield', 2] })
        const fallback = /** @type {SourceValue} */ (['block', selected])
        const plan = /** @type {const} */ ({ reads: [{ source: null, spread: false }, { source: [0, 'a'], spread: false, default: { value: fallback } }], ids: [{ index: 1 }, { index: 2 }] })
        const root = /** @type {SourceBlock} */ ({ statements: [['initialize', plan, ['object', []]]], exit: ['yield', 0] })
        const indexed = writes(root, emptyMap)
        assertStructurallySame(mapGet(indexed, root), [id])
        assertStructurallySame(mapGet(indexed, fallback), [id])
        const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 0 })
        const held = /** @type {SourceValue} */ (['function', { target, length: 1, parameters: [{ plan, default: null }], rest: null, self: null, body: { statements: [], exit: ['yield', 0] } }])
        const behind = writes(held, emptyMap)
        assertStructurallySame(mapGet(behind, fallback), [id])
        assertStructurallySame(mapGet(behind, held), [])
    },
    forOfInputAndBodyContributeWrites: () => {
        const inputId = /** @type {BindingId} */ ({ index: 0 })
        const bodyId = /** @type {BindingId} */ ({ index: 1 })
        const item = /** @type {BindingId} */ ({ index: 2 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const input = /** @type {SourceBlock} */ ({ statements: [['write', inputId, 1]], exit: ['yield', ['array', [2]]] })
        const body = /** @type {SourceBlock} */ ({ statements: [['write', bodyId, ['ref', item]]], exit: ['yield', undefined] })
        const root = /** @type {SourceBlock} */ ({ statements: [['for-of', { target, events: [], source: ['block', input], item, body }]], exit: ['yield', undefined] })
        const indexed = writes(root, emptyMap)
        assertStructurallySame(mapGet(indexed, input), [inputId])
        assertStructurallySame(mapGet(indexed, body), [bodyId])
        assertEq(mapGet(indexed, root)?.includes(inputId), true)
        assertEq(mapGet(indexed, root)?.includes(bodyId), true)
    },
    forUpdatesContributeToNormalAndTerminalLoopEffects: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const body = /** @type {SourceBlock} */ ({ statements: [], exit: ['yield', undefined] })
        const step = /** @type {SourceBlock} */ ({ statements: [['compound-write', id, '+', 1]], exit: ['yield', undefined] })
        const loop = /** @type {const} */ ({ target, events: [], condition: true, body, step })
        for (const root of /** @type {readonly SourceBlock[]} */ ([
            { statements: [['while', loop]], exit: ['yield', undefined] },
            { statements: [], exit: ['terminal-loop', loop] },
        ])) {
            const indexed = writes(root, emptyMap)
            assertStructurallySame(mapGet(indexed, step), [id])
            assertStructurallySame(mapGet(indexed, root), [id])
        }
    },
    compoundTargetsAndOperandsContributeWrites: () => {
        const x = /** @type {BindingId} */ ({ index: 0 })
        const y = /** @type {BindingId} */ ({ index: 1 })
        const operand = /** @type {SourceBlock} */ ({ statements: [['compound-write', y, '+', 2]], exit: ['yield', 3] })
        const body = /** @type {SourceBlock} */ ({ statements: [['compound-write', x, '+', ['block', operand]]], exit: ['yield', 0] })
        const indexed = writes(body, emptyMap)
        assertStructurallySame(mapGet(indexed, operand), [y])
        assertStructurallySame(mapGet(indexed, body), [x, y])
    },
    distinctIdsKeepFirstWriteOrder: () => {
        const a = /** @type {BindingId} */ ({ index: 0 })
        const b = /** @type {BindingId} */ ({ index: 1 })
        const otherA = /** @type {BindingId} */ ({ index: 0 })
        const first = /** @type {SourceBlock} */ ({ statements: [['write', b, 1]], exit: ['yield', 0] })
        const second = /** @type {SourceBlock} */ ({ statements: [['write', otherA, 1]], exit: ['yield', 0] })
        const root = /** @type {SourceBlock} */ ({
            statements: [['write', a, ['block', first]], ['write', a, ['block', second]]],
            exit: ['yield', 0],
        })
        const found = mapGet(writes(root, emptyMap), root)
        // Local writes lead; child results retain the walk's reverse order.
        // Repeating a is one write, while an equal-looking identity is another.
        assertEq(found?.length, 3)
        assertEq(found?.[0], a)
        assertEq(found?.[1], otherA)
        assertEq(found?.[2], b)
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
        const indexed = writes(root, fromEntries([[target, [x, y]]]))
        assertStructurallySame(mapGet(indexed, held), [])
        assertStructurallySame(mapGet(indexed, call), [x, y])
        assertEq(mapGet(indexed, root)?.includes(x), true)
        assertEq(mapGet(indexed, root)?.includes(y), true)
        assertEq(mapGet(indexed, body)?.includes(x), true)
        assertEq(mapGet(indexed, body)?.includes(y), true)
        assertStructurallySame(mapGet(indexed, terminalIf), [x])
        assertStructurallySame(mapGet(indexed, terminalSwitch), [x])
    },
    ordinaryCallsDoNotExecuteHeldBodies: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const value = /** @type {SourceValue} */ (['()', ['ref', id], [0]])
        assertStructurallySame(mapGet(writes(value, emptyMap), value), [])
    },
    terminalBodiesAreIndexedBehindTheirInvocationBoundary: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        const target = /** @type {FunctionTarget} */ ({ kind: 'function', index: 0 })
        const loop = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const body = /** @type {SourceBlock} */ ({ statements: [['compound-write', id, '+', 1]], exit: ['yield', 0] })
        const terminal = /** @type {SourceBlock} */ ({ statements: [], exit: ['terminal-loop', { target: loop, events: [], condition: true, body }] })
        const held = /** @type {SourceValue} */ (['function', { target, length: 0, parameters: [], rest: null, self: null, body: terminal }])
        const call = /** @type {SourceValue} */ (['()', held, []])
        const indexed = writes(call, fromEntries([[target, [id]]]))
        assertStructurallySame(mapGet(indexed, body), [id])
        assertStructurallySame(mapGet(indexed, terminal), [id])
        assertStructurallySame(mapGet(indexed, held), [])
        assertStructurallySame(mapGet(indexed, call), [id])
    },
}
