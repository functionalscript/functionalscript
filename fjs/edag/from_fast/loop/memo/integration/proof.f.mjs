/**
 * @import { Function as FastFunction, Loop, Statement, Value } from '../../../../../js/ast/types.ts'
 * @import { Exp } from '../../../../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../../asserts/module.f.js'
import { anchored, fromFast, lowerValue } from '../../../module.f.mjs'
import { identityAnalysis } from '../../../../analysis/module.f.mjs'
import { memo } from '../../../../memo/module.f.mjs'
import { toFast } from '../../../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _afterLoop as afterLoop, _body as body, _summing as summing, _calledFunction as calledFunction, _counting as counting, _evaluate as evaluate, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../../../proof.f.mjs'

export const proof = /** @type {const} */ ({
    loopMemoTerminalReturnsIgnoreUnsupportedSuffix: () => {
        const selected = id(0), prerequisite = id(0), dependent = id(0)
        const source = collectingMemo(ref(dependent))
        const loop = /** @type {Loop} */ ({ ...source, body: body(['return', target, ref(dependent)]) })
        for (const wrapped of /** @type {const} */ ([false, true])) {
            const terminal = /** @type {Statement} */ (wrapped
                ? ['block', [], body(['return', target, ['?:', ref(selected), 7, 8]])]
                : ['if', [], ref(selected), body(['return', target, 7]), body(['return', target, 8])])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [
                    terminal,
                    ['define', prerequisite, ['array', [4]], 'lazy'],
                    ['define', dependent, ref(prerequisite), 'lazy'],
                    ['loop', loop],
                ]),
            })
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            assertEq(evaluate(calledFunction(fn, [false])), 8)
        }
    },
    loopMemoTerminalThrowsIgnoreUnsupportedSuffix: () => {
        const prerequisite = id(0), dependent = id(0)
        const loop = collectingMemo(ref(dependent))
        for (const selected of /** @type {const} */ ([false, true])) {
            const terminal = /** @type {Statement} */ (['if', [], selected,
                body(['throw', 'selected terminal']), body(['throw', 'other terminal']),
            ])
            for (const wrapped of /** @type {const} */ ([false, true])) {
                const region = wrapped ? /** @type {Statement} */ (['block', [], body(['yield', []], [terminal])]) : terminal
                const graph = fromFast(result(9, [
                    ['define', prerequisite, ['array', [4]], 'lazy'],
                    ['define', dependent, ['array', [ref(prerequisite)]], 'lazy'],
                    region, ['loop', loop],
                ]))
                assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), selected ? 'selected terminal' : 'other terminal')
            }
        }
    },
    loopMemoTerminalHelperSkipsNestedSuffix: () => {
        const lazy = id(0), output = id(0)
        const inner = collectingMemo(ref(lazy))
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [['.', null, 'dead exit']]], [
                ['block', [], body(['break', loopTarget, [ref(lazy)]])],
                ['loop', inner],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(output), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    loopMemoSkippedDemands: () => {
        const lazy = id(0)
        const loop = collectingMemo(ref(lazy), 3, false)
        const definitions = /** @type {readonly Statement[]} */ ([['define', lazy, ['.', null, 'x'], 'lazy']])
        assertEq(evaluate(fromFast(result(7, [...definitions, ['loop', loop]]))), 7)
        const selected = id(0)
        assertEq(evaluate(fromFast(result(ref(selected), [...definitions, [
            'if', [selected], false, afterLoop(loop, 1), result(9),
        ]]))), 9)
    },
    loopMemoZeroIterations: () => {
        const lazy = id(0)
        const loop = collectingMemo(ref(lazy), 0)
        const block = result(['array', [ref(loop.results[0]), ref(lazy), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
        ])
        const value = evaluate(fromFast(block))
        assert(value instanceof Array)
        assertEq(value[0], null)
        assertEq(value[1], value[2])
        assertStructurallySame(value[1], [4])
        const bad = /** @type {readonly Statement[]} */ ([['define', lazy, ['.', null, 'x'], 'lazy'], ['loop', loop]])
        assertEq(evaluate(fromFast(result(7, bad))), 7)
        assertError(memo(assertOk(identityAnalysis(fromFast(result(ref(lazy), bad)))))({ args: [] }))
    },
    loopMemoZeroSignature: () => {
        const lazy = id(0), observed = id(0), failed = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [],
            body: body(['break', loopTarget, []], [['define', observed, ref(lazy), 'required']]),
        })
        assertEq(evaluate(fromFast(result(7, [['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]]))), 7)
        const bad = fromFast(result(7, [['define', lazy, ['.', null, 'x'], 'lazy'], ['loop', loop]]))
        assertError(memo(assertOk(identityAnalysis(bad)))({ args: [] }))
        const required = /** @type {Loop} */ ({ ...loop, body: body(['break', loopTarget, []], [
            ['define', failed, ['.', null, 'x'], 'required'], ...loop.body.statements,
        ]) })
        const requiredGraph = fromFast(result(7, [['define', lazy, ['array', [4]], 'lazy'], ['loop', required]]))
        assertError(memo(assertOk(identityAnalysis(requiredGraph)))({ args: [] }))
    },
    loopMemoIdentityAcrossIterations: () => {
        const lazy = id(0)
        const loop = collectingMemo(ref(lazy))
        const output = ref(loop.results[0])
        const block = result(['array', [collectedMemo(output, 2), collectedMemo(output, 1), collectedMemo(output), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
        ])
        const value = evaluate(fromFast(block))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[0], value[3])
        const second = fromFast(assertOk(toFast(fromFast(block))))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        const repeated = evaluate(third)
        assert(repeated instanceof Array)
        assertEq(repeated[0], repeated[3])
    },
    loopMemoFreshInvocations: () => {
        const lazy = id(0), fnBinding = id(0), first = id(0), second = id(0)
        const loop = collectingMemo(ref(lazy), 2)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(lazy)]]], [
                ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [
            ['.', ref(first), 0], ['.', ref(first), 1], ['.', ref(second), 0], ['.', ref(second), 1],
        ]], [
            ['define', fnBinding, ['function', fn], 'required'],
            ['define', first, ['()', ref(fnBinding), []], 'required'],
            ['define', second, ['()', ref(fnBinding), []], 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[2], value[3])
        assert(value[0] !== value[2])
    },
    loopMemoCellOrderAndAliases: () => {
        const first = id(0), second = id(0), alias = id(0)
        const loop = collectingMemo(['array', [ref(second), ref(alias), ref(first)]], 2)
        const output = ref(loop.results[0])
        const value = evaluate(fromFast(result(['array', [collectedMemo(output, 1), collectedMemo(output), ref(first), ref(second), ref(alias)]], [
            ['define', first, ['array', ['A']], 'lazy'],
            ['define', second, ['array', ['B']], 'lazy'],
            ['define', alias, ref(first), 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[['B'], ['A'], ['A']], [['B'], ['A'], ['A']], ['A'], ['B'], ['A']])
        assertEq(value[0][0], value[3])
        assertEq(value[0][1], value[2])
        assertEq(value[0][2], value[2])
        assertEq(value[1][0], value[3])
        assertEq(value[1][1], value[2])
        assertEq(value[2], value[4])
        assert(value[0] !== value[1])
    },
    loopMemoEstablishedPrerequisites: () => {
        const prerequisite = id(0), lazy = id(0)
        const loop = collectingMemo(ref(lazy), 2)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy), ref(prerequisite),
        ]], [
            ['define', prerequisite, ['array', [3]], 'required'],
            ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[3]], [[3]], [[3]], [3]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[0][0], value[3])
    },
    loopMemoConditionalRegions: () => {
        const choice = id(0), lazy = id(0), selected = id(0)
        for (const useBlock of [false, true]) {
            const demand = useBlock ? /** @type {Value} */ (['block', body(['yield', [ref(selected)]], [
                ['if', [selected], ref(choice), result(ref(lazy)), result(null)],
            ])]) : /** @type {Value} */ (['if', ref(choice), result(ref(lazy)), result(null)])
            const loop = collectingMemo(demand, 2)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [choice], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy)]]], [
                    ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
                ]),
            })
            const skipped = evaluate(calledFunction(fn, [false]))
            assertStructurallySame(skipped, [null, null, [4]])
            const reached = evaluate(calledFunction(fn, [true]))
            assert(reached instanceof Array)
            assertStructurallySame(reached, [[4], [4], [4]])
            assertEq(reached[0], reached[1])
            assertEq(reached[0], reached[2])
        }
    },
    loopMemoCallerDemandBeforeEntry: () => {
        const lazy = id(0), alias = id(0), before = id(0)
        const loop = collectingMemo(ref(lazy))
        const value = evaluate(fromFast(result(['array', [
            ref(before), collectedMemo(ref(loop.results[0]), 2), collectedMemo(ref(loop.results[0])), ref(lazy), ref(alias),
        ]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['define', alias, ref(lazy), 'lazy'],
            ['define', before, ref(alias), 'required'], ['loop', loop],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4], [4], [4]])
        for (const item of value) { assertEq(item, value[0]) }
    },
    loopMemoSequentialHelpers: () => {
        const lazy = id(0)
        for (const firstDemand of [false, true]) {
            const first = collectingMemo(ref(lazy), 2, firstDemand)
            const second = collectingMemo(ref(lazy), 2)
            const value = evaluate(fromFast(result(['array', [
                collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0]), 1), collectedMemo(ref(second.results[0])), ref(lazy),
            ]], [['define', lazy, ['array', [4]], 'lazy'], ['loop', first], ['loop', second]])))
            assert(value instanceof Array)
            assertEq(value[1], value[2])
            assertEq(value[1], value[3])
            assertStructurallySame(value[1], [4])
            if (firstDemand) { assertEq(value[0], value[1]) } else { assertEq(value[0], null) }
        }
    },
    loopMemoSimultaneousTransitions: () => {
        const lazy = id(0), count = id(0), left = id(0), right = id(0), saved = id(0)
        const outputs = Array.from({ length: 4 }, () => id(0))
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count, left, right, saved], initial: [0, 1, 2, null], results: outputs,
            body: body(['continue', loopTarget, [ref(count), ref(left), ref(right), ref(saved)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', loopTarget, [
                    ['+', ref(count), 1], ref(right), ref(left), ['?:', ['===', ref(count), 1], ref(lazy), ref(saved)],
                ]]), body(['break', loopTarget, [ref(count), ref(left), ref(right), ref(saved)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [...outputs.map(ref), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [3, 2, 1, [4], [4]])
        assertEq(value[3], value[4])
    },
    loopMemoPrimitivePayloads: () => {
        const lazy = id(0)
        for (const payload of [null, false, 0, undefined, '']) {
            const loop = collectingMemo(ref(lazy), 2)
            const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy)]], [
                ['define', lazy, ['block', result(payload)], 'lazy'], ['loop', loop],
            ])))
            assertStructurallySame(value, [payload, payload, payload])
        }
    },
    loopMemoConditionAndFailure: () => {
        const limit = id(0), alias = id(0)
        const scalar = counting(0, ref(alias))
        assertStructurallySame(evaluate(fromFast(result(['array', [ref(scalar.results[0]), ref(limit)]], [
            ['define', limit, ['block', result(3)], 'lazy'], ['define', alias, ref(limit), 'lazy'], ['loop', scalar],
        ]))), [3, 3])
        const general = summing(0, ref(limit))
        assertStructurallySame(evaluate(fromFast(result(['array', [...general.results.map(ref), ref(limit)]], [
            ['define', limit, ['block', result(3)], 'lazy'], ['loop', general],
        ]))), [13, 3, 3])
        for (const loop of [scalar, general]) {
            const failed = fromFast(result(7, [
                ['define', limit, ['.', null, 'x'], 'lazy'], ['define', alias, ref(limit), 'lazy'], ['loop', loop],
            ]))
            assertError(memo(assertOk(identityAnalysis(failed)))({ args: [] }))
        }
    },
    loopMemoOwnerlessTerminalRegions: () => {
        const lazy = id(0)
        const loop = collectingMemo(ref(lazy), 0)
        for (const selected of [false, true]) {
            const terminal = /** @type {Statement} */ (['if', [], selected, body(['throw', 'left']), body(['throw', 'right'])])
            for (const beforeLoop of [false, true]) {
                const statements = beforeLoop ? /** @type {readonly Statement[]} */ ([terminal, ['loop', loop]])
                    : /** @type {readonly Statement[]} */ ([['loop', loop], terminal])
                const block = result(ref(lazy), [['define', lazy, ['.', null, 'x'], 'lazy'], ...statements])
                const standalone = fromFast(block)
                const operand = anchored(lowerValue(['block', block], []))
                assertEq(assertError(memo(assertOk(identityAnalysis(standalone)))({ args: [] })), selected ? 'left' : 'right')
                assertEq(assertError(memo(assertOk(identityAnalysis(operand)))({ args: [] })), selected ? 'left' : 'right')
            }
        }
    },
    loopMemoExternalBeforeLocalDeclaration: () => {
        const external = id(0), before = id(0)
        const loop = collectingMemo(ref(external), 1)
        const block = result(7, [
            ['define', before, ref(external), 'required'],
            ['define', external, ['array', [4]], 'lazy'], ['loop', loop],
        ])
        const graph = fromFast(block, [[external, ['.', null, 'x']]])
        assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
    },
    loopMemoScopedDeclaration: () => {
        const external = id(0), before = id(0), inside = id(0)
        const supplied = /** @type {Exp} */ (['[]', [1]])
        const loop = collectingMemo(ref(external), 1)
        const region = result(['array', [collectedMemo(ref(loop.results[0])), ref(external)]], [
            ['define', external, ['array', [4]], 'lazy'], ['loop', loop],
        ])
        const value = evaluate(fromFast(result(['array', [ref(before), ref(external), ref(inside)]], [
            ['define', before, ref(external), 'required'], ['block', [inside], region],
        ]), [[external, supplied]]))
        assert(value instanceof Array && value[2] instanceof Array)
        assertStructurallySame(value, [[1], [1], [[4], [4]]])
        assertEq(value[0], value[1])
        assertEq(value[2][0], value[2][1])
        assert(value[0] !== value[2][0])
    },
    loopMemoRecipeCapturesDeclarationScope: () => {
        const prerequisite = id(0), lazy = id(0), inside = id(0)
        const supplied = /** @type {Exp} */ (['[]', [1]])
        const loop = collectingMemo(ref(lazy), 1)
        const region = result(['array', [collectedMemo(ref(loop.results[0])), ref(lazy), ref(prerequisite)]], [
            ['define', prerequisite, ['array', [9]], 'required'], ['loop', loop],
        ])
        const value = evaluate(fromFast(result(['array', [ref(inside), ref(prerequisite)]], [
            ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'], ['block', [inside], region],
        ]), [[prerequisite, supplied]]))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
        assertStructurallySame(value, [[[[1]], [[1]], [9]], [1]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[1])
        assert(value[0][2] !== value[1])
    },
    loopMemoDefinitionShadowsVirtualAlias: () => {
        const lazy = id(0)
        const witness = collectingMemo(ref(lazy), 1)
        for (const mode of /** @type {const} */ (['required', 'lazy'])) {
            const value = evaluate(fromFast(result(['array', [collectedMemo(ref(witness.results[0])), ref(lazy)]], [
                ['define', lazy, ['array', [4]], 'lazy'], ['loop', witness], ['define', lazy, 7, mode],
            ])))
            assertStructurallySame(value, [[4], 7])
        }
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(witness.results[0])), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', witness], ['define', lazy, ['array', [9]], 'lazy'],
        ])))
        assertStructurallySame(value, [[4], [9]])
    },
    loopMemoDistinctDeclarationsSameBinding: () => {
        const lazy = id(0)
        const first = collectingMemo(ref(lazy), 1)
        const second = collectingMemo(ref(lazy), 1)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0])), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', first],
            ['define', lazy, ['array', [9]], 'lazy'], ['loop', second],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [9], [9]])
        assertEq(value[1], value[2])
        assert(value[0] !== value[1])
    },
    loopMemoReusedDefinitionOccurrences: () => {
        const prerequisite = id(0), lazy = id(0)
        const definition = /** @type {Statement} */ (['define', lazy, ['array', [ref(prerequisite)]], 'lazy'])
        const first = collectingMemo(ref(lazy), 1)
        const second = collectingMemo(ref(lazy), 1)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(first.results[0])), collectedMemo(ref(first.results[0])),
            collectedMemo(ref(second.results[0])), collectedMemo(ref(second.results[0])), ref(lazy),
        ]], [
            ['define', prerequisite, 1, 'required'], definition, ['loop', first],
            ['define', prerequisite, 2, 'required'], definition, ['loop', second],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[1], [1], [2], [2], [2]])
        assertEq(value[0], value[1])
        assertEq(value[2], value[3])
        assertEq(value[2], value[4])
        assert(value[0] !== value[2])
    },
    loopMemoReusedBlockOccurrences: () => {
        const prerequisite = id(0), lazy = id(0), first = id(0), second = id(0)
        const loop = collectingMemo(ref(lazy), 1)
        const region = result(['array', [collectedMemo(ref(loop.results[0])), ref(lazy)]], [
            ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'], ['loop', loop],
        ])
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', prerequisite, 1, 'required'], ['block', [first], region],
            ['define', prerequisite, 2, 'required'], ['block', [second], region],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[2], [2]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    loopMemoReusedLoopOccurrences: () => {
        const prerequisite = id(0), lazy = id(0), first = id(0), second = id(0)
        const loop = collectingMemo(ref(lazy), 1)
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second), ref(lazy)]], [
            ['define', prerequisite, 1, 'required'], ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'], ['loop', loop],
            ['define', first, collectedMemo(ref(loop.results[0])), 'required'],
            ['define', prerequisite, 2, 'required'], ['define', lazy, ['array', [ref(prerequisite)]], 'lazy'], ['loop', loop],
            ['define', second, collectedMemo(ref(loop.results[0])), 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[1], [2], [2]])
        assertEq(value[1], value[2])
        assert(value[0] !== value[1])
    },
    loopMemoLoopParameterShadowsVirtualAlias: () => {
        const lazy = id(0), output = id(0)
        const witness = collectingMemo(ref(lazy), 1)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [lazy], initial: [0], results: [output],
            body: body(['continue', loopTarget, [ref(lazy)]], [
                ['if', [], ['<', ref(lazy), 3], body(['continue', loopTarget, [['+', ref(lazy), 1]]]), body(['break', loopTarget, [ref(lazy)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(output), collectedMemo(ref(witness.results[0])), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', witness], ['loop', loop],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [3, [4], [4]])
        assertEq(value[1], value[2])
    },
    loopMemoLoopResultShadowsVirtualAlias: () => {
        const lazy = id(0), state = id(0)
        const witness = collectingMemo(ref(lazy), 1)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [0], results: [lazy], body: body(['break', loopTarget, [7]]),
        })
        assertStructurallySame(evaluate(fromFast(result(['array', [collectedMemo(ref(witness.results[0])), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', witness], ['loop', loop],
        ]))), [[4], 7])
    },
    loopMemoStatementResultsShadowVirtualAlias: () => {
        const lazy = id(0)
        const witness = collectingMemo(ref(lazy), 1)
        for (const statement of /** @type {readonly Statement[]} */ ([
            ['block', [lazy], body(['yield', [7]])],
            ['if', [lazy], true, body(['yield', [8]]), body(['yield', [9]])],
            ['if', [lazy], false, body(['yield', [8]]), body(['yield', [9]])],
        ])) {
            const value = evaluate(fromFast(result(['array', [collectedMemo(ref(witness.results[0])), ref(lazy)]], [
                ['define', lazy, ['array', [4]], 'lazy'], ['loop', witness], statement,
            ])))
            assertStructurallySame(value, [[4], statement[0] === 'block' ? 7 : statement[2] ? 8 : 9])
        }
    },
    throw: {
        loopMemoReachableUnsupportedSuffix: () => {
            const selected = id(0), prerequisite = id(0), dependent = id(0)
            const source = collectingMemo(ref(dependent))
            const loop = /** @type {Loop} */ ({ ...source, body: body(['return', target, ref(dependent)]) })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [
                    ['if', [], ref(selected), body(['return', target, 7]), body(['yield', []])],
                    ['define', prerequisite, ['array', [4]], 'lazy'],
                    ['define', dependent, ref(prerequisite), 'lazy'],
                    ['loop', loop],
                ]),
            })
            calledFunction(fn, [true])
        },
    },
})
