/** @import { Block, Definition, Loop, Value } from '../../types.ts' */

import { assert, assertEq } from '../../../../asserts/module.f.js'
import { run } from '../../task/module.f.mjs'
import { isMixedLoop, terminalTree } from './module.f.mjs'

const state = /** @type {const} */ ({ index: 0 })
const other = /** @type {const} */ ({ index: 1 })
const result = /** @type {const} */ ({ index: 2 })
const shared = /** @type {const} */ ({ index: 3 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
/** @type {Block} */
const normal = { statements: [], exit: ['break', target, [['ref', state]]] }
/** @type {Block} */
const step = { statements: [], exit: ['continue', target, [['ref', other], ['ref', state]]] }
/** @type {(then: Block, otherwise: Block, statements?: readonly Definition[]) => Block} */
const decision = (then, otherwise, statements = []) => ({ statements: [...statements, ['if', [], true, then, otherwise]], exit: ['yield', []] })
/** @type {(body: Block) => Loop} */
const loop = body => ({ target, parameters: [state, other], initial: [0, 1], results: [result], body })

export const proof = {
    mixedTreesPreserveExactTargetsAndRequireNestedMixedDecisions: () => {
        /** @type {Definition} */
        const required = ['define', shared, ['array', [['ref', state], ['ref', other]]], 'required']
        const mixed = decision(step, normal, [required])
        for (const body of [
            decision(mixed, normal), decision(normal, mixed),
            decision(decision(normal, step), step), decision(step, decision(normal, step)),
            decision(mixed, mixed, [required]),
        ]) { assert(isMixedLoop(loop(body))) }
        const scalarStep = /** @type {Block} */ ({ statements: [], exit: ['continue', target, [['ref', state]]] })
        assert(isMixedLoop({ ...loop(decision(decision(scalarStep, normal), normal)), parameters: [state], initial: [0] }))
        assertEq(isMixedLoop(loop(step)), false)
        assertEq(isMixedLoop(loop(normal)), false)
        assertEq(isMixedLoop(loop(decision(step, normal))), false)
        assertEq(isMixedLoop(loop(decision(decision(step, step), normal))), false)
        assertEq(isMixedLoop(loop(decision(step, decision(normal, normal)))), false)
        for (const refused of /** @type {readonly Loop[]} */ ([
            { ...loop(decision(mixed, normal)), parameters: [], initial: [] },
            { ...loop(decision(mixed, normal)), results: [] },
            { ...loop(decision(mixed, normal)), results: [result, shared] },
        ])) { assertEq(isMixedLoop(refused), false) }
    },
    otherLeavesAndStructuredPrefixesRetainTheirAdmission: () => {
        /** @type {Definition} */
        const required = ['define', shared, 0, 'required']
        for (const rejected of /** @type {readonly Block[]} */ ([
            { statements: [], exit: ['yield', []] },
            { statements: [], exit: ['throw', 0] },
            { statements: [], exit: ['return', { kind: 'function', index: 0 }, 0] },
            { ...normal, exit: ['break', { kind: 'loop', index: 0 }, [0]] },
            { ...normal, exit: ['break', target, []] },
            { ...normal, exit: ['break', target, [0, 1]] },
            { ...step, exit: ['continue', { kind: 'loop', index: 0 }, [0, 1]] },
            { ...step, exit: ['continue', target, [0]] },
            { ...step, statements: [['define', shared, 0, 'lazy']] },
            { ...step, statements: [['block', [], { statements: [], exit: ['yield', []] }]] },
            { ...decision(step, normal), statements: [['if', [shared], true, step, normal]] },
            { ...decision(step, normal), exit: ['continue', target, [0, 1]] },
            { ...decision(step, normal), exit: ['yield', [0]] },
            { ...decision(step, normal), statements: [required, ['if', [], true, step, normal], required] },
        ])) {
            assertEq(isMixedLoop(loop(decision(decision(rejected, normal), step))), false)
            assertEq(isMixedLoop(loop(decision(decision(step, rejected), normal))), false)
        }
    },
    sharedFoldRetainsRequiredPrefixAndTestIdentities: () => {
        /** @type {Definition} */
        const required = ['define', shared, ['array', []], 'required']
        /** @type {Value} */
        const test = ['ref', state]
        const block = decision(step, normal, [required])
        const source = /** @type {Block} */ ({ ...block, statements: [required, ['if', [], test, step, normal]] })
        const folded = run(terminalTree(source, block => block, (prefix, selected, then, otherwise) => {
            assertEq(prefix[0], required)
            assertEq(selected, test)
            assertEq(then, step)
            assertEq(otherwise, normal)
            return then
        }))
        assertEq(folded, step)
    },
    deeplyNestedMixedTreesUseTheTaskStack: () => {
        let body = decision(step, normal)
        for (let depth = 0; depth < 20_000; ++depth) { body = decision(body, normal) }
        assert(isMixedLoop(loop(body)))
    },
}
