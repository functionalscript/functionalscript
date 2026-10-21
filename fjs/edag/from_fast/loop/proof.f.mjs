/**
 * Root-loop reconstruction preserves the existing function boundary only for
 * the canonical invocation layout; aliases introduce no invocation setup.
 *
 * @import { Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { rootLoopOf, scalarHelper } from './module.f.mjs'

const parameter = { index: 0 }
const state = { index: 1 }
const result = { index: 2 }
const alias = { index: 3 }
const other = { index: 4 }
const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })

/** @type {Loop} */
const loop = {
    target: loopTarget,
    parameters: [state],
    initial: [['ref', parameter]],
    results: [result],
    body: { statements: [], exit: ['break', loopTarget, [['ref', state]]] },
}

/** @type {(body: Block) => FastFunction} */
const fn = body => ({ target, parameters: [parameter], rest: null, self: null, captures: [], body })

/** @type {(loop: Loop) => FastFunction} */
const root = loop => fn({ statements: [['loop', loop]], exit: ['return', target, ['ref', result]] })

export const proof = {
    helper: () => {
        const captured = { ...loop, body: { ...loop.body, statements: /** @type {Block['statements']} */ ([['define', alias, ['array', [['ref', other], ['ref', other]]], 'required']]) } }
        const helper = scalarHelper(captured)
        assertEq(helper.parameters[0], state)
        assertStructurallySame(helper.captures, [{ binding: other, value: ['ref', other] }])
        assertEq(helper.rest, null)
        assertEq(helper.self, null)
        assert(rootLoopOf(helper) !== null)
    },
    canonical: () => {
        assert(rootLoopOf(root(loop)) === loop)
        const aliased = { ...loop, initial: /** @type {readonly Value[]} */ ([['ref', other]]) }
        assert(rootLoopOf(fn({
            statements: [
                ['define', alias, ['ref', parameter], 'required'],
                ['define', other, ['ref', alias], 'lazy'],
                ['loop', aliased],
            ],
            exit: ['return', target, ['ref', result]],
        })) === aliased)
        // Captures and retained self stay on the existing function, unchanged.
        assert(rootLoopOf({ ...root(loop), self: other, captures: [{ binding: alias, value: 1 }] }) === loop)
    },
    invocationLayout: () => {
        assertEq(rootLoopOf({ ...root(loop), parameters: [] }), null)
        assertEq(rootLoopOf({ ...root(loop), rest: other }), null)
        const pair = {
            ...loop,
            parameters: [state, alias],
            initial: /** @type {readonly Value[]} */ ([['ref', parameter], 0]),
        }
        assertEq(rootLoopOf(root(pair)), null)
        assertEq(rootLoopOf(root({ ...loop, parameters: [], initial: [] })), null)
        assertEq(rootLoopOf(root({ ...loop, results: [result, other] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other], ['ref', { index: parameter.index }]])) {
            assertEq(rootLoopOf(root({ ...loop, initial: [value] })), null)
        }
    },
    resultProcessing: () => {
        assertEq(rootLoopOf(fn({ statements: [], exit: ['return', target, 0] })), null)
        assertEq(rootLoopOf(fn({ statements: [['define', result, 0, 'required']], exit: ['return', target, ['ref', result]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop], ['define', alias, ['+', ['ref', result], 1], 'required']], exit: ['return', target, ['ref', alias]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['yield', [['ref', result]]] })), null)
        assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['return', { kind: 'function', index: target.index }, ['ref', result]] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other]])) {
            assertEq(rootLoopOf(fn({ statements: [['loop', loop]], exit: ['return', target, value] })), null)
        }
    },
    oneTimeSetup: () => {
        const empty = /** @type {Block} */ ({ statements: [], exit: ['yield', []] })
        assertEq(rootLoopOf(fn({ statements: [['block', [], empty], ['loop', loop]], exit: ['return', target, ['ref', result]] })), null)
        for (const value of /** @type {readonly Value[]} */ ([0, ['array', []], ['ref', other]])) {
            assertEq(rootLoopOf(fn({ statements: [['define', alias, value, 'required'], ['loop', loop]], exit: ['return', target, ['ref', result]] })), null)
        }
    },
}
