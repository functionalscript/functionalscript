/** @import { Block, Definition, Loop, Value } from '../../types.ts' */

import { assert, assertEq } from '../../../../asserts/module.f.js'
import { run } from '../../task/module.f.js'
import { isTerminalLoop, terminalTree } from './module.f.js'

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
    explicitThrowsRetainTransitionsAndNormalCompletionRequirements: () => {
        /** @type {Block} */
        const failed = { statements: [], exit: ['throw', ['ref', shared]] }
        /** @type {Definition} */
        const required = ['define', shared, ['array', [['ref', state], ['ref', other]]], 'required']
        for (const body of [
            decision(failed, step, [required]),
            decision(step, failed, [required]),
            decision(decision(normal, failed), step, [required]),
            decision(step, decision(failed, normal), [required]),
            decision(decision(failed, step), decision(step, failed), [required]),
        ]) {
            const source = loop(body)
            assert(isTerminalLoop(source))
            assertEq(source.body, body)
            assertEq(source.body.statements[0], required)
        }
        /** @type {Block} */
        const empty = { statements: [], exit: ['continue', target, []] }
        for (const body of [
            decision(empty, decision(failed, normal), [required]),
            decision(decision(normal, failed), empty, [required]),
        ]) { assert(isTerminalLoop({ ...loop(body), parameters: [], initial: [] })) }
        for (const body of [
            empty,
            failed,
            decision(empty, failed, [required]),
            decision(failed, empty, [required]),
        ]) { assertEq(isTerminalLoop({ ...loop(body), parameters: [], initial: [] }), false) }
        assertEq(isTerminalLoop(loop(failed)), false)
        assertEq(isTerminalLoop(loop(decision(failed, normal))), false)
        assertEq(isTerminalLoop(loop(decision(failed, { ...step, exit: ['continue', target, []] }))), false)
        assertEq(isTerminalLoop(loop(decision(failed, { ...step, statements: [['define', shared, 0, 'lazy']] }))), false)
        assertEq(isTerminalLoop({ ...loop(decision(failed, step)), results: [] }), false)
    },
    continuingOnlyTreesKeepExactNonemptyInvocationVectors: () => {
        /** @type {Definition} */
        const required = ['define', shared, ['array', [['ref', state], ['ref', other]]], 'required']
        for (const body of [
            step,
            { ...step, statements: [required] },
            decision(step, step, [required]),
            decision(decision(step, step), step, [required]),
            decision(step, decision(step, step), [required]),
        ]) {
            const source = loop(body)
            assert(isTerminalLoop(source))
            assertEq(source.body, body)
        }
        /** @type {Block} */
        const scalar = { statements: [], exit: ['continue', target, [['ref', state]]] }
        assert(isTerminalLoop({ ...loop(scalar), parameters: [state], initial: [0] }))
        /** @type {Block} */
        const empty = { statements: [], exit: ['continue', target, []] }
        for (const body of [empty, decision(empty, empty, [required])]) {
            assertEq(isTerminalLoop({ ...loop(body), parameters: [], initial: [] }), false)
        }
        assertEq(isTerminalLoop(loop({ ...step, statements: [['define', shared, 0, 'lazy']] })), false)
        assertEq(isTerminalLoop(loop({ ...step, exit: ['continue', target, [['ref', state]]] })), false)
    },
    emptyInputTerminalTreesKeepExactEmptyContinuations: () => {
        /** @type {Block} */
        const continued = { statements: [], exit: ['continue', target, []] }
        /** @type {Block} */
        const completed = { statements: [], exit: ['break', target, [['ref', shared]]] }
        /** @type {Definition} */
        const required = ['define', shared, ['array', [false]], 'required']
        for (const body of [
            decision(continued, completed, [required]),
            decision(completed, continued, [required]),
            decision(decision(completed, continued), completed, [required]),
            decision(completed, decision(continued, completed), [required]),
        ]) {
            /** @type {Loop} */
            const source = { ...loop(body), parameters: [], initial: [] }
            assert(isTerminalLoop(source))
            assertEq(source.body, body)
            assert(continued.exit[0] === 'continue')
            assertEq(continued.exit[2].length, 0)
        }
        assertEq(isTerminalLoop({ ...loop(continued), parameters: [], initial: [] }), false)
        assertEq(isTerminalLoop({ ...loop(completed), parameters: [], initial: [] }), false)
        assertEq(isTerminalLoop({ ...loop(decision(step, completed)), parameters: [], initial: [] }), false)
    },
    sharedRequiredPrefixesRetainOneTerminalTreeOwner: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        for (const value of /** @type {readonly Value[]} */ ([
            ['array', [['ref', state], ['ref', other]]],
            ['object', [[':', 'state', ['ref', state]], [':', 'other', ['ref', other]]]],
            ['function', { target: owner, parameters: [], rest: null, self: null,
                captures: [{ binding: result, value: ['ref', state] }],
                body: { statements: [], exit: ['return', owner, ['ref', result]] } }],
            ['()', ['ref', state], [['ref', other]]],
            ['.', ['ref', state], 'next'],
        ])) {
            /** @type {Definition} */
            const required = ['define', shared, value, 'required']
            /** @type {Block} */
            const continuation = { statements: [], exit: ['continue', target, [['ref', shared], ['ref', other]]] }
            /** @type {Block} */
            const completed = { statements: [], exit: ['break', target, [['ref', shared]]] }
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const body = /** @type {Block} */ ({ statements: [required,
                    ['if', [], ['.', ['ref', shared], 0], baseFirst ? completed : continuation, baseFirst ? continuation : completed]],
                    exit: ['yield', []] })
                const source = loop(body)
                assert(isTerminalLoop(source))
                assertEq(source.body, body)
                assertEq(source.body.statements[0], required)
                assertEq(required[2], value)
            }
        }
    },
    terminalTreesPreserveExactTargetsAndTransferWidths: () => {
        /** @type {Definition} */
        const required = ['define', shared, ['array', [['ref', state], ['ref', other]]], 'required']
        const mixed = decision(step, normal, [required])
        for (const body of [
            decision(mixed, normal), decision(normal, mixed),
            decision(decision(normal, step), step), decision(step, decision(normal, step)),
            decision(mixed, mixed, [required]),
        ]) { assert(isTerminalLoop(loop(body))) }
        const scalarStep = /** @type {Block} */ ({ statements: [], exit: ['continue', target, [['ref', state]]] })
        assert(isTerminalLoop({ ...loop(decision(decision(scalarStep, normal), normal)), parameters: [state], initial: [0] }))
        assert(isTerminalLoop(loop(step)))
        assertEq(isTerminalLoop(loop(normal)), false)
        assert(isTerminalLoop(loop(decision(step, normal))))
        assert(isTerminalLoop(loop(decision(decision(step, step), normal))))
        assert(isTerminalLoop(loop(decision(step, decision(normal, normal)))))
        for (const refused of /** @type {readonly Loop[]} */ ([
            { ...loop(decision(mixed, normal)), parameters: [], initial: [] },
            { ...loop(decision(mixed, normal)), results: [] },
            { ...loop(decision(mixed, normal)), results: [result, shared] },
        ])) { assertEq(isTerminalLoop(refused), false) }
    },
    otherLeavesAndStructuredPrefixesRetainTheirAdmission: () => {
        /** @type {Definition} */
        const required = ['define', shared, 0, 'required']
        for (const rejected of /** @type {readonly Block[]} */ ([
            { statements: [], exit: ['yield', []] },
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
            assertEq(isTerminalLoop(loop(decision(decision(rejected, normal), step))), false)
            assertEq(isTerminalLoop(loop(decision(decision(step, rejected), normal))), false)
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
        for (let depth = 0; depth < 20_000; depth += 1) { body = decision(body, normal) }
        assert(isTerminalLoop(loop(body)))
    },
}
