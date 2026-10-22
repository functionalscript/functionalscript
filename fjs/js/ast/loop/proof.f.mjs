/**
 * The canonical scalar form keeps its condition, continuing step and unchanged
 * normal result; presentation indices never substitute for target identities.
 *
 * @import { Block, Loop, Value } from '../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { scalarLoopOf } from './module.f.mjs'

const state = { index: 0 }
const result = { index: 1 }
const alias = { index: 2 }
const other = { index: 3 }
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
/** @type {Block} */
const done = { statements: [], exit: ['break', target, [['ref', state]]] }
/** @type {Block} */
const step = { statements: [], exit: ['continue', target, [1]] }
/** @type {Loop} */
const scalar = {
    target,
    parameters: [state],
    initial: [0],
    results: [result],
    body: { statements: [['if', [], true, step, done]], exit: ['continue', target, [['ref', state]]] },
}

/** @type {(step: Block, otherwise: Block) => Loop} */
const withArms = (step, otherwise) => ({ ...scalar, body: { ...scalar.body, statements: [['if', [], true, step, otherwise]] } })

export const proof = {
    shape: () => {
        assertStructurallySame(scalarLoopOf(scalar), { condition: true, step, next: 1 })
        const withDefinition = { ...step, statements: /** @type {Block['statements']} */ ([['define', alias, ['array', []], 'required']]) }
        assertStructurallySame(scalarLoopOf(withArms(withDefinition, done)), { condition: true, step: withDefinition, next: 1 })
        assertEq(scalarLoopOf({ ...scalar, parameters: [], initial: [] }), null)
        assertEq(scalarLoopOf({ ...scalar, results: [] }), null)
        assertEq(scalarLoopOf({ ...scalar, body: { statements: [], exit: ['break', target, [0]] } }), null)
        assertEq(scalarLoopOf({ ...scalar, body: { ...scalar.body, statements: [['define', alias, 1, 'required']] } }), null)
        assertEq(scalarLoopOf({ ...scalar, body: { ...scalar.body, statements: [['if', [alias], true, step, done]] } }), null)
    },
    transfers: () => {
        const another = /** @type {const} */ ({ kind: 'loop', index: target.index })
        assertEq(scalarLoopOf(withArms({ ...step, exit: ['yield', [1]] }, done)), null)
        assertEq(scalarLoopOf(withArms({ ...step, exit: ['continue', another, [1]] }, done)), null)
        assertEq(scalarLoopOf(withArms(step, { ...done, exit: ['yield', [1]] })), null)
        assertEq(scalarLoopOf(withArms(step, { ...done, exit: ['break', another, [1]] })), null)
        assertEq(scalarLoopOf(withArms(step, { ...done, statements: [['define', alias, 1, 'required']] })), null)
        assertEq(scalarLoopOf(withArms({ ...step, statements: [['block', [], { statements: [], exit: ['yield', []] }]] }, done)), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other]])) {
            assertEq(scalarLoopOf(withArms(step, { ...done, exit: ['break', target, [value]] })), null)
        }
    },
}
