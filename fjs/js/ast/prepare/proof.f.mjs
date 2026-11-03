/**
 * Preparation fixes physical lifetimes and transfers before either renderer.
 * These fixtures inspect that plan directly, including simultaneous updates
 * and returns which must remain outside expression wrappers.
 *
 * @import { BindingId, Block as NormalBlock, Definition, Function as NormalFunction, Loop, LoopTarget, Value as NormalValue } from '../types.ts'
 * @import { Block, Function as PreparedFunction, Statement, Value } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { prepare, prepareFunction } from './module.f.mjs'
import { _tailFunction } from '../../../edag/to_fast/tail_calls/proof.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(value: NormalValue) => NormalBlock} */
const yielding = value => ({ statements: [], exit: ['yield', [value]] })

/** @type {(target: LoopTarget, parameter: BindingId, result: BindingId, next: NormalValue, statements?: readonly Definition[]) => Loop} */
const scalar = (target, parameter, result, next, statements = []) => ({
    target,
    parameters: [parameter],
    initial: [0],
    results: [result],
    body: {
        statements: [['if', [], ['<', ['ref', parameter], 3],
            { statements, exit: ['continue', target, [next]] },
            { statements: [], exit: ['break', target, [['ref', parameter]]] },
        ]],
        exit: ['continue', target, [['ref', parameter]]],
    },
})

/** The first physical loop statement in a plan. @type {(block: Block) => Extract<Statement, readonly ['loop', unknown, unknown]>} */
const loopStatement = block => /** @type {Extract<Statement, readonly ['loop', unknown, unknown]>} */ (block.statements.find(statement => statement[0] === 'loop'))

/** Prepare a function using the source-output plan. @type {(fn: NormalFunction) => PreparedFunction} */
const sourceFunction = fn => {
    const prepared = prepare({ statements: [], exit: ['yield', [['function', fn]]] }, { sourceLoops: true })
    assert(prepared.exit[0] === 'yield')
    const value = prepared.exit[1][0]
    assert(value instanceof Array && value[0] === 'function')
    return value[1]
}

export const proof = {
    sourceTerminalThrowsExitWithoutWritingStateOrResultSlots: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), other = id(1), result = id(2), pair = id(3)
        for (const empty of /** @type {const} */ ([false, true])) {
            /** @type {NormalValue} */
            const allocation = ['array', empty ? [false] : [['ref', state], ['ref', other]]]
            /** @type {NormalValue} */
            const condition = ['.', ['ref', pair], 0]
            /** @type {NormalValue} */
            const payload = ['array', [['ref', pair]]]
            /** @type {NormalBlock} */
            const failed = { statements: [], exit: ['throw', payload] }
            /** @type {NormalBlock} */
            const completed = { statements: [], exit: ['break', target, [['ref', pair]]] }
            /** @type {readonly NormalValue[]} */
            const next = empty ? [] : [['ref', other], ['ref', state]]
            /** @type {NormalBlock} */
            const continued = { statements: [], exit: ['continue', target, next] }
            /** @type {NormalBlock} */
            const selected = empty ? { statements: [['if', [], condition, completed, continued]], exit: ['yield', []] } : continued
            for (const throwFirst of /** @type {const} */ ([false, true])) {
                /** @type {Loop} */
                const loop = { target, parameters: empty ? [] : [state, other], initial: empty ? [] : [2, 3], results: [result], body: {
                    statements: [['define', pair, allocation, 'required'],
                        ['if', [], condition, throwFirst ? failed : selected, throwFirst ? selected : failed]], exit: ['yield', []],
                } }
                const source = prepare({ statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }, { sourceLoops: true })
                const physical = source.statements.at(-1)
                assert(physical !== undefined && physical[0] === 'while')
                assertEq(physical[1].condition, true)
                assertEq(physical[1].result, result)
                assertEq(physical[1].mutable, true)
                assertEq(source.statements.length, empty ? 1 : 2)
                const prefix = physical[1].body.statements[loop.parameters.length]
                assert(prefix[0] === 'define')
                assertEq(prefix[1], pair)
                assertStructurallySame(prefix[2], allocation)
                const terminal = physical[1].body.statements.at(-1)
                assert(terminal !== undefined && terminal[0] === 'if')
                assertStructurallySame(terminal[1], condition)
                const thrown = throwFirst ? terminal[2] : terminal[3]
                assertEq(thrown.statements.length, 0)
                assertStructurallySame(thrown.exit, ['throw', payload])
                const resumed = throwFirst ? terminal[3] : terminal[2]
                let step = resumed
                if (empty) {
                    const nested = resumed.statements[0]
                    assert(nested[0] === 'if')
                    step = nested[3]
                    const write = nested[2].statements[1]
                    assert(write[0] === 'write')
                    assertEq(write[1], physical[1].slot)
                } else {
                    const established = resumed.statements[0], write = resumed.statements[1]
                    assert(established[0] === 'define' && write[0] === 'write')
                    assertStructurallySame(established[2], ['array', next])
                    assertEq(write[1], physical[1].slot)
                    assertStructurallySame(write[2], ['ref', established[1]])
                }
                assertEq(step.statements.length, empty ? 0 : 2)
                assertEq(step.exit[0], 'continue')
                assertEq(step.exit[1], target)
            }
        }
    },
    sourceContinuingOnlyTreesPackInputsBeforeTheStateWrite: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), other = id(1), result = id(2), pair = id(3)
        /** @type {readonly NormalValue[]} */
        const next = [['.', ['ref', pair], 1], ['.', ['ref', pair], 0]]
        /** @type {NormalBlock} */
        const step = { statements: [], exit: ['continue', target, next] }
        /** @type {Definition} */
        const prefix = ['define', pair, ['array', [['ref', state], ['ref', other]]], 'required']
        for (const body of /** @type {readonly NormalBlock[]} */ ([
            { statements: [prefix], exit: step.exit },
            { statements: [prefix, ['if', [], ['>', ['ref', state], 0], step, step]], exit: ['yield', []] },
        ])) {
            /** @type {NormalBlock} */
            const block = { statements: [['loop', { target, parameters: [state, other], initial: [2, 3], results: [result], body }]], exit: ['yield', [['ref', result]]] }
            assert(prepare(block).statements.some(statement => statement[0] === 'loop'))
            const source = prepare(block, { sourceLoops: true })
            assertStructurallySame(source.statements.map(statement => statement[0]), ['define', 'while'])
            const initial = source.statements[0], physical = source.statements[1]
            assert(initial[0] === 'define' && physical[0] === 'while')
            assertStructurallySame(initial[2], ['array', [2, 3]])
            assertEq(physical[1].condition, true)
            assertEq(physical[1].mutable, true)
            for (const [index, parameter] of [state, other].entries()) {
                const snapshot = physical[1].body.statements[index]
                assert(snapshot[0] === 'define')
                assertEq(snapshot[1], parameter)
                assertStructurallySame(snapshot[2], ['.', ['ref', physical[1].slot], index])
            }
            const required = physical[1].body.statements[2]
            assert(required[0] === 'define')
            assertEq(required[1], pair)
            const last = physical[1].body.statements.at(-1)
            assert(last !== undefined)
            for (const arm of last[0] === 'if' ? [last[2], last[3]] : [physical[1].body]) {
                const transfer = arm.statements.slice(-2)
                const established = transfer[0], write = transfer[1]
                assert(established[0] === 'define' && write[0] === 'write')
                assertStructurallySame(established[2], ['array', next])
                assertEq(write[1], physical[1].slot)
                assertStructurallySame(write[2], ['ref', established[1]])
                assertEq(arm.exit[0], 'continue')
                assertEq(arm.exit[1], target)
            }
        }
    },
    sourceZeroInputTerminalTreesUseOnlyAResultSlot: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const result = id(0), pair = id(1), reached = id(2)
        /** @type {NormalValue} */
        const allocation = ['array', [false]]
        /** @type {NormalValue} */
        const condition = ['.', ['ref', pair], 0]
        /** @type {NormalBlock} */
        const normal = { statements: [], exit: ['break', target, [['ref', pair]]] }
        /** @type {NormalBlock} */
        const continued = { statements: [['define', reached, ['array', []], 'required']], exit: ['continue', target, []] }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            /** @type {NormalBlock} */
            const mixed = { statements: [['if', [], condition, baseFirst ? normal : continued, baseFirst ? continued : normal]], exit: ['yield', []] }
            for (const next of [continued, mixed]) {
                /** @type {Loop} */
                const loop = { target, parameters: [], initial: [], results: [result], body: {
                    statements: [['define', pair, allocation, 'required'],
                        ['if', [], condition, baseFirst ? normal : next, baseFirst ? next : normal]], exit: ['yield', []],
                } }
                /** @type {NormalBlock} */
                const block = { statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }
                assert(prepare(block).statements.some(statement => statement[0] === 'loop'))
                const source = prepare(block, { sourceLoops: true })
                assertEq(source.statements.length, 1)
                const physical = source.statements[0]
                assert(physical[0] === 'while')
                assertEq(physical[1].initial, undefined)
                assertEq(physical[1].condition, true)
                assertEq(physical[1].result, result)
                assertEq(physical[1].mutable, true)
                // No semantic-input snapshot or synthetic empty allocation.
                assertEq(physical[1].body.statements.length, 2)
                const prefix = physical[1].body.statements[0]
                assert(prefix[0] === 'define')
                assertEq(prefix[1], pair)
                assertStructurallySame(prefix[2], allocation)
                const terminal = physical[1].body.statements[1]
                assert(terminal[0] === 'if')
                assertStructurallySame(terminal[1], condition)
                const complete = baseFirst ? terminal[2] : terminal[3]
                const completion = complete.statements[0], write = complete.statements[1]
                assert(complete.exit[0] === 'break' && completion[0] === 'define' && write[0] === 'write')
                assertStructurallySame(completion[2], ['ref', pair])
                assertEq(write[1], physical[1].slot)
                const selected = baseFirst ? terminal[3] : terminal[2]
                const nested = selected.statements[0]
                let step = selected
                if (next !== continued) {
                    assert(nested[0] === 'if')
                    step = baseFirst ? nested[3] : nested[2]
                }
                assertEq(step.exit[0], 'continue')
                assertEq(step.exit[1], target)
                assertEq(step.statements.length, 1)
                const required = step.statements[0]
                assert(required[0] === 'define')
                assertEq(required[1], reached)
                assertStructurallySame(required[2], ['array', []])
                assertEq(loop.parameters.length, 0)
                assertEq(loop.initial.length, 0)
                assert(continued.exit[0] === 'continue')
                assertEq(continued.exit[2].length, 0)
            }
        }
    },
    sourceSharedRequiredPrefixStaysBeforeTheTestAndBothTransfers: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), other = id(1), result = id(2), pair = id(3)
        /** @type {NormalValue} */
        const allocation = ['array', [['ref', state], ['ref', other]]]
        /** @type {NormalValue} */
        const condition = ['>', ['.', ['ref', pair], 0], 0]
        /** @type {NormalBlock} */
        const normal = { statements: [], exit: ['break', target, [['ref', pair]]] }
        /** @type {readonly NormalValue[]} */
        const next = [['-', ['.', ['ref', pair], 0], 1], ['+', ['.', ['ref', pair], 1], 1]]
        /** @type {NormalBlock} */
        const step = { statements: [], exit: ['continue', target, next] }
        for (const baseFirst of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const loop = { target, parameters: [state, other], initial: [2, 3], results: [result], body: {
                statements: [['define', pair, allocation, 'required'],
                    ['if', [], condition, baseFirst ? normal : step, baseFirst ? step : normal]], exit: ['yield', []],
            } }
            /** @type {NormalBlock} */
            const block = { statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }
            assert(prepare(block).statements.some(statement => statement[0] === 'loop'))
            const source = prepare(block, { sourceLoops: true })
            assertStructurallySame(source.statements.map(statement => statement[0]), ['define', 'while'])
            const physical = source.statements[1]
            assert(physical[0] === 'while')
            assertEq(physical[1].condition, true)
            assertEq(physical[1].result, result)
            assertEq(physical[1].body.statements.length, 4)
            const prefix = physical[1].body.statements[2]
            assert(prefix[0] === 'define')
            assertEq(prefix[1], pair)
            assertStructurallySame(prefix[2], allocation)
            const terminal = physical[1].body.statements[3]
            assert(terminal[0] === 'if')
            assertStructurallySame(terminal[1], condition)
            const completed = baseFirst ? terminal[2] : terminal[3]
            const continued = baseFirst ? terminal[3] : terminal[2]
            const resultValue = completed.statements[0], nextValue = continued.statements[0]
            assert(resultValue[0] === 'define' && nextValue[0] === 'define')
            assertStructurallySame(resultValue[2], ['ref', pair])
            assertStructurallySame(nextValue[2], ['array', next])
            for (const arm of [completed, continued]) {
                assertEq(arm.statements.length, 2)
                const write = arm.statements[1]
                assert(write[0] === 'write')
                assertEq(write[1], physical[1].slot)
            }
        }
    },
    sourceMixedTransitionsPackAllInputsBeforeOneSharedSlotWrite: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), other = id(1), result = id(2), pair = id(3)
        /** @type {NormalBlock} */
        const normal = { statements: [], exit: ['break', target, [['ref', other]]] }
        /** @type {NormalBlock} */
        const step = { statements: [], exit: ['continue', target, [['ref', other], ['ref', state]]] }
        /** @type {NormalBlock} */
        const mixed = { statements: [['define', pair, ['array', [['ref', state], ['ref', other]]], 'required'],
            ['if', [], ['===', ['ref', state], 1], normal, step]], exit: ['yield', []] }
        /** @type {Loop} */
        const loop = { target, parameters: [state, other], initial: [2, 3], results: [result], body: {
            statements: [['if', [], ['>', ['ref', state], 0], mixed, normal]], exit: ['yield', []],
        } }
        /** @type {NormalBlock} */
        const block = { statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }
        assert(prepare(block).statements.some(statement => statement[0] === 'loop'))
        const source = prepare(block, { sourceLoops: true })
        assertStructurallySame(source.statements.map(statement => statement[0]), ['define', 'while'])
        const initial = source.statements[0], physical = source.statements[1]
        assert(initial[0] === 'define' && physical[0] === 'while')
        assertStructurallySame(initial[2], ['array', [2, 3]])
        assertEq(physical[1].condition, true)
        assertEq(physical[1].mutable, true)
        assertEq(physical[1].result, result)
        for (const [index, parameter] of [state, other].entries()) {
            const snapshot = physical[1].body.statements[index]
            assert(snapshot[0] === 'define')
            assertEq(snapshot[1], parameter)
            assertStructurallySame(snapshot[2], ['.', ['ref', physical[1].slot], index])
        }
        const root = physical[1].body.statements[2]
        assert(root[0] === 'if')
        const nested = root[2].statements[1]
        assert(nested[0] === 'if')
        const selected = nested[3].statements[0]
        assert(selected[0] === 'define')
        assertStructurallySame(selected[2], ['array', [['ref', other], ['ref', state]]])
        for (const arm of [nested[2], nested[3], root[3]]) {
            const write = arm.statements.at(-1)
            assert(write !== undefined && write[0] === 'write')
            assertEq(write[1], physical[1].slot)
        }
        const completion = nested[2].statements[0]
        assert(completion[0] === 'define')
        assertStructurallySame(completion[2], ['ref', other])
        // A uniform root's shared required prefix uses the same private slot.
        const ordinary = prepare({ ...block, statements: [['loop', { ...loop, body: {
            statements: [['define', pair, ['array', [['ref', state]]], 'required'],
                ['if', [], true, step, { statements: [], exit: ['break', target, [['ref', pair]]] }]], exit: ['yield', []],
        } }]] }, { sourceLoops: true })
        assert(ordinary.statements.some(statement => statement[0] === 'while'))
    },
    sourceBranchingTransitionsKeepOneSelectedValueAndZeroInputWork: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), other = id(1), result = id(2), selected = id(3), alternative = id(4)
        for (const width of /** @type {const} */ ([0, 2])) {
            const parameters = [state, other].slice(0, width)
            /** @type {(binding: BindingId) => NormalBlock} */
            const leaf = binding => ({ statements: [['define', binding, ['.', null, 'selected'], 'required']],
                exit: ['continue', target, parameters.toReversed().map(binding => ['ref', binding])] })
            /** @type {NormalBlock} */
            const block = { statements: [['loop', {
                target, parameters, initial: parameters.map(() => 0), results: [result], body: {
                    statements: [['if', [], false,
                        { statements: [['if', [], true, leaf(selected), leaf(alternative)]], exit: ['yield', []] },
                        { statements: [], exit: ['break', target, [7]] },
                    ]], exit: ['yield', []],
                },
            }]], exit: ['yield', [['ref', result]]] }
            const source = prepare(block, { sourceLoops: true })
            const physical = source.statements[0]
            assert(physical[0] === 'while')
            assertEq(physical[1].mutable, true)
            assertEq(physical[1].body.statements.filter(statement => statement[0] === 'write').length, 1)
            assertEq(physical[1].body.statements.filter(statement => statement[0] === 'define').length, width + 1)
            const transition = physical[1].body.statements.at(-2)
            assert(transition !== undefined && transition[0] === 'define')
            let value = transition[2]
            while (value instanceof Array && value[0] === 'block') {
                assertEq(value[1].statements.length, 0)
                assert(value[1].exit[0] === 'yield')
                value = value[1].exit[1][0]
            }
            assert(value instanceof Array && value[0] === 'if')
            for (const arm of [value[2], value[3]]) {
                assertEq(arm.statements[0][0], 'define')
                const required = arm.statements[0]
                assert(required[0] === 'define')
                assertStructurallySame(required[2], ['.', null, 'selected'])
                assert(arm.exit[0] === 'yield')
                assertStructurallySame(arm.exit[1][0], width === 0 ? undefined : ['array', parameters.toReversed().map(binding => ['ref', binding])])
            }
            assert(prepare(block).statements.some(statement => statement[0] === 'loop'))
        }
    },
    sourceBranchingScalarPlanIsLimitedToTheObservedRestRoot: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const input = id(0), state = id(1), result = id(2)
        /** @type {NormalBlock} */
        const leaf = { statements: [], exit: ['continue', target, [['ref', state]]] }
        /** @type {Loop} */
        const loop = { target, parameters: [state], initial: [['ref', input]], results: [result], body: {
            statements: [['if', [], false,
                { statements: [['if', [], true, leaf, leaf]], exit: ['yield', []] },
                { statements: [], exit: ['break', target, [['ref', state]]] },
            ]], exit: ['yield', []],
        } }
        /** @type {NormalFunction} */
        const fn = { target: owner, parameters: [], rest: input, self: null, captures: [], body: {
            statements: [['loop', loop]], exit: ['return', owner, ['ref', result]],
        } }
        assertEq(sourceFunction(fn).body.statements[0][0], 'while')
        assert(prepareFunction(fn).body.statements.some(statement => statement[0] === 'loop'))
        const ordinary = sourceFunction({ ...fn, parameters: [input], rest: null }).body.statements.find(statement => statement[0] === 'while')
        assert(ordinary !== undefined && ordinary[0] === 'while')
        assertEq(ordinary[1].condition, true)
        const later = id(3)
        const guarded = sourceFunction({ ...fn, body: { ...fn.body, statements: [['loop', loop], ['define', later, ['array', []], 'required']] } })
            .body.statements.find(statement => statement[0] === 'while')
        assert(guarded !== undefined && guarded[0] === 'while')
        assertEq(guarded[1].condition, true)
        const empty = sourceFunction({ ...fn, body: { statements: [], exit: ['return', owner, 7] } })
        assertEq(empty.body.statements.length, 0)
    },
    scalarSourceResultExposesTotalPrefixesBeforeProjectionReads: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), result = id(1), shared = id(2), observer = id(3), later = id(4)
        /** @type {NormalValue} */
        const pair = ['array', [['ref', state]]]
        /** @type {NormalValue} */
        const returned = ['array', [['.', ['ref', state], 1], ['ref', shared], ['ref', shared]]]
        /** @type {(statements: readonly Definition[], sourceLoops?: boolean) => Block} */
        const plan = (statements, sourceLoops = true) => prepare({ statements: [['loop', {
            target, parameters: [state], initial: [['array', [0, 7]]], results: [result], body: {
                statements: [['if', [], false,
                    { statements: [], exit: ['continue', target, [['ref', state]]] },
                    { statements: [], exit: ['break', target, [['block', { statements, exit: ['yield', [returned]] }]]] },
                ]], exit: ['yield', []],
            },
        }]], exit: ['yield', [['ref', result]]] }, { sourceLoops })
        /** @type {readonly Definition[]} */
        const definitions = [['define', shared, pair, 'required']]
        const source = plan(definitions)
        assertStructurallySame(source.statements.map(statement => statement[0]), ['while', 'define', 'define', 'define'])
        const physical = source.statements[0]
        const snapshot = source.statements[1]
        const allocation = source.statements[2]
        const completed = source.statements[3]
        assert(physical[0] === 'while' && snapshot[0] === 'define' && allocation[0] === 'define' && completed[0] === 'define')
        assertStructurallySame(snapshot[2], ['ref', physical[1].result])
        assertEq(allocation[1], shared)
        assertStructurallySame(allocation[2], ['array', [['ref', snapshot[1]]]])
        assertEq(completed[1], result)
        assertStructurallySame(completed[2], ['array', [['.', ['ref', snapshot[1]], 1], ['ref', shared], ['ref', shared]]])
        const ordinary = plan(definitions, false)
        assertStructurallySame(ordinary.statements.map(statement => statement[0]), ['while', 'define'])
        const ordinaryResult = ordinary.statements[1]
        assert(ordinaryResult[0] === 'define' && ordinaryResult[2] instanceof Array && ordinaryResult[2][0] === 'block')
        for (const barrier of /** @type {const} */ ([['()', ['ref', observer], [['ref', state]]], ['.', null, 0]])) {
            const retained = plan([
                ['define', shared, barrier, 'required'], ['define', later, pair, 'required'],
            ])
            assertStructurallySame(retained.statements.map(statement => statement[0]), ['while', 'define', 'define'])
            const alias = retained.statements[1]
            const final = retained.statements[2]
            assert(alias[0] === 'define' && final[0] === 'define' && final[2] instanceof Array && final[2][0] === 'block')
            assertStructurallySame(final[2][1].statements.map(statement => statement[1]), [shared, later])
            const first = final[2][1].statements[0]
            const second = final[2][1].statements[1]
            assert(first[0] === 'define' && second[0] === 'define')
            assertStructurallySame(first[2], barrier[0] === '()' ? ['()', ['ref', observer], [['ref', alias[1]]]] : barrier)
            assertStructurallySame(second[2], ['array', [['ref', alias[1]]]])
        }
    },
    packedSourceExposesOnlyEstablishedConstructorPrefixes: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const child = /** @type {const} */ ({ kind: 'function', index: 0 })
        const first = id(0), second = id(1), result = id(2), shared = id(3), observer = id(4), later = id(5), held = id(6)
        /** @type {(value: NormalValue, statements?: readonly Definition[]) => readonly Statement[]} */
        const step = (value, statements = []) => {
            const block = prepare({ statements: [['loop', {
                target, parameters: [first, second], initial: [1, 0], results: [result], body: {
                    statements: [['if', [], ['>', ['ref', first], 0],
                        { statements, exit: ['continue', target, [['-', ['ref', first], 1], value]] },
                        { statements: [], exit: ['break', target, [['ref', second]]] },
                    ]], exit: ['yield', []],
                },
            }]], exit: ['yield', [['ref', result]]] }, { sourceLoops: true })
            const physical = block.statements[0]
            assert(physical[0] === 'while')
            return physical[1].body.statements.slice(2)
        }
        /** @type {(value: NormalValue, tail?: NormalValue) => NormalValue} */
        const recipe = (value, tail = ['ref', shared]) => ['block', {
            statements: [['define', shared, value, 'required']], exit: ['yield', [tail]],
        }]
        /** @type {NormalValue} */
        const pair = ['array', [['ref', first], ['ref', second]]]
        /** @type {NormalValue} */
        const observe = ['()', ['ref', observer], [['ref', shared], ['ref', shared]]]
        const exposed = step(recipe(pair, observe))
        assertStructurallySame(exposed[0], ['define', shared, pair])
        assert(exposed[1][0] === 'define')
        // The allocation is total. Arithmetic and the observer keep their
        // argument order, so earlier arithmetic can still fail first.
        assertStructurallySame(exposed[1][2], ['array', [['-', ['ref', first], 1], observe]])

        /** @type {NormalValue} */
        const closure = ['function', { target: child, parameters: [], rest: null, self: null,
            captures: [{ binding: held, value: ['ref', first] }],
            body: { statements: [], exit: ['return', child, ['ref', held]] },
        }]
        for (const value of /** @type {readonly NormalValue[]} */ ([0, ['ref', first], pair, ['object', [[':', 'x', ['ref', first]]]], closure])) {
            assertEq(step(recipe(value))[0][1], shared)
        }
        const nested = step(recipe(pair, ['block', { statements: [['define', later, 1, 'required']], exit: ['yield', [['ref', later]]] }]))
        assertStructurallySame(nested.slice(0, 2).map(statement => statement[1]), [shared, later])
        const partial = step(['block', { statements: [
            ['define', shared, pair, 'required'], ['define', later, ['()', ['ref', observer], []], 'required'],
        ], exit: ['yield', [['ref', later]]] }])
        assertEq(partial[0][1], shared)
        assert(partial[1][0] === 'define' && partial[1][2] instanceof Array && partial[1][2][0] === 'array')
        assertStructurallySame(partial[1][2][1][1], ['block', { statements: [['define', later, ['()', ['ref', observer], []]]], exit: ['yield', [['ref', later]]] }])

        for (const value of /** @type {readonly NormalValue[]} */ ([
            ['()', ['ref', observer], []], ['.', null, 0],
            ['array', [['...', ['ref', first]]]], ['array', [['.', null, 0]]],
            ['object', [['...', ['ref', first]]]], ['object', [[':', ['ref', first], 0]]], ['object', [[':', 'x', ['.', null, 0]]]],
            ['function', { ...closure[1], captures: [{ binding: held, value: ['.', null, 0] }] }],
        ])) {
            assert(!step(recipe(value)).some(statement => statement[0] === 'define' && statement[1] === shared))
        }
        const memo = step(['block', { statements: [['define', shared, pair, 'lazy']], exit: ['yield', [['ref', shared]]] }])
        assert(!memo.some(statement => statement[0] === 'define' && statement[1] === shared))
        const beforeMemo = step(['block', { statements: [
            ['define', shared, pair, 'required'], ['define', later, 1, 'lazy'],
        ], exit: ['yield', [['ref', later]]] }])
        assertEq(beforeMemo[0][1], shared)
        const demanded = step(recipe(['array', [['ref', later]]]), [['define', later, 1, 'lazy']])
        assertEq(demanded[0][0], 'memo')
        assert(!demanded.some(statement => statement[0] === 'define' && statement[1] === shared))
        const detached = step(['()', recipe(pair, ['.', 'abc', 'slice']), [1]])
        assertEq(detached[0][1], shared)
        assert(detached[1][0] === 'define')
        assertStructurallySame(detached[1][2], ['array', [['-', ['ref', first], 1], ['()', ['.', 'abc', 'slice'], [1]]]])
        const callee = step(['block', { statements: [['define', later, recipe(pair, ['.', 'abc', 'slice']), 'required']],
            exit: ['yield', [['()', ['ref', later], [1]]]],
        }])
        assertEq(callee[0][1], shared)
        assert(callee[1][0] === 'define')
        assertStructurallySame(callee[1][2], ['array', [['-', ['ref', first], 1], ['block', {
            statements: [['define', later, ['.', 'abc', 'slice']]], exit: ['yield', [['()', ['ref', later], [1]]]],
        }]]])
        for (const member of /** @type {readonly NormalValue[]} */ ([
            ['.', recipe(pair, 'abc'), 'slice', ['|()', [1]]],
            ['.', 'abc', ['Number', recipe(pair, 0)], ['|()', [1]]],
            ['?.', recipe(pair, 'abc'), 'slice', ['|()', [1]]],
        ])) {
            assertEq(step(member)[0][1], shared)
        }
        const opaque = recipe(pair, 1)
        for (const value of /** @type {readonly NormalValue[]} */ ([
            ['if', ['ref', first], yielding(opaque), yielding(0)],
            ['?.', null, ['Number', opaque]], ['?.()', null, [opaque]], ['.', 'abc', 'slice', ['|()', [opaque]]],
            ['function', { ...closure[1], body: { statements: [], exit: ['return', child, opaque] } }],
            ['block', { statements: [], exit: ['throw', 1] }],
            ['block', { statements: [['block', [], { statements: [], exit: ['throw', 1] }]], exit: ['yield', []] }],
        ])) {
            assert(!step(value).some(statement => statement[0] === 'define' && statement[1] === shared))
        }
    },
    sourcePlainInputsUseOnePackedSlotAndImmutableSnapshots: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const child = /** @type {const} */ ({ kind: 'function', index: 0 })
        const first = id(0), second = id(1), result = id(2), ignored = id(3), held = id(4)
        /** @type {NormalValue} */
        const closure = ['function', { target: child, parameters: [], rest: null, self: null,
            captures: [{ binding: held, value: ['ref', second] }],
            body: { statements: [], exit: ['return', child, ['ref', held]] },
        }]
        /** @type {NormalBlock} */
        const continuing = { statements: [['define', ignored, ['array', [['ref', first], ['ref', second]]], 'required']],
            exit: ['continue', target, [['ref', second], ['ref', first]]] }
        /** @type {NormalBlock} */
        const normal = { statements: [], exit: ['break', target, [closure]] }
        for (const reversed of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const loop = { target, parameters: [first, second], initial: [['array', [9]], 1], results: [result], body: {
                statements: [['if', [], ['<', ['ref', second], 3], reversed ? normal : continuing, reversed ? continuing : normal]],
                exit: ['yield', []],
            } }
            /** @type {NormalBlock} */
            const block = { statements: [['loop', loop]], exit: ['yield', [['ref', result]]] }
            const ordinary = prepare(block)
            assert(!ordinary.statements.some(statement => statement[0] === 'while'))
            assertEq(loopStatement(ordinary)[2].statements.filter(statement => statement[0] === 'if')[0][reversed ? 3 : 2].statements.filter(statement => statement[0] === 'write').length, 2)
            const source = prepare(block, { sourceLoops: true })
            assertStructurallySame(source.statements.map(statement => statement[0]), ['while', 'define'])
            const physical = source.statements[0]
            assert(physical[0] === 'while')
            const { slot } = physical[1]
            assertEq(physical[1].mutable, true)
            assertStructurallySame(physical[1].initial, ['array', [['array', [9]], 1]])
            const condition = physical[1].condition
            assert(condition instanceof Array && condition[0] === 'block')
            assertStructurallySame(condition[1].statements.map(statement => statement[0] === 'define' ? statement[2] : null), [
                ['.', ['ref', slot], 0], ['.', ['ref', slot], 1],
            ])
            assertStructurallySame(physical[1].body.statements.slice(0, 2), [
                ['define', first, ['.', ['ref', slot], 0]], ['define', second, ['.', ['ref', slot], 1]],
            ])
            assertEq(physical[1].body.statements[2][1], ignored)
            const last = physical[1].body.statements.at(-1)
            assert(last !== undefined && last[0] === 'write')
            assertEq(last[1], slot)
            const transfer = physical[1].body.statements.at(-2)
            assert(transfer !== undefined && transfer[0] === 'define')
            assertStructurallySame(transfer[2], ['array', [['ref', second], ['ref', first]]])
            assertStructurallySame(last[2], ['ref', transfer[1]])
            const returned = source.statements[1]
            assert(returned[0] === 'define' && returned[2] instanceof Array && returned[2][0] === 'block')
            const final = returned[2][1]
            assertStructurallySame(final.statements.map(statement => statement[0] === 'define' ? statement[2] : null), [
                ['.', ['ref', physical[1].result], 0], ['.', ['ref', physical[1].result], 1],
            ])
            assert(final.exit[0] === 'yield')
            const value = final.exit[1][0]
            assert(value instanceof Array && value[0] === 'function')
            assertStructurallySame(value[1].captures[0].value, ['ref', final.statements[1][1]])
        }
    },
    zeroInputPlainLoopsUseAnUnchangedPrivateSlot: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const child = /** @type {const} */ ({ kind: 'function', index: 0 })
        const capture = id(0), projected = id(1), ignored = id(2), result = id(3), held = id(4)
        /** @type {Definition} */
        const projection = ['define', projected, ['.', ['ref', capture], 0], 'required']
        /** @type {Definition} */
        const reached = ['define', ignored, ['array', [['ref', projected]]], 'required']
        /** @type {NormalValue} */
        const closure = ['function', { target: child, parameters: [], rest: null, self: null,
            captures: [{ binding: held, value: ['ref', projected] }],
            body: { statements: [], exit: ['return', child, ['ref', held]] },
        }]
        /** @type {NormalBlock} */
        const continuing = { statements: [reached], exit: ['continue', target, []] }
        /** @type {NormalBlock} */
        const normal = { statements: [], exit: ['break', target, [closure]] }
        for (const reversed of /** @type {const} */ ([false, true])) {
            /** @type {Loop} */
            const source = { target, parameters: [], initial: [], results: [result], body: {
                statements: [projection, ['if', [], ['ref', projected], reversed ? normal : continuing, reversed ? continuing : normal]],
                exit: ['yield', []],
            } }
            for (const sourceLoops of /** @type {const} */ ([false, true])) {
                const prepared = prepare({ statements: [['define', capture, ['array', [false]], 'required'], ['loop', source]],
                    exit: ['yield', [['ref', result]]] }, { sourceLoops })
                assertStructurallySame(prepared.statements.map(statement => statement[0]), ['define', 'while', 'define'])
                const physical = prepared.statements[1]
                assert(physical[0] === 'while')
                assertEq(physical[1].initial, undefined)
                assertEq(physical[1].mutable, false)
                assert(physical[1].result !== result)
                assert(physical[1].condition instanceof Array && physical[1].condition[0] === 'block')
                assertEq(physical[1].condition[1].statements.length, 0)
                const conditionExit = physical[1].condition[1].exit
                assert(conditionExit[0] === 'yield')
                const condition = conditionExit[1][0]
                assert(condition instanceof Array && condition[0] === 'block')
                assertStructurallySame(condition[1].statements.map(statement => statement[0] === 'define' ? statement[1] : null), [projected])
                assertStructurallySame(physical[1].body.statements.map(statement => statement[0] === 'define' ? statement[1] : null), [projected, ignored])
                assertStructurallySame(physical[1].body.exit, ['yield', []])
                const returned = prepared.statements[2]
                assert(returned[0] === 'define' && returned[2] instanceof Array && returned[2][0] === 'block')
                assertStructurallySame(returned[2][1].statements.map(statement => statement[0] === 'define' ? statement[1] : null), [projected])
                const exit = returned[2][1].exit
                assert(exit[0] === 'yield')
                const value = exit[1][0]
                assert(value instanceof Array && value[0] === 'function')
                assertEq(value[1].parameters.length, 0)
                assertStructurallySame(value[1].captures[0].value, ['ref', projected])
            }
        }
    },
    sourceLoopProfileSharesStateAndResultStorage: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const parameter = id(0), result = id(1)
        const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [0], results: [result], body: {
            statements: [['if', [], ['<', ['ref', parameter], 3], {
                statements: [['if', [], ['===', ['ref', parameter], 0],
                    { statements: [], exit: ['continue', target, [['+', ['ref', parameter], 1]]] },
                    { statements: [], exit: ['continue', target, [['+', ['ref', parameter], 2]]] },
                ]], exit: ['yield', []],
            }, { statements: [], exit: ['break', target, [['ref', parameter]]] }]], exit: ['yield', []],
        } })
        const block = /** @type {NormalBlock} */ ({ statements: [['loop', loop]], exit: ['yield', [['ref', result]]] })
        const ordinary = prepare(block)
        assert(ordinary.statements.some(statement => statement[0] === 'loop'))
        const source = prepare(block, { sourceLoops: true })
        assertStructurallySame(source.statements.map(statement => statement[0]), ['define', 'while'])
        const physical = source.statements[1]
        assert(physical[0] === 'while')
        assertEq(physical[1].result, result)
        assertEq(physical[1].condition, true)
        assertEq(physical[1].mutable, true)
        const branch = physical[1].body.statements[1]
        assert(branch[0] === 'if')
        const nested = branch[2].statements[0]
        assert(nested[0] === 'if')
        for (const arm of [nested[2], nested[3], branch[3]]) {
            const transfer = arm.statements.at(-1)
            assert(transfer !== undefined && transfer[0] === 'write')
            assertEq(transfer[1], physical[1].slot)
            assert(arm.exit[0] === 'continue' || arm.exit[0] === 'break')
            assertEq(arm.exit[1], target)
        }
        const empty = /** @type {Loop} */ ({ target, parameters: [], initial: [], results: [], body: { statements: [], exit: ['break', target, []] } })
        assert(prepare({ statements: [['loop', empty]], exit: ['yield', []] }, { sourceLoops: true }).statements.some(statement => statement[0] === 'loop'))
        const pair = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [0], results: [result, id(2)], body: { statements: [], exit: ['break', target, [1, 2]] } })
        assert(prepare({ statements: [['loop', pair]], exit: ['yield', []] }, { sourceLoops: true }).statements.some(statement => statement[0] === 'loop'))
    },
    sourceFunctionCompletionKeepsInfiniteInvocationRoots: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const input = id(0), parameter = id(1), result = id(2)
        const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [['ref', input]], results: [result], body: { statements: [], exit: ['continue', target, [['ref', parameter]]] } })
        const fn = /** @type {NormalFunction} */ ({ target: owner, parameters: [input], rest: null, self: null, captures: [], body: { statements: [['loop', loop]], exit: ['return', owner, ['ref', result]] } })
        const prepared = prepare({ statements: [], exit: ['yield', [['function', fn]]] }, { sourceLoops: true })
        const value = prepared.exit[0] === 'yield' ? prepared.exit[1][0] : null
        assert(value instanceof Array && value[0] === 'function')
        const physical = value[1].body.statements.at(-1)
        assert(physical !== undefined && physical[0] === 'while')
        assertStructurallySame(value[1].body.exit, ['return', owner, ['ref', physical[1].result]])
        const normal = /** @type {NormalFunction} */ ({ ...fn, body: { statements: [], exit: ['yield', []] } })
        const ordinary = prepare({ statements: [], exit: ['yield', [['function', normal]]] }, { sourceLoops: true })
        const empty = ordinary.exit[0] === 'yield' ? ordinary.exit[1][0] : null
        assert(empty instanceof Array && empty[0] === 'function')
        assertStructurallySame(empty[1].body.exit, ['yield', []])
        const returning = /** @type {NormalFunction} */ ({ ...fn, body: { statements: [], exit: ['return', owner, 7] } })
        const complete = prepare({ statements: [], exit: ['yield', [['function', returning]]] }, { sourceLoops: true })
        const returned = complete.exit[0] === 'yield' ? complete.exit[1][0] : null
        assert(returned instanceof Array && returned[0] === 'function')
        assertStructurallySame(returned[1].body.exit, ['return', owner, 7])
    },
    plainLoopProjectionRegionsAndFinalSnapshot: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), result = id(1), count = id(2), alias = id(3), unused = id(4)
        const prefix = /** @type {readonly Definition[]} */ ([
            ['define', count, ['.', ['ref', state], 0], 'required'],
            ['define', alias, ['ref', count], 'required'],
            ['define', unused, ['.', ['ref', state], 1], 'required'],
        ])
        const source = /** @type {Loop} */ ({ target, parameters: [state], initial: [['array', [0, 7]]], results: [result], body: {
            statements: [...prefix, ['if', [], ['<', ['ref', alias], 3],
                { statements: [], exit: ['continue', target, [['array', [['+', ['ref', alias], 1], 7]]]] },
                { statements: [], exit: ['break', target, [['array', [['ref', alias]]]]] },
            ]], exit: ['yield', []],
        } })
        const prepared = prepare({ statements: [['loop', source]], exit: ['yield', [['ref', result]]] })
        assertStructurallySame(prepared.statements.map(statement => statement[0]), ['while', 'define'])
        const statement = prepared.statements[0]
        assert(statement[0] === 'while')
        assertEq(statement[1].mutable, true)
        assert(statement[1].result !== result)
        assert(statement[1].body.statements.some(statement => statement[0] === 'define' && statement[1] === count))
        assert(statement[1].body.statements.some(statement => statement[0] === 'define' && statement[1] === alias))
        assert(!statement[1].body.statements.some(statement => statement[0] === 'define' && statement[1] === unused))
        const normal = prepared.statements[1]
        assert(normal[0] === 'define' && normal[2] instanceof Array && normal[2][0] === 'block')
        const snapshot = normal[2][1].statements[0]
        assert(snapshot[0] === 'define')
        assertStructurallySame(snapshot[2], ['ref', statement[1].result])
        assert(!normal[2][1].statements.some(statement => statement[0] === 'define' && statement[1] === unused))
    },
    unchangedPlainResultNeedsNoPostlude: () => {
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), result = id(1), unused = id(2)
        const source = /** @type {Loop} */ ({ target, parameters: [state], initial: [['array', [0]]], results: [result], body: {
            statements: [['define', unused, ['.', ['ref', state], 0], 'required'], ['if', [], false,
                { statements: [], exit: ['continue', target, [['ref', state]]] },
                { statements: [], exit: ['break', target, [['ref', state]]] },
            ]], exit: ['yield', []],
        } })
        const prepared = prepare({ statements: [['loop', source]], exit: ['yield', [['ref', result]]] })
        assertStructurallySame(prepared.statements.map(statement => statement[0]), ['while'])
        const statement = prepared.statements[0]
        assert(statement[0] === 'while')
        assertEq(statement[1].result, result)
        assertEq(statement[1].mutable, false)
        assertEq(statement[1].body.statements.length, 1)
    },
    outwardPlainOperandsKeepGeneralPreparation: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const state = id(0), result = id(1), projected = id(2), effect = id(3)
        const escape = /** @type {NormalValue} */ (['block', { statements: [], exit: ['return', owner, 7] }])
        for (const field of /** @type {const} */ (['condition', 'next', 'result', 'prefix', 'step'])) {
            const source = /** @type {Loop} */ ({ target, parameters: [state], initial: [['array', [0]]], results: [result], body: {
                statements: [
                    ['define', projected, ['.', ['ref', state], 0], 'required'],
                    ...field === 'prefix' ? [/** @type {Definition} */ (['define', effect, escape, 'required'])] : [],
                    ['if', [], field === 'condition' ? escape : false,
                        { statements: field === 'step' ? [['define', effect, escape, 'required']] : [], exit: ['continue', target, [field === 'next' ? escape : ['ref', state]]] },
                        { statements: [], exit: ['break', target, [field === 'result' ? escape : 9]] },
                    ],
                ], exit: ['yield', []],
            } })
            const prepared = prepareFunction({ target: owner, parameters: [], rest: null, self: null, captures: [], body: {
                statements: [['loop', source]], exit: ['return', owner, ['ref', result]],
            } })
            assert(prepared.body.statements.some(statement => statement[0] === 'loop'), field)
            assert(!prepared.body.statements.some(statement => statement[0] === 'while'), field)
        }
    },
    memberReturnOperands: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        /** @type {NormalValue} */
        const choice = ['if', ['ref', id(100)],
            { statements: [], exit: ['return', target, 7] }, yielding(1)]
        /** @type {(block: Block) => boolean} */
        const keepsReturn = block => (block.exit[0] === 'return' && block.exit[1] === target && block.exit[2] === 7)
            || block.statements.some(statement => statement[0] === 'block' ? keepsReturn(statement[1])
                : statement[0] === 'if' ? keepsReturn(statement[2]) || keepsReturn(statement[3]) : false)
        for (const value of /** @type {readonly NormalValue[]} */ ([
            ['.', 'abc', 'slice', ['|()', [choice]]],
            ['?.', 'abc', 'slice', ['|()', [choice]]],
            ['()', ['.', 'abc', 'slice'], [choice]],
            ['()', ['.', choice, 'slice'], [1]],
            ['object', [['...', ['object', [[':', 'a', 1]]]], [':', 'value', choice]]],
            ['object', [[':', 'a', 1], [':', 'value', choice]]],
            ['array', [['...', ['array', [1]]], choice]],
            ['()', ['ref', id(101)], [['...', ['array', [1]]], choice]],
        ])) {
            const prepared = prepareFunction({ target, parameters: [id(100), id(101)], rest: null,
                self: null, captures: [], body: { statements: [], exit: ['return', target, value] } })
            assertEq(prepared.body.exit[0], 'return')
            assert(keepsReturn(prepared.body), { value, prepared })
        }
    },
    unconditionalTailLoopsHaveNoResultSuffix: () => {
        for (const arity of /** @type {const} */ ([0, 1, 2])) {
            const fn = _tailFunction(['=>', arity, [], ['()', ['self'], Array.from({ length: arity }, (_, index) => ['arg', index])]])
            const prepared = prepareFunction(fn)
            assertEq(prepared.parameters.length, arity)
            assertStructurallySame(prepared.body.exit, ['yield', []])
            const loop = loopStatement(prepared.body)
            assertEq(prepared.body.statements.at(-1), loop)
            assertStructurallySame(loop[2].exit, ['continue', loop[1]])
            assertEq(prepared.body.statements.filter(statement => statement[0] === 'slot').length, arity)
        }
    },
    allTailBranchesAndThrowingBasesHaveNoResultSuffix: () => {
        const call = /** @type {const} */ (['()', ['self'], [['arg', 0]]])
        for (const otherwise of /** @type {const} */ ([['()', ['self'], [['arg', 0]]], ['throw', 'terminal tail base']])) {
            const prepared = prepareFunction(_tailFunction(['=>', 1, [], ['?:', ['arg', 0], call, otherwise]]))
            assertStructurallySame(prepared.body.exit, ['yield', []])
            assertEq(prepared.body.statements.at(-1)?.[0], 'loop')
            assertEq(prepared.body.statements.filter(statement => statement[0] === 'slot').length, 1)
        }
    },
    failingBaseExpressionsKeepTheirSyntacticBreakResult: () => {
        const fn = _tailFunction(['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1]]], ['=>', 0, [['throw', 1]], ['frame', 0]]]])
        const prepared = prepareFunction(fn)
        assertEq(prepared.body.exit[0], 'return')
        assertEq(prepared.body.statements.at(-1)?.[0], 'define')
        assertEq(prepared.body.statements.filter(statement => statement[0] === 'slot').length, 2)
    },
    onlyReachedBreaksOfTheExactLoopCanFinishIt: () => {
        const outer = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const result = id(0)
        const nested = /** @type {Loop} */ ({ target: inner, parameters: [], initial: [], results: [], body: { statements: [], exit: ['break', inner, []] } })
        const source = /** @type {Loop} */ ({ target: outer, parameters: [], initial: [], results: [result], body: {
            statements: [
                ['loop', nested],
                ['if', [], true, { statements: [], exit: ['continue', outer, []] }, { statements: [], exit: ['continue', outer, []] }],
            ],
            exit: ['break', outer, [7]],
        } })
        const prepared = prepare({ statements: [['loop', source]], exit: ['yield', [['ref', result]]] })
        assertStructurallySame(prepared.statements.map(statement => statement[0]), ['loop'])
        assertStructurallySame(prepared.exit, ['yield', []])
        const loop = loopStatement(prepared)
        assertStructurallySame(loop[2].statements.map(statement => statement[0]), ['loop', 'if'])
        assertStructurallySame(loop[2].exit, ['yield', []])
    },
    deferredReturnKeepsItsFunctionOwner: () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const deferred = id(0)
        /** @type {NormalFunction} */
        const source = { target, parameters: [], rest: null, self: null, captures: [], body: {
            statements: [['define', deferred, ['block', { statements: [], exit: ['return', target, 7] }], 'lazy']],
            exit: ['return', target, ['ref', deferred]],
        } }
        const prepared = prepareFunction(source)
        assertEq(prepared.target, target)
        assertEq(prepared.parameters, source.parameters)
        assertEq(prepared.body.exit[0], 'return')
        const recipes = prepared.body.statements.flatMap(statement => statement[0] === 'define'
            && statement[2] instanceof Array && statement[2][0] === 'function' ? [statement[2][1]] : [])
        assertEq(recipes.length, 1)
        assert(recipes[0].target !== target)
        assertEq(recipes[0].body.exit[0], 'return')
        assert(recipes[0].body.exit[0] === 'return' && recipes[0].body.exit[1] === recipes[0].target)
        assert(prepared.body.statements.some(statement => statement[0] === 'if'))
    },
    deepSyntax: () => {
        for (const tag of /** @type {const} */ (['!', '+', '.'])) {
            /** @type {NormalValue} */
            let input = 3
            for (let depth = 0; depth < 20_000; depth += 1) {
                input = tag === '!' ? ['!', input] : tag === '+' ? ['+', input, 1] : ['.', input, 'x']
            }
            const block = prepare(yielding(input))
            assert(block.exit[0] === 'yield')
            let value = block.exit[1][0]
            let depth = 0
            while (value instanceof Array && value[0] === tag) { value = value[1]; depth += 1 }
            assertEq(depth, 20_000)
            assertEq(value, 3)
        }
        /** @type {NormalValue} */
        let input = 3
        for (let depth = 0; depth < 20_000; depth += 1) {
            input = ['block', { statements: [['define', id(depth), depth, 'required']], exit: ['yield', [input]] }]
        }
        const block = prepare(yielding(input))
        assert(block.exit[0] === 'yield')
        /** @type {Value} */
        let value = block.exit[1][0]
        let depth = 0
        while (value instanceof Array && value[0] === 'block') {
            assertEq(value[1].statements.length, 1)
            const statement = value[1].statements[0]
            assert(statement[0] === 'define')
            assertEq(statement[2], 19_999 - depth)
            const exit = value[1].exit
            assert(exit[0] === 'yield')
            value = exit[1][0]
            depth += 1
        }
        assertEq(depth, 20_000)
        assertEq(value, 3)
    },
    values: () => {
        assertStructurallySame(prepare(yielding(4)), yielding(4))
        const binding = id(0)
        const block = prepare({ statements: [['define', binding, ['+', 2, 3], 'required']], exit: ['yield', [['ref', binding]]] })
        assertStructurallySame(block, { statements: [['define', binding, ['+', 2, 3]]], exit: ['yield', [['ref', binding]]] })
        assertStructurallySame(prepare(yielding(['block', yielding(3)])), yielding(['block', yielding(3)]))
        assertStructurallySame(prepare(yielding(['if', true, yielding(1), yielding(2)])), yielding(['if', true, yielding(1), yielding(2)]))
        assertStructurallySame(prepare(yielding(['?:', false, 1, 2])), yielding(['if', false, yielding(1), yielding(2)]))
        assertStructurallySame(prepare(yielding(['memberPresent', ['ref', binding], ['Number', ['+', 1, 2]]])), yielding(['memberPresent', ['ref', binding], ['Number', ['+', 1, 2]]]))
        assertStructurallySame(prepare({ statements: [], exit: ['throw', 9] }), { statements: [], exit: ['throw', 9] })
    },
    memoLifetime: () => {
        const a = id(0)
        const b = id(1)
        const capture = id(2)
        const nested = id(3)
        const parameter = id(4)
        const rest = id(5)
        const self = id(6)
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        /** @type {NormalFunction} */
        const fn = {
            target,
            parameters: [parameter], rest, self,
            captures: [{ binding: capture, value: ['ref', b] }],
            body: { statements: [['define', nested, ['array', [['ref', capture]]], 'lazy']], exit: ['return', target, ['ref', nested]] },
        }
        const result = prepare({
            statements: [['define', a, 1, 'required'], ['define', b, ['+', ['ref', a], 2], 'lazy']],
            exit: ['yield', [['function', fn]]],
        })
        const memo = result.statements[1]
        assert(memo[0] === 'memo')
        assertEq(memo[1].binding, b)
        assertStructurallySame(memo[1].initializer, yielding(['+', ['ref', a], 2]))
        const value = result.exit
        assert(value[0] === 'yield')
        const functionValue = value[1][0]
        assert(functionValue instanceof Array && functionValue[0] === 'function')
        assertStructurallySame(functionValue[1].captures, [{ binding: capture, value: ['demand', b] }])
        assertEq(functionValue[1].body.statements[0][0], 'memo')
        assertStructurallySame(functionValue[1].body.exit, ['return', target, ['demand', nested]])
        assertEq(functionValue[1].parameters[0], parameter)
        assertEq(functionValue[1].rest, rest)
        assert(functionValue[1].self !== null && functionValue[1].self !== self)
        assertEq(functionValue[1].self.index, self.index)
        assertEq(memo[1].valueSlot.index, 7)
        assertEq(memo[1].doneSlot.index, 8)
        const direct = prepareFunction({ target, parameters: [], rest: null, self: null, captures: [], body: yielding(undefined) })
        assertStructurallySame(direct.body, yielding(undefined))
    },
    resultSlots: () => {
        const first = id(0)
        const second = id(1)
        const last = id(2)
        const result = prepare({
            statements: [
                ['block', [first, second], { statements: [], exit: ['yield', [2, 3]] }],
                ['if', [last], true, yielding(['ref', first]), yielding(['ref', second])],
            ],
            exit: ['yield', [['ref', last]]],
        })
        assertStructurallySame(result.statements.map(statement => statement[0]), ['slot', 'slot', 'block', 'define', 'define', 'slot', 'if', 'define'])
        const child = result.statements[2]
        assert(child[0] === 'block')
        assertStructurallySame(child[1].statements.map(statement => statement[0]), ['define', 'define', 'write', 'write'])
        assertStructurallySame(child[1].exit, ['yield', []])
        const conditional = result.statements[6]
        assert(conditional[0] === 'if')
        assertStructurallySame(conditional[2].statements.map(statement => statement[0]), ['define', 'write'])
        assertStructurallySame(conditional[3].statements.map(statement => statement[0]), ['define', 'write'])
    },
    parallelLoop: () => {
        const a = id(0)
        const b = id(1)
        const result = id(2)
        const functionTarget = { kind: /** @type {const} */ ('function'), index: 0 }
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        const output = prepare({
            statements: [['loop', {
                target, parameters: [a, b], initial: [1, 2], results: [result],
                body: {
                    statements: [['if', [], ['<', ['ref', a], 3],
                        { statements: [], exit: ['continue', target, [['ref', b], ['+', ['ref', a], ['ref', b]]]] },
                        { statements: [], exit: ['break', target, [['ref', a]]] },
                    ]],
                    exit: ['return', functionTarget, 0],
                },
            }]],
            exit: ['yield', [['ref', result]]],
        })
        const loop = loopStatement(output)
        assertEq(loop[1], target)
        assertStructurallySame(loop[2].statements.slice(0, 2).map(statement => statement[0]), ['define', 'define'])
        const conditional = loop[2].statements[2]
        assert(conditional[0] === 'if')
        const next = conditional[2]
        assertStructurallySame(next.statements.map(statement => statement[0]), ['define', 'define', 'write', 'write'])
        assertStructurallySame(next.exit, ['continue', target])
        assertStructurallySame(conditional[3].exit, ['break', target])
        assertStructurallySame(loop[2].exit, ['yield', []])
        assertEq(loop[2].statements[0][1], a)
        assertEq(loop[2].statements[1][1], b)
    },
    scalarWhile: () => {
        const parameter = id(0)
        const result = id(1)
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        const output = prepare({ statements: [['loop', scalar(target, parameter, result, ['+', ['ref', parameter], 1])]], exit: ['yield', [['ref', result]]] })
        const statement = output.statements[0]
        assert(statement[0] === 'while')
        assertEq(statement[1].result, result)
        assertEq(statement[1].mutable, true)
        assertStructurallySame(statement[1].body.statements.map(statement => statement[0]), ['define', 'define', 'write'])
        assertEq(statement[1].body.statements[0][1], parameter)
        const unchanged = prepare({ statements: [['loop', scalar(target, parameter, result, ['ref', parameter])]], exit: ['yield', [['ref', result]]] }).statements[0]
        assert(unchanged[0] === 'while')
        assertEq(unchanged[1].mutable, false)
        assertStructurallySame(unchanged[1].body.statements.map(statement => statement[0]), ['define'])
        const local = id(2)
        const withDefinition = prepare({ statements: [['loop', scalar(target, parameter, result, ['ref', local], [['define', local, ['+', ['ref', parameter], 1], 'required']])]], exit: ['yield', [['ref', result]]] }).statements[0]
        assert(withDefinition[0] === 'while')
        assertStructurallySame(withDefinition[1].body.statements.map(statement => statement[0]), ['define', 'define', 'define', 'write'])
        const input = id(3)
        const prior = id(4)
        const priorTarget = { kind: /** @type {const} */ ('loop'), index: 1 }
        const sequence = prepare({ statements: [
            ['loop', { target: priorTarget, parameters: [input], initial: [1], results: [prior], body: { statements: [], exit: ['break', priorTarget, [['ref', input]]] } }],
            ['loop', scalar(target, parameter, result, ['+', ['ref', parameter], 1])],
        ], exit: ['yield', [['ref', result]]] })
        const slots = sequence.statements.filter(statement => statement[0] === 'slot')
        assertStructurallySame(slots.map(statement => statement[3]), [false, true])
    },
    nonlocalResult: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const binding = id(0)
        /** @type {NormalValue} */
        const abrupt = ['block', { statements: [], exit: ['return', target, 8] }]
        const output = prepare({ statements: [['define', binding, ['+', ['()', ['entry'], []], abrupt], 'required']], exit: ['return', target, ['ref', binding]] })
        assertStructurallySame(output.statements.map(statement => statement[0]), ['define', 'slot', 'block', 'define'])
        const block = output.statements[2]
        assert(block[0] === 'block')
        assertStructurallySame(block[1].exit, ['return', target, 8])
        for (const then of [true, false]) {
            const lazy = prepare(yielding(['if', true, yielding(then ? abrupt : 0), yielding(then ? 0 : abrupt)]))
            assertStructurallySame(lazy.statements.map(statement => statement[0]), ['slot', 'if'])
            const branch = lazy.statements[1]
            assert(branch[0] === 'if')
            const selected = then ? branch[2] : branch[3]
            assertStructurallySame(selected.statements.map(statement => statement[0]), ['slot', 'block', 'define', 'write'])
        }
        const conditional = prepare(yielding(['if', true, { statements: [], exit: ['return', target, 3] }, yielding(4)]))
        assertStructurallySame(conditional.statements.map(statement => statement[0]), ['slot', 'if'])
        const branch = conditional.statements[1]
        assert(branch[0] === 'if')
        assertStructurallySame(branch[2].exit, ['return', target, 3])
        assertStructurallySame(branch[3].statements.map(statement => statement[0]), ['define', 'write'])
    },
    nestedRegions: () => {
        const a = id(0)
        const b = id(1)
        const c = id(2)
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        /** @type {NormalFunction} */
        const fn = { target, parameters: [], rest: null, self: null, captures: [{ binding: c, value: 1 }], body: { statements: [], exit: ['return', target, ['ref', c]] } }
        /** @type {NormalBlock} */
        const normal = {
            statements: [
                ['define', c, ['function', fn], 'required'],
                ['block', [], { statements: [], exit: ['yield', []] }],
                ['if', [], false, { statements: [], exit: ['yield', []] }, { statements: [], exit: ['yield', []] }],
                ['loop', { target: loop, parameters: [a], initial: [0], results: [b], body: { statements: [], exit: ['break', loop, [['ref', a]]] } }],
            ],
            exit: ['yield', [['if', true, yielding(1), yielding(2)]]],
        }
        const prepared = prepare(yielding(['block', normal]))
        assertEq(prepared.statements.length, 0)
        assert(prepared.exit[0] === 'yield')
        assertEq(/** @type {readonly ['block', Block]} */ (prepared.exit[1][0])[0], 'block')
        /** @type {NormalBlock} */
        const returning = { statements: [], exit: ['return', target, 3] }
        /** @type {readonly NormalBlock[]} */
        const abrupt = [
            { statements: [['define', a, ['block', returning], 'required']], exit: ['yield', [0]] },
            { statements: [['block', [], returning]], exit: ['yield', [0]] },
            { statements: [['if', [], false, yielding(0), returning]], exit: ['yield', [0]] },
            { statements: [['loop', { target: loop, parameters: [a], initial: [['block', returning]], results: [b], body: { statements: [], exit: ['break', loop, [['ref', a]]] } }]], exit: ['yield', [0]] },
        ]
        for (const block of abrupt) {
            assertEq(prepare(yielding(['block', block])).statements[0][0], 'slot')
        }
        const capture = prepare(yielding(['function', { ...fn, captures: [{ binding: c, value: ['block', returning] }] }]))
        assertStructurallySame(capture.statements.map(statement => statement[0]), ['slot', 'block'])
        const conditional = prepare(yielding(['if', ['block', returning], yielding(1), yielding(2)]))
        assertStructurallySame(conditional.statements.map(statement => statement[0]), ['slot', 'block'])
        const alternative = prepare(yielding(['if', false, yielding(1), returning]))
        assertStructurallySame(alternative.statements.map(statement => statement[0]), ['slot', 'if'])
        const fail = prepare(yielding(['block', { statements: [], exit: ['throw', ['block', yielding(2)]] }]))
        assertEq(fail.statements.length, 0)
    },
    retainedChains: () => {
        /** @type {readonly NormalValue[]} */
        const values = [
            ['if', true, yielding(1), yielding(0)],
            ['if', false, yielding(0), yielding(2)],
            ['if', ['if', ['===', undefined, null], yielding(true), yielding(['===', undefined, undefined])], yielding(3), yielding(undefined)],
            ['?.', null, 'x'], ['?.()', undefined, [1]],
            ['.', ['object', []], 'x'], ['.', ['object', []], 'x', ['|()', []]],
        ]
        for (const value of values) { assertEq(prepare(yielding(value)).statements.length, 0) }
    },
    loopValueTransfers: () => {
        const a = id(0)
        const b = id(1)
        const local = id(2)
        const result = id(3)
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        /** @type {NormalBlock} */
        const block = {
            statements: [['loop', {
                target, parameters: [a, b], initial: [0, 1], results: [result],
                body: {
                    statements: [['define', local, ['block', { statements: [], exit: ['continue', target, [['ref', b], ['ref', a]]] }], 'required']],
                    exit: ['break', target, [['ref', a]]],
                },
            }]],
            exit: ['yield', [['ref', result]]],
        }
        const loop = loopStatement(prepare(block))
        assertStructurallySame(loop[2].statements.map(statement => statement[0]), ['define', 'define', 'slot', 'block', 'define', 'define', 'write'])
        const transfer = loop[2].statements[3]
        assert(transfer[0] === 'block')
        assertStructurallySame(transfer[1].exit, ['continue', target])
        /** Direct member calls preserve the active physical loop target. */
        const escapingCall = scalar(target, a, result, ['()', ['.', 'abc', 'slice'],
            [['block', { statements: [], exit: ['break', target, [9]] }]]])
        assertEq(loopStatement(prepare({ statements: [['loop', escapingCall]], exit: ['yield', []] }))[1], target)
        const modified = scalar(target, a, result, ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }])
        assertEq(loopStatement(prepare({ statements: [['loop', modified]], exit: ['yield', []] }))[1], target)
        const setup = scalar(target, a, result, ['ref', a], [['define', local, ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }], 'required']])
        assertEq(loopStatement(prepare({ statements: [['loop', setup]], exit: ['yield', []] }))[1], target)
    },
    throw: {
        // A statement no case names is refused, not read as an exit.
        unknownStatement: () => prepare({ statements: [/** @type {never} */ (['bogus'])], exit: ['yield', []] }),
        deferredOptionalKey: () => prepare(yielding(['?.', null, ['Number', ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]])),
        deferredOptionalCall: () => prepare(yielding(['?.()', undefined, [['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]])),
        deferredMemberCall: () => prepare(yielding(['.', ['object', []], 'x', ['|()', [['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]]])),
        nonlocalLazyDefinition: () => prepare({ statements: [['define', id(0), ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }], 'lazy']], exit: ['yield', [0]] }),
    },
}
