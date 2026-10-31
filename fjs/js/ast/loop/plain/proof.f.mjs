/**
 * Plain source-loop planning keeps condition-only work in its reached test and
 * duplicates only identity-free projection dependencies in other regions.
 *
 * @import { BindingId, Block, Definition, Loop, Value } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { branchingPlainLoopOf, continueFirstPlainLoopOf, plainLoopOf, resultBlockPlainLoopOf } from './module.f.mjs'

const state = /** @type {const} */ ({ index: 0 })
const result = /** @type {const} */ ({ index: 1 })
const alias = /** @type {const} */ ({ index: 2 })
const other = /** @type {const} */ ({ index: 3 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
/** @type {Block} */
const done = { statements: [], exit: ['break', target, [['ref', state]]] }
/** @type {Block} */
const step = { statements: [], exit: ['continue', target, [1]] }
/** @type {Loop} */
const scalar = {
    target,
    parameters: [state], initial: [0], results: [result],
    body: { statements: [['if', [], true, step, done]], exit: ['continue', target, [['ref', state]]] },
}
/** @type {(step: Block, otherwise: Block) => Loop} */
const withArms = (step, otherwise) => ({ ...scalar, body: { ...scalar.body, statements: [['if', [], true, step, otherwise]] } })

export const proof = /** @type {const} */ ({
    branchingTransitionsYieldOneSelectedVectorBeforeStateChanges: () => {
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', state], 0], 'required']
        const shared = /** @type {const} */ ({ index: 4 })
        /** @type {Definition} */
        const reached = ['define', shared, ['array', [['ref', alias]]], 'required']
        for (const width of /** @type {const} */ ([0, 1, 2])) {
            const parameters = [state, other].slice(0, width)
            const values = /** @type {readonly Value[]} */ ([['ref', other], ['ref', state]]).slice(0, width)
            /** @type {Block} */
            const leaf = { statements: [reached], exit: ['continue', target, values] }
            /** @type {Block} */
            const decision = { statements: [['if', [], ['ref', alias], leaf, leaf]], exit: ['yield', []] }
            /** @type {Block} */
            const normal = { statements: [], exit: ['break', target, [7]] }
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                /** @type {Loop} */
                const source = { ...scalar, parameters, initial: parameters.map(() => 0), body: {
                    statements: [projected, ['if', [], true, baseFirst ? normal : decision, baseFirst ? decision : normal]],
                    exit: ['yield', []],
                } }
                assertEq(plainLoopOf(source), null)
                const plan = branchingPlainLoopOf(source)
                assert(plan !== null)
                assertEq(plan.prefix[0], projected)
                assertEq(plan.iteration.step.statements.length, 0)
                assertEq(plan.iteration.step.exit, decision.exit)
                assertStructurallySame(plan.iteration.condition, baseFirst ? ['!', true] : true)
                assertEq(plan.result, 7)
                assertStructurallySame(plan.resultPrefix, [])
                const next = plan.iteration.next
                assert(next instanceof Array && next[0] === 'block')
                assertEq(next[1].statements[0], projected)
                const exit = next[1].exit
                assert(exit[0] === 'yield')
                const selected = exit[1][0]
                assert(selected instanceof Array && selected[0] === 'if')
                assertStructurallySame(selected[1], ['ref', alias])
                for (const arm of [selected[2], selected[3]]) {
                    assertEq(arm.statements[0], reached)
                    assertStructurallySame(arm.exit, ['yield', [width > 1 ? ['array', values] : values[0]]])
                }
                assertEq(plainLoopOf(source), null)
            }
        }
        /** @type {Block} */
        const selected = { statements: [['if', [], true, step, step]], exit: ['yield', []] }
        const normal = /** @type {Block} */ ({ statements: [reached], exit: ['break', target, [['ref', shared]]] })
        const plan = branchingPlainLoopOf(withArms(selected, normal))
        assert(plan !== null)
        assertStructurallySame(plan.result, ['block', { statements: normal.statements, exit: ['yield', [['ref', shared]]] }])
        for (const refused of /** @type {readonly Loop[]} */ ([
            { ...scalar, results: [] },
            { ...scalar, body: { statements: [], exit: ['yield', []] } },
            { ...scalar, body: { statements: [projected], exit: ['yield', []] } },
            { ...scalar, body: { statements: [['if', [shared], true, selected, done]], exit: ['yield', []] } },
            { ...scalar, body: { statements: [['block', [], done], ['if', [], true, selected, done]], exit: ['yield', []] } },
            withArms(selected, step),
            withArms(step, done),
            withArms({ statements: [reached], exit: step.exit }, done),
            withArms({ ...selected, statements: [['if', [], true, step, done]] }, done),
            withArms({ ...selected, statements: [['if', [], true, step, { ...step, exit: ['continue', target, []] }]] }, done),
            { ...withArms(selected, done), body: { statements: [
                ['define', alias, ['array', []], 'required'],
                ['if', [], true, { ...selected, statements: [['if', [], ['ref', alias], step, step]] }, done],
            ], exit: ['yield', []] } },
        ])) { assertEq(branchingPlainLoopOf(refused), null) }
    },
    branchingTransitionsUseTheTaskStack: () => {
        /** @type {Block} */
        let selected = step
        for (let depth = 0; depth < 20_000; depth += 1) {
            selected = { statements: [['if', [], true, selected, step]], exit: ['yield', []] }
        }
        const plan = branchingPlainLoopOf(withArms(selected, done))
        assert(plan !== null)
        let value = plan.iteration.next
        assert(value instanceof Array && value[0] === 'block')
        let block = value[1]
        let depth = 0
        while (block.exit[0] === 'yield' && block.exit[1][0] instanceof Array && block.exit[1][0][0] === 'if') {
            block = block.exit[1][0][2]
            depth += 1
        }
        assertEq(depth, 20_000)
        assertStructurallySame(block, { statements: [], exit: ['yield', [1]] })
    },
    normalArmDefinitionsStayInOnePostLoopResultRegion: () => {
        const shared = /** @type {const} */ ({ index: 4 })
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', state], 0], 'required']
        /** @type {Block} */
        const continuing = { statements: [], exit: ['continue', target, [['ref', state], ['ref', other]]] }
        /** @type {Block} */
        const normal = { statements: [['define', shared, ['array', [['ref', alias], ['ref', other]]], 'required']],
            exit: ['break', target, [['array', [['ref', shared], ['ref', shared]]]]] }
        /** @type {Loop} */
        const original = { ...scalar, parameters: [state, other], initial: [0, 1], body: {
            statements: [projected, ['if', [], true, continuing, normal]], exit: ['yield', []],
        } }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { ...original, body: { ...original.body,
                statements: [projected, ['if', [], true, baseFirst ? normal : continuing, baseFirst ? continuing : normal]],
            } }
            assertEq(plainLoopOf(source), null)
            const retained = resultBlockPlainLoopOf(source)
            assert(retained !== null)
            assertEq(retained.target, source.target)
            assertEq(retained.parameters, source.parameters)
            assertEq(retained.initial, source.initial)
            assertEq(retained.results, source.results)
            assertEq(retained.body.exit, source.body.exit)
            assertEq(retained.body.statements[0], projected)
            const terminal = retained.body.statements.at(-1)
            assert(terminal !== undefined && terminal[0] === 'if')
            assertEq(terminal[2], true)
            assertEq(baseFirst ? terminal[4] : terminal[3], continuing)
            const final = baseFirst ? terminal[3] : terminal[4]
            assertEq(final.statements.length, 0)
            assert(final.exit[0] === 'break')
            assertEq(final.exit[1], target)
            const value = final.exit[2][0]
            assert(value instanceof Array && value[0] === 'block')
            assertEq(value[1].statements, normal.statements)
            assert(value[1].exit[0] === 'yield' && normal.exit[0] === 'break')
            assertEq(value[1].exit[1], normal.exit[2])
            assert(plainLoopOf(retained) !== null)
            assertEq(plainLoopOf(source), null)
        }
        for (const source of /** @type {readonly Loop[]} */ ([
            { ...original, body: { statements: [], exit: ['yield', []] } },
            { ...original, body: { statements: [projected], exit: ['yield', []] } },
            { ...original, body: { ...original.body, statements: [['if', [], true, continuing, continuing]] } },
            { ...original, body: { ...original.body, statements: [['if', [], true, continuing, { ...normal, statements: [] }]] } },
            { ...original, body: { ...original.body, statements: [['if', [], true, continuing, {
                ...normal, statements: [['define', shared, 0, 'lazy']],
            }]] } },
            { ...original, body: { ...original.body, statements: [['if', [], true, continuing, {
                ...normal, statements: [['block', [], { statements: [], exit: ['yield', []] }]],
            }]] } },
            { ...original, results: [] },
            { ...original, body: { ...original.body, statements: [
                ['define', alias, ['array', [['ref', state]]], 'required'],
                ['if', [], true, continuing, normal],
            ] } },
            { ...original, body: { ...original.body, statements: [['if', [], true, continuing, {
                ...normal, exit: ['break', { kind: 'loop', index: 1 }, [['ref', shared]]],
            }]] } },
        ])) { assertEq(resultBlockPlainLoopOf(source), null) }
    },
    singleInputNormalDefinitionsComposeWithExistingOrientation: () => {
        const shared = /** @type {const} */ ({ index: 4 })
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', state], 0], 'required']
        /** @type {Block} */
        const continuing = { statements: [], exit: ['continue', target, [['ref', state]]] }
        /** @type {Block} */
        const normal = { statements: [['define', shared, ['array', [['ref', alias], ['ref', state]]], 'required']],
            exit: ['break', target, [['array', [['ref', shared], ['ref', shared]]]]] }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { ...scalar, body: { ...scalar.body,
                statements: [projected, ['if', [], true, baseFirst ? normal : continuing, baseFirst ? continuing : normal]],
            } }
            assertEq(plainLoopOf(source), null)
            const retained = resultBlockPlainLoopOf(source)
            assert(retained !== null)
            assertEq(retained.target, source.target)
            assertEq(retained.parameters, source.parameters)
            assertEq(retained.initial, source.initial)
            assertEq(retained.results, source.results)
            assertEq(retained.body.exit, source.body.exit)
            assertEq(retained.body.statements[0], projected)
            const terminal = retained.body.statements.at(-1)
            assert(terminal !== undefined && terminal[0] === 'if')
            assertStructurallySame(terminal[2], baseFirst ? ['!', true] : true)
            assertEq(terminal[3], continuing)
            const final = terminal[4]
            assertEq(final.statements.length, 0)
            assert(final.exit[0] === 'break')
            assertEq(final.exit[1], target)
            const value = final.exit[2][0]
            assert(value instanceof Array && value[0] === 'block')
            assertEq(value[1].statements, normal.statements)
            assert(value[1].exit[0] === 'yield' && normal.exit[0] === 'break')
            assertEq(value[1].exit[1], normal.exit[2])
            assert(plainLoopOf(retained) !== null)
            assertEq(plainLoopOf(source), null)
        }
        for (const source of /** @type {readonly Loop[]} */ ([
            { ...scalar, body: { ...scalar.body, statements: [['if', [], true, continuing, {
                ...normal, statements: [['define', shared, 0, 'lazy']],
            }]] } },
            { ...scalar, body: { ...scalar.body, statements: [['if', [], true, continuing, {
                ...normal, statements: [['block', [], { statements: [], exit: ['yield', []] }]],
            }]] } },
            { ...scalar, body: { ...scalar.body, statements: [['if', [], true, {
                ...normal, exit: ['break', { kind: 'loop', index: 1 }, [['ref', shared]]],
            }, continuing]] } },
            { ...scalar, body: { ...scalar.body, statements: [
                ['define', alias, ['array', [['ref', state]]], 'required'], ['if', [], true, normal, continuing],
            ] } },
        ])) { assertEq(resultBlockPlainLoopOf(source), null) }
    },
    zeroInputNormalDefinitionsKeepTheExistingPlainOrientation: () => {
        const shared = /** @type {const} */ ({ index: 4 })
        /** @type {Block} */
        const continuing = { statements: [], exit: ['continue', target, []] }
        /** @type {Block} */
        const normal = { statements: [['define', shared, ['array', []], 'required']],
            exit: ['break', target, [['array', [['ref', shared], ['ref', shared]]]]] }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { ...scalar, parameters: [], initial: [], body: {
                statements: [['if', [], true, baseFirst ? normal : continuing, baseFirst ? continuing : normal]],
                exit: ['continue', target, []],
            } }
            assertEq(plainLoopOf(source), null)
            const retained = resultBlockPlainLoopOf(source)
            assert(retained !== null)
            assertEq(retained.target, source.target)
            assertEq(retained.parameters, source.parameters)
            assertEq(retained.initial, source.initial)
            assertEq(retained.results, source.results)
            assertEq(retained.body.exit, source.body.exit)
            const terminal = retained.body.statements.at(-1)
            assert(terminal !== undefined && terminal[0] === 'if')
            assertEq(terminal[2], true)
            assertEq(baseFirst ? terminal[4] : terminal[3], continuing)
            const final = baseFirst ? terminal[3] : terminal[4]
            assertEq(final.statements.length, 0)
            assert(final.exit[0] === 'break')
            assertEq(final.exit[1], target)
            const value = final.exit[2][0]
            assert(value instanceof Array && value[0] === 'block')
            assertEq(value[1].statements, normal.statements)
            assert(value[1].exit[0] === 'yield' && normal.exit[0] === 'break')
            assertEq(value[1].exit[1], normal.exit[2])
            const plan = plainLoopOf(retained)
            assert(plan !== null)
            assertStructurallySame(plan.iteration.condition, baseFirst ? ['!', true] : true)
            assertEq(plan.result, value)
            assertEq(plainLoopOf(source), null)
        }
    },
    conditionalNormalResultsKeepSelectedRegionsAndExactTransfers: () => {
        const shared = /** @type {const} */ ({ index: 4 })
        const selected = /** @type {const} */ ({ index: 5 })
        /** @type {Definition} */
        const prefix = ['define', shared, ['array', [['ref', state]]], 'required']
        /** @type {Definition} */
        const reached = ['define', selected, ['()', ['ref', other], [['ref', shared]]], 'required']
        /** @type {Block} */
        const first = { statements: [reached], exit: ['break', target, [['ref', selected]]] }
        /** @type {Block} */
        const second = { statements: [], exit: ['break', target, [['ref', shared]]] }
        /** @type {Block} */
        const nested = { statements: [], exit: ['break', target, [['array', [['ref', shared], ['ref', shared]]]]] }
        /** @type {Block} */
        const alternative = { statements: [['if', [], false, second, nested]], exit: ['yield', []] }
        /** @type {Block} */
        const normal = { statements: [prefix, ['if', [], true, first, alternative]], exit: ['yield', []] }
        for (const parameters of /** @type {readonly (readonly BindingId[])[]} */ ([[], [state], [state, other]])) {
            /** @type {Block} */
            const continuing = { statements: [], exit: ['continue', target, parameters.map(parameter => ['ref', parameter])] }
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                /** @type {Loop} */
                const source = { ...scalar, parameters, initial: parameters.map(() => 0), body: {
                    statements: [['if', [], true, baseFirst ? normal : continuing, baseFirst ? continuing : normal]],
                    exit: ['yield', []],
                } }
                assertEq(plainLoopOf(source), null)
                const retained = resultBlockPlainLoopOf(source)
                assert(retained !== null)
                assertEq(retained.target, target)
                assertEq(retained.parameters, source.parameters)
                assertEq(retained.initial, source.initial)
                assertEq(retained.results, source.results)
                assertEq(retained.body.exit, source.body.exit)
                const plan = plainLoopOf(retained)
                assert(plan !== null)
                assertStructurallySame(plan.iteration.condition, baseFirst ? ['!', true] : true)
                const value = plan.result
                assert(value instanceof Array && value[0] === 'block')
                assertEq(value[1].statements[0], prefix)
                assertStructurallySame(value[1], { statements: [prefix], exit: ['yield', [['if', true,
                    { statements: [reached], exit: ['yield', first.exit[0] === 'break' ? first.exit[2] : []] },
                    { statements: [], exit: ['yield', [['if', false,
                        { statements: [], exit: ['yield', second.exit[0] === 'break' ? second.exit[2] : []] },
                        { statements: [], exit: ['yield', nested.exit[0] === 'break' ? nested.exit[2] : []] },
                    ]]] },
                ]]] })
                assertEq(plainLoopOf(source), null)
            }
        }
        for (const refused of /** @type {readonly Block[]} */ ([
            { ...normal, statements: [['define', shared, 0, 'lazy'], ...normal.statements.slice(1)] },
            { ...normal, statements: [['block', [], second]] },
            { ...normal, statements: [['if', [selected], true, first, second]] },
            { ...normal, exit: ['yield', [0]] },
            { ...normal, exit: ['throw', 0] },
            { ...normal, statements: [['if', [], true, { ...first, exit: ['break', { kind: 'loop', index: 1 }, [0]] }, second]] },
            { ...normal, statements: [['if', [], true, first, { ...second, exit: ['break', target, []] }]] },
            { ...normal, statements: [['if', [], true, first, { ...second, exit: ['break', target, [0, 1]] }]] },
            { ...normal, statements: [['if', [], true, first, { ...second, exit: ['continue', target, [0]] }]] },
            { ...normal, statements: [['if', [], true, { ...first, statements: [['define', selected, 0, 'lazy']] }, second]] },
            { ...normal, statements: [['if', [], true, first, { ...second, statements: [['define', selected, 0, 'lazy']] }]] },
            { ...normal, statements: [['if', [], true, first, { statements: [], exit: ['yield', []] }]] },
        ])) {
            assertEq(resultBlockPlainLoopOf(withArms(step, refused)), null)
        }
    },
    deepConditionalNormalResultsUseTheTaskStack: () => {
        /** @type {Block} */
        let normal = { statements: [], exit: ['break', target, [7]] }
        for (let depth = 0; depth < 20_000; depth += 1) {
            normal = { statements: [['if', [], true, normal, done]], exit: ['yield', []] }
        }
        const retained = resultBlockPlainLoopOf(withArms(step, normal))
        assert(retained !== null)
        const plan = plainLoopOf(retained)
        assert(plan !== null)
        let value = plan.result
        assert(value instanceof Array && value[0] === 'block')
        let block = value[1]
        let depth = 0
        while (block.exit[0] === 'yield' && block.exit[1][0] instanceof Array && block.exit[1][0][0] === 'if') {
            block = block.exit[1][0][2]
            depth += 1
        }
        assertEq(depth, 20_000)
        assertStructurallySame(block, { statements: [], exit: ['yield', [7]] })
    },
    baseFirstSingleInputReorientationKeepsRegionsAndDefaultDomain: () => {
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', state], 0], 'required']
        /** @type {Block} */
        const normal = { statements: [], exit: ['break', target, [['ref', alias]]] }
        const original = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body,
            statements: [projected, ['if', [], ['ref', alias], normal, step]],
        } })
        assertEq(plainLoopOf(original), null)
        const oriented = continueFirstPlainLoopOf(original)
        assertStructurallySame(oriented, { ...original, body: { ...original.body,
            statements: [projected, ['if', [], ['!', ['ref', alias]], step, normal]],
        } })
        assertEq(oriented?.target, original.target)
        assertEq(oriented?.parameters, original.parameters)
        assertEq(oriented?.initial, original.initial)
        assertEq(oriented?.results, original.results)
        assertEq(oriented?.body.exit, original.body.exit)
        assertEq(oriented?.body.statements[0], projected)
        assertStructurallySame(oriented === null ? null : plainLoopOf(oriented)?.iteration.condition, ['!', ['ref', alias]])
        assertEq(plainLoopOf(original), null)
        for (const loop of /** @type {readonly Loop[]} */ ([
            { ...original, parameters: [], initial: [] },
            { ...scalar, body: { statements: [], exit: ['yield', []] } },
            { ...scalar, body: { statements: [projected], exit: ['yield', []] } },
            scalar,
            { ...original, results: [] },
            { ...original, body: { ...original.body, statements: [
                ['define', alias, ['array', [['ref', state]]], 'required'],
                ['if', [], ['ref', alias], normal, step],
            ] } },
        ])) { assertEq(continueFirstPlainLoopOf(loop), null) }
    },
    multipleInputsPackSimultaneousValuesInEitherArm: () => {
        const reached = /** @type {const} */ ({ index: 4 })
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', state], 0], 'required']
        /** @type {Definition} */
        const required = ['define', reached, ['array', [['ref', alias], ['ref', other]]], 'required']
        /** @type {Block} */
        const continuing = { statements: [required], exit: ['continue', target, [['ref', other], ['ref', state]]] }
        /** @type {Block} */
        const normal = { statements: [], exit: ['break', target, [['array', [['ref', alias], ['ref', other]]]]] }
        /** @type {Value} */
        const test = ['<', ['ref', other], 3]
        for (const reversed of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { target, parameters: [state, other], initial: [['array', [7]], 1], results: [result], body: {
                statements: [projected, ['if', [], test, reversed ? normal : continuing, reversed ? continuing : normal]],
                exit: ['yield', []],
            } }
            const plan = plainLoopOf(source)
            assertStructurallySame(plan, {
                prefix: [projected], resultPrefix: [projected],
                iteration: {
                    condition: reversed ? ['!', test] : test,
                    step: { statements: [projected, required], exit: continuing.exit },
                    next: ['array', [['ref', other], ['ref', state]]],
                },
                result: ['array', [['ref', alias], ['ref', other]]],
            })
            assertEq(plan?.iteration.step.exit, continuing.exit)
        }
        assertEq(plainLoopOf(withArms(done, step)), null)
    },
    zeroInputEitherArmKeepsProjectionLifetimes: () => {
        /** @type {Definition} */
        const projected = ['define', alias, ['.', ['ref', other], 0], 'required']
        /** @type {Definition} */
        const reached = ['define', state, ['array', [['ref', alias]]], 'required']
        /** @type {Block} */
        const continuing = { statements: [reached], exit: ['continue', target, []] }
        /** @type {Block} */
        const normal = { statements: [], exit: ['break', target, [['array', [['ref', alias]]]]] }
        for (const reversed of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { target, parameters: [], initial: [], results: [result], body: {
                statements: [projected, ['if', [], ['ref', alias], reversed ? normal : continuing, reversed ? continuing : normal]],
                exit: ['yield', []],
            } }
            assertStructurallySame(plainLoopOf(source), {
                prefix: [projected], resultPrefix: [projected],
                iteration: {
                    condition: reversed ? ['!', ['ref', alias]] : ['ref', alias],
                    step: { statements: [projected, reached], exit: continuing.exit },
                    next: undefined,
                },
                result: ['array', [['ref', alias]]],
            })
        }
    },
    independentCopiesFollowBodyReadOrder: () => {
        /** @type {import('../../types.ts').BindingId} */
        const combined = { index: 4 }
        /** @type {readonly import('../../types.ts').Definition[]} */
        const prefix = [
            ['define', alias, ['.', ['ref', state], 0], 'required'],
            ['define', other, ['.', ['ref', state], 1], 'required'],
        ]
        /** @type {import('../../types.ts').Definition} */
        const sum = ['define', combined, ['+', ['ref', other], ['ref', alias]], 'required']
        /** @type {Block} */
        const step = { statements: [sum], exit: ['continue', target, [['ref', combined]]] }
        /** @type {Loop} */
        const source = { ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, step, done]] } }
        const plan = plainLoopOf(source)
        assertStructurallySame(plan?.prefix, prefix)
        assertStructurallySame(plan?.iteration.step.statements, [prefix[1], prefix[0], sum])
    },
    schedulesCopiedDependenciesAtTheirFirstStepUse: () => {
        /** @type {BindingId} */
        const dependent = { index: 4 }
        /** @type {BindingId} */
        const local = { index: 5 }
        /** @type {BindingId} */
        const selected = { index: 6 }
        /** @type {BindingId} */
        const updated = { index: 7 }
        /** @type {readonly Definition[]} */
        const prefix = [
            ['define', alias, ['.', ['ref', state], 0], 'required'],
            ['define', other, ['.', ['ref', state], 1], 'required'],
            ['define', dependent, ['ref', alias], 'required'],
        ]
        /** @type {readonly Definition[]} */
        const statements = [
            ['define', local, 1, 'required'],
            ['define', selected, ['if', true, { statements: [], exit: ['yield', [['ref', dependent]]] }, { statements: [], exit: ['yield', [0]] }], 'required'],
            ['define', updated, ['+', ['ref', other], ['ref', selected]], 'required'],
        ]
        /** @type {Block} */
        const next = { statements, exit: ['continue', target, [['ref', updated]]] }
        /** @type {Loop} */
        const source = { ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, next, done]] } }
        const plan = plainLoopOf(source)
        assertStructurallySame(plan?.prefix, prefix)
        assertStructurallySame(plan?.iteration.step.statements, [statements[0], prefix[0], prefix[2], statements[1], prefix[1], statements[2]])
        assertStructurallySame(plan?.iteration.step.exit, next.exit)
    },
    keepsConditionOnlyAllocationsAndTransitiveCopyDependencies: () => {
        const projected = /** @type {const} */ ({ index: 4 })
        const prefix = /** @type {Block['statements']} */ ([
            ['define', other, ['array', [['ref', state]]], 'required'],
            ['define', alias, ['ref', other], 'required'],
            ['define', projected, ['.', ['ref', state], 0], 'required'],
        ])
        const next = /** @type {Block} */ ({ statements: [], exit: ['continue', target, [['array', [['ref', projected]]]]] })
        const normal = /** @type {Block} */ ({ statements: [], exit: ['break', target, [['ref', projected]]] })
        const source = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], ['===', ['ref', other], ['ref', alias]], next, normal]] } })
        assertStructurallySame(plainLoopOf(source)?.iteration.step.statements, [prefix[2]])
        assertStructurallySame(plainLoopOf(source)?.resultPrefix, [prefix[2]])
        assertEq(plainLoopOf(source)?.prefix[0], prefix[0])
        // An alias is safe to copy only if every prefix input it needs is safe.
        assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [...prefix, ['if', [], true, { ...next, exit: ['continue', target, [['ref', alias]]] }, normal]] } }), null)
        const pure = /** @type {Block['statements']} */ ([
            ['define', other, ['.', ['ref', state], 0], 'required'],
            ['define', alias, ['ref', other], 'required'],
        ])
        const copied = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...pure, ['if', [], true, step, { ...done, exit: ['break', target, [['ref', alias]]] }]] } })
        assertStructurallySame(plainLoopOf(copied)?.resultPrefix, pure)
    },
    plainShape: () => {
        const prefix = /** @type {Block['statements']} */ ([
            ['define', alias, ['.', ['ref', state], 0], 'required'],
        ])
        const normal = /** @type {Block} */ ({ statements: [], exit: ['break', target, [['array', [['ref', alias]]]]] })
        const source = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, step, normal]] } })
        assertStructurallySame(plainLoopOf(source), { prefix, resultPrefix: prefix, iteration: { condition: true, step, next: 1 }, result: ['array', [['ref', alias]]] })
        assertStructurallySame(plainLoopOf(scalar), { prefix: [], resultPrefix: [], iteration: { condition: true, step, next: 1 }, result: ['ref', state] })
        for (const value of /** @type {readonly Value[]} */ ([1, ['ref', state], ['.', ['.', ['ref', state], 0], 1]])) {
            assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [['define', alias, value, 'required'], ...source.body.statements.slice(1)] } })?.prefix[0][2], value)
        }
        /** @type {Value} */
        let value = ['ref', state]
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['.', value, 0] }
        assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [['define', alias, value, 'required'], ...source.body.statements.slice(1)] } })?.prefix[0][2], value)
    },
    refusesIdentityMintingPrefixes: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['array', []], ['()', ['ref', other], []], ['.', ['ref', state], 'slice'],
            ['.', ['ref', state], ['Number', 0]], ['.', ['ref', state], 0, ['|()', []]],
        ])) {
            assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['define', alias, value, 'required'], ['if', [], true, step, { statements: [], exit: ['break', target, [['ref', alias]]] }]] } }), null)
        }
        assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['define', alias, 1, 'lazy'], ...scalar.body.statements] } }), null)
        assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['block', [], { statements: [], exit: ['yield', []] }], ...scalar.body.statements] } }), null)
    },
    refusesOtherPlainShapes: () => {
        for (const source of /** @type {readonly Loop[]} */ ([
            { ...scalar, results: [] },
            { ...scalar, body: { statements: [], exit: ['yield', []] } },
            { ...scalar, body: { statements: [['define', alias, 0, 'required']], exit: ['yield', []] } },
            { ...scalar, body: { ...scalar.body, statements: [['if', [alias], true, step, done]] } },
            withArms({ ...step, exit: ['yield', []] }, done),
            withArms({ ...step, exit: ['continue', { kind: 'loop', index: 0 }, [1]] }, done),
            withArms(step, { ...done, exit: ['yield', []] }),
            withArms(step, { ...done, exit: ['break', { kind: 'loop', index: 0 }, [1]] }),
            withArms(step, { ...done, statements: [['define', alias, 0, 'required']] }),
            withArms({ ...step, statements: [['block', [], { statements: [], exit: ['yield', []] }]] }, done),
        ])) { assertEq(plainLoopOf(source), null) }
    },
})
