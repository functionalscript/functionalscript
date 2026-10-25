/**
 * @import { Function as FastFunction, Loop, Statement, Value } from '../../../../../js/ast/types.ts'
 * @import { Exp } from '../../../../types.ts'
 * @import { Environment } from '../../../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../../asserts/module.f.js'
import { anchored, fromFast, lowerValue } from '../../../module.f.mjs'
import { normalizeMemo } from '../module.f.mjs'
import { identityAnalysis } from '../../../../analysis/module.f.mjs'
import { memo } from '../../../../memo/module.f.mjs'
import { toFast } from '../../../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _afterLoop as afterLoop, _body as body, _summing as summing, _calledFunction as calledFunction, _counting as counting, _evaluate as evaluate, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../../../proof.f.mjs'

/** Run a fresh inner entry on each selected outer iteration, retaining its history. @type {(inner: Loop, limit?: Value, selected?: Value, value?: Value) => Loop} */
const collectingInnerMemo = (inner, limit = 2, selected = true, value = ref(inner.results[0])) => {
    const count = id(0), saved = id(0), output = id(0), chosen = id(0)
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target: loopTarget, parameters: [count, saved], initial: [0, null], results: [output],
        body: body(['continue', loopTarget, [ref(count), ref(saved)]], [
            ['if', [], ['<', ref(count), limit],
                body(['continue', loopTarget, [['+', ref(count), 1], ['array', [ref(saved), ref(chosen)]]]], [
                    ['if', [chosen], selected, afterLoop(inner, value), result(null)],
                ]),
                body(['break', loopTarget, [ref(saved)]]),
            ],
        ]),
    }
}

export const proof = /** @type {const} */ ({
    loopMemoNestedIdentityAndRoundTrip: () => {
        const lazy = id(0)
        const inner = collectingMemo(ref(lazy), 2)
        const outer = collectingInnerMemo(inner)
        const first = collectedMemo(ref(outer.results[0]), 1), second = collectedMemo(ref(outer.results[0]))
        const block = result(['array', [
            collectedMemo(first, 1), collectedMemo(first), collectedMemo(second, 1), collectedMemo(second), ref(lazy), first, second,
        ]], [['define', lazy, ['array', [4]], 'lazy'], ['loop', outer]])
        const graph = fromFast(block)
        const value = evaluate(graph)
        assert(value instanceof Array)
        assertStructurallySame(value.slice(0, 5), [[4], [4], [4], [4], [4]])
        for (const observed of value.slice(0, 5)) { assertEq(observed, value[0]) }
        assert(value[5] !== value[6])
        const secondGraph = fromFast(assertOk(toFast(graph)))
        const thirdGraph = fromFast(assertOk(toFast(secondGraph)))
        assertStructurallySame(assertOk(identityAnalysis(thirdGraph)), assertOk(identityAnalysis(secondGraph)))
        const repeated = evaluate(thirdGraph)
        assert(repeated instanceof Array)
        for (const observed of repeated.slice(0, 5)) { assertEq(observed, repeated[0]) }
    },
    loopMemoNestedThreeLevelsFreshInvocations: () => {
        const lazy = id(0), fnBinding = id(0), first = id(0), second = id(0)
        const inner = collectingMemo(ref(lazy), 2)
        const middle = collectingInnerMemo(inner)
        const outer = collectingInnerMemo(middle)
        const deepest = collectedMemo(collectedMemo(collectedMemo(ref(outer.results[0]))))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [deepest, ref(lazy)]]], [
                ['define', lazy, ['array', [4]], 'lazy'], ['loop', outer],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', fnBinding, ['function', fn], 'required'],
            ['define', first, ['()', ref(fnBinding), []], 'required'],
            ['define', second, ['()', ref(fnBinding), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[4], [4]], [[4], [4]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    loopMemoNestedSkippedAndZeroIterations: () => {
        const lazy = id(0)
        for (const outerLimit of /** @type {const} */ ([0, 2])) {
            for (const innerLimit of /** @type {const} */ ([0, 2])) {
                for (const selected of /** @type {const} */ ([false, true])) {
                    const inner = collectingMemo(ref(lazy), innerLimit)
                    const outer = collectingInnerMemo(inner, outerLimit, selected)
                    const statements = /** @type {readonly Statement[]} */ ([
                        ['define', lazy, ['block', body(['throw', 'nested recipe'])], 'lazy'], ['loop', outer],
                    ])
                    const graph = fromFast(result(7, statements))
                    if (outerLimit !== 0 && innerLimit !== 0 && selected) {
                        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'nested recipe')
                    } else { assertEq(evaluate(graph), 7) }
                    const following = fromFast(result(ref(lazy), statements))
                    assertEq(assertError(memo(assertOk(identityAnalysis(following)))({ args: [] })), 'nested recipe')
                }
            }
        }
    },
    loopMemoNestedDependentDiamond: () => {
        const shared = id(0), left = id(0), right = id(0), joined = id(0), wrapped = id(0)
        const inner = collectingMemo(ref(wrapped), 2)
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(wrapped)]])
        const last = collectedMemo(ref(outer.results[0]))
        const innerHistory = /** @type {Value} */ (['.', last, 0])
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(innerHistory), ['.', last, 1], ref(wrapped), ref(joined), ref(shared), ref(left), ref(right),
        ]], [
            ['define', shared, ['array', [4]], 'lazy'],
            ['define', left, ['array', [ref(shared), 'left']], 'lazy'],
            ['define', right, ['array', [ref(shared), 'right']], 'lazy'],
            ['define', joined, ['array', [ref(right), ref(left)]], 'lazy'],
            ['define', wrapped, ['array', [ref(joined)]], 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[3] instanceof Array && value[5] instanceof Array && value[6] instanceof Array)
        assertStructurallySame(value[0], [[[[4], 'right'], [[4], 'left']]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[0][0], value[3])
        assertEq(value[3][0], value[6])
        assertEq(value[3][1], value[5])
        assertEq(value[5][0], value[4])
        assertEq(value[6][0], value[4])
        assert(value[5] !== value[6])
    },
    loopMemoNestedConditionalDependencyAndSetup: () => {
        const choice = id(0), dependency = id(0), dependent = id(0)
        const inner = collectingMemo(ref(dependent), 2)
        const outer = collectingInnerMemo(inner)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(collectedMemo(ref(outer.results[0]))), ref(dependent)]]], [
                ['define', dependency, ['block', body(['throw', 'nested dependency'])], 'lazy'],
                ['define', dependent, ['if', ref(choice), result(ref(dependency)), result(['array', [7]])], 'lazy'],
                ['loop', outer],
            ]),
        })
        const skipped = evaluate(calledFunction(fn, [false]))
        assert(skipped instanceof Array)
        assertStructurallySame(skipped, [[7], [7]])
        assertEq(skipped[0], skipped[1])
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true]))))({ args: [] })), 'nested dependency')
        const following = /** @type {FastFunction} */ ({ ...fn, body: { ...fn.body, exit: ['return', target, ref(dependency)] } })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(following, [false]))))({ args: [] })), 'nested dependency')
        const badEntry = /** @type {Loop} */ ({ ...inner, initial: [['block', body(['throw', 'inner setup'])], null] })
        for (const selected of /** @type {const} */ ([false, true])) {
            const entered = collectingInnerMemo(badEntry, 2, selected)
            const graph = fromFast(result(9, [
                ['define', dependent, ['array', [7]], 'lazy'], ['loop', entered],
            ]))
            if (selected) { assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'inner setup') }
            else { assertEq(evaluate(graph), 9) }
        }
    },
    loopMemoNestedSimultaneousOuterState: () => {
        const lazy = id(0), count = id(0), left = id(0), right = id(0), total = id(0), saved = id(0)
        const outputs = Array.from({ length: 5 }, () => id(0))
        const inner = collectingMemo(ref(lazy), 2)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count, left, right, total, saved], initial: [0, 1, 2, 10, null], results: outputs,
            body: body(['continue', loopTarget, [ref(count), ref(left), ref(right), ref(total), ref(saved)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', loopTarget, [
                    ['+', ref(count), 1], ref(right), ref(left), ['+', ref(total), ref(left)],
                    ['array', [collectedMemo(ref(inner.results[0])), ref(lazy)]],
                ]], [['loop', inner]]), body(['break', loopTarget, [ref(count), ref(left), ref(right), ref(total), ref(saved)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [...outputs.map(ref), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[4] instanceof Array)
        assertStructurallySame(value, [3, 2, 1, 14, [[4], [4]], [4]])
        assertEq(value[4][0], value[4][1])
        assertEq(value[4][0], value[5])
    },
    loopMemoNestedSequentialHelpers: () => {
        const dependency = id(0), dependent = id(0), count = id(0), saved = id(0), output = id(0)
        const first = collectingMemo(ref(dependency), 1), second = collectingMemo(ref(dependent), 1)
        const following = collectingMemo(ref(dependent), 1)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [ref(count), ref(saved)]], [
                ['if', [], ['<', ref(count), 2], body(['continue', loopTarget, [
                    ['+', ref(count), 1], ['array', [collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0]))]],
                ]], [['loop', first], ['loop', second]]), body(['break', loopTarget, [ref(saved)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(output), collectedMemo(ref(following.results[0])), ref(dependency), ref(dependent)]], [
            ['define', dependency, ['array', [4]], 'lazy'],
            ['define', dependent, ['array', [ref(dependency)]], 'lazy'], ['loop', outer], ['loop', following],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[3] instanceof Array)
        assertStructurallySame(value, [[[4], [[4]]], [[4]], [4], [[4]]])
        assertEq(value[0][0], value[2])
        assertEq(value[0][1], value[1])
        assertEq(value[1], value[3])
        assertEq(value[3][0], value[2])
    },
    loopMemoNestedLexicalAliasBinders: () => {
        const lazy = id(0), alias = id(0), count = id(0), saved = id(0), output = id(0), finalAlias = id(0)
        const inner = collectingMemo(['array', [ref(lazy), ref(alias)]], 1)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count, alias, saved], initial: [0, 7, null], results: [output, finalAlias],
            body: body(['continue', loopTarget, [ref(count), ref(alias), ref(saved)]], [
                ['if', [], ['<', ref(count), 2], body(['continue', loopTarget, [
                    ['+', ref(count), 1], ref(alias), ['array', [ref(saved), collectedMemo(ref(inner.results[0]))]],
                ]], [['loop', inner], ['block', [alias], body(['yield', [9]])]]), body(['break', loopTarget, [ref(saved), ref(alias)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(output), 1), collectedMemo(ref(output)), ref(finalAlias), ref(alias), ref(lazy)]], [
            ['define', lazy, ['array', [4]], 'lazy'], ['define', alias, ref(lazy), 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[4], 7], [[4], 9], 9, [4], [4]])
        assertEq(value[0][0], value[1][0])
        assertEq(value[0][0], value[3])
        assertEq(value[3], value[4])
    },
    loopMemoNestedZeroResultRequiredDemand: () => {
        const lazy = id(0), observed = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [],
            body: body(['break', loopTarget, []], [['define', observed, ref(lazy), 'required']]),
        })
        const outer = collectingInnerMemo(inner, 2, true, 7)
        assertEq(evaluate(fromFast(result(9, [['define', lazy, ['array', [4]], 'lazy'], ['loop', outer]]))), 9)
        const failed = fromFast(result(9, [
            ['define', lazy, ['block', body(['throw', 'required nested demand'])], 'lazy'], ['loop', outer],
        ]))
        assertEq(assertError(memo(assertOk(identityAnalysis(failed)))({ args: [] })), 'required nested demand')
    },
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
    loopMemoDependentRecipeIdentity: () => {
        const first = id(0), second = id(0)
        const loop = collectingMemo(ref(second), 2)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(first), ref(second),
        ]], [
            ['define', first, ['array', [4]], 'lazy'], ['define', second, ['array', [ref(first)]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [4], [[4]]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[3])
        assertEq(value[0][0], value[2])
    },
    loopMemoDependentChain: () => {
        const first = id(0), second = id(0), third = id(0)
        const loop = collectingMemo(ref(third), 2)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ref(third), ref(second), ref(first)]], [
            ['define', first, ['array', [4]], 'lazy'],
            ['define', second, ['array', [ref(first)]], 'lazy'],
            ['define', third, ['array', [ref(second)]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array)
        assertStructurallySame(value, [[[[4]]], [[[4]]], [[4]], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[2][0], value[3])
    },
    loopMemoDependentDiamond: () => {
        const shared = id(0), left = id(0), right = id(0), joined = id(0)
        const loop = collectingMemo(ref(joined), 2)
        const block = result(['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(shared), ref(left), ref(right), ref(joined)]], [
            ['define', shared, ['array', [4]], 'lazy'],
            ['define', left, ['array', [ref(shared), 'left']], 'lazy'],
            ['define', right, ['array', [ref(shared), 'right']], 'lazy'],
            ['define', joined, ['array', [ref(right), ref(left)]], 'lazy'], ['loop', loop],
        ])
        const value = evaluate(fromFast(block))
        assert(value instanceof Array && value[0] instanceof Array && value[3] instanceof Array && value[4] instanceof Array)
        assertStructurallySame(value[0], [[[4], 'right'], [[4], 'left']])
        assertEq(value[0], value[1])
        assertEq(value[0], value[5])
        assertEq(value[0][0], value[4])
        assertEq(value[0][1], value[3])
        assertEq(value[3][0], value[2])
        assertEq(value[4][0], value[2])
        assert(value[3] !== value[4])
        const second = fromFast(assertOk(toFast(fromFast(block))))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        const repeated = evaluate(third)
        assert(repeated instanceof Array && repeated[3] instanceof Array && repeated[4] instanceof Array)
        assertEq(repeated[3][0], repeated[4][0])
    },
    loopMemoDependentConditionalFailure: () => {
        const choice = id(0), dependency = id(0), dependent = id(0)
        const loop = collectingMemo(ref(dependent), 2)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(dependent)]]], [
                ['define', dependency, ['block', body(['throw', 'dependency'])], 'lazy'],
                ['define', dependent, ['if', ref(choice), result(ref(dependency)), result(['array', [7]])], 'lazy'],
                ['loop', loop],
            ]),
        })
        const skipped = evaluate(calledFunction(fn, [false]))
        assert(skipped instanceof Array)
        assertStructurallySame(skipped, [[7], [7]])
        assertEq(skipped[0], skipped[1])
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true]))))({ args: [] })), 'dependency')
        const following = /** @type {FastFunction} */ ({ ...fn, body: { ...fn.body, exit: ['return', target, ref(dependency)] } })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(following, [false]))))({ args: [] })), 'dependency')
    },
    loopMemoDependentCallerDemand: () => {
        const dependency = id(0), dependent = id(0), before = id(0)
        for (const dependencyFirst of [false, true]) {
            const loop = collectingMemo(['array', [ref(dependency), ref(dependent)]], 2)
            const value = evaluate(fromFast(result(['array', [
                ref(before), collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(dependency), ref(dependent),
            ]], [
                ['define', dependency, ['array', [4]], 'lazy'],
                ['define', dependent, ['array', [ref(dependency)]], 'lazy'],
                ['define', before, dependencyFirst ? ref(dependency) : ref(dependent), 'required'], ['loop', loop],
            ])))
            assert(value instanceof Array && value[1] instanceof Array && value[2] instanceof Array && value[4] instanceof Array)
            assertEq(value[1][0], value[3])
            assertEq(value[1][1], value[4])
            assertEq(value[2][0], value[3])
            assertEq(value[2][1], value[4])
            assertEq(value[4][0], value[3])
            assertEq(value[0], dependencyFirst ? value[3] : value[4])
            assertStructurallySame(value[4], [[4]])
        }
    },
    loopMemoDependentSequentialAliases: () => {
        const dependency = id(0), dependencyAlias = id(0), dependent = id(0), dependentAlias = id(0)
        for (const firstDemand of [false, true]) {
            const first = collectingMemo(ref(dependencyAlias), 2, firstDemand)
            const second = collectingMemo(ref(dependentAlias), 2)
            const value = evaluate(fromFast(result(['array', [
                collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0]), 1), collectedMemo(ref(second.results[0])),
                ref(dependency), ref(dependencyAlias), ref(dependent), ref(dependentAlias),
            ]], [
                ['define', dependency, ['array', [4]], 'lazy'], ['define', dependencyAlias, ref(dependency), 'lazy'],
                ['define', dependent, ['array', [ref(dependencyAlias)]], 'lazy'], ['define', dependentAlias, ref(dependent), 'lazy'],
                ['loop', first], ['loop', second],
            ])))
            assert(value instanceof Array && value[1] instanceof Array)
            assertEq(value[1], value[2])
            assertEq(value[1], value[5])
            assertEq(value[1], value[6])
            assertEq(value[1][0], value[3])
            assertEq(value[3], value[4])
            if (firstDemand) { assertEq(value[0], value[3]) } else { assertEq(value[0], null) }
            assertStructurallySame(value[1], [[4]])
        }
    },
    loopMemoComputedCallerDependent: () => {
        const dependency = id(0), dependent = id(0)
        const loop = collectingMemo(ref(dependency), 2)
        const definition = /** @type {Statement} */ (['define', dependent, ['array', [ref(dependency)]], 'lazy'])
        for (const afterLoop of [false, true]) {
            const statements = afterLoop ? /** @type {readonly Statement[]} */ ([['loop', loop], definition])
                : /** @type {readonly Statement[]} */ ([definition, ['loop', loop]])
            const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ref(dependency), ref(dependent), ref(dependent)]], [
                ['define', dependency, ['array', [4]], 'lazy'], ...statements,
            ])))
            assert(value instanceof Array && value[2] instanceof Array)
            assertStructurallySame(value, [[4], [4], [[4]], [[4]]])
            assertEq(value[0], value[1])
            assertEq(value[2], value[3])
            assertEq(value[2][0], value[0])
        }
        const failing = /** @type {readonly Statement[]} */ ([
            ['define', dependency, ['array', [4]], 'lazy'],
            ['define', dependent, ['array', [ref(dependency), ['.', null, 'x']]], 'lazy'], ['loop', loop],
        ])
        assertStructurallySame(evaluate(fromFast(result(ref(dependency), failing))), [4])
        assertError(memo(assertOk(identityAnalysis(fromFast(result(ref(dependent), failing)))))({ args: [] }))
    },
    loopMemoDependentFreshInvocations: () => {
        const dependency = id(0), dependent = id(0), fnBinding = id(0), first = id(0), second = id(0)
        const loop = collectingMemo(ref(dependent), 2)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(dependency), ref(dependent), collectedMemo(ref(loop.results[0]))]]], [
                ['define', dependency, ['array', [4]], 'lazy'],
                ['define', dependent, ['array', [ref(dependency)]], 'lazy'], ['loop', loop],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', fnBinding, ['function', fn], 'required'],
            ['define', first, ['()', ref(fnBinding), []], 'required'], ['define', second, ['()', ref(fnBinding), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        const left = value[0], right = value[1]
        assert(left[1] instanceof Array && right[1] instanceof Array)
        assertStructurallySame(value, [[[4], [[4]], [[4]]], [[4], [[4]], [[4]]]])
        assertEq(left[1], left[2])
        assertEq(left[1][0], left[0])
        assertEq(right[1], right[2])
        assertEq(right[1][0], right[0])
        assert(left[0] !== right[0])
        assert(left[1] !== right[1])
    },
    loopMemoDependentRecipeGrowth: () => {
        const choice = id(0)
        const sizes = [4, 8, 12].map(length => {
            const cells = Array.from({ length }, () => id(0))
            const definitions = cells.map((binding, index) => /** @type {Statement} */ (['define', binding,
                index === 0 ? ['array', [0]] : ['?:', ref(choice),
                    ['array', [ref(cells[index - 1]), 'left']], ['array', [ref(cells[index - 1]), 'right']],
                ], 'lazy']))
            const loop = collectingMemo(ref(cells[length - 1]), 1)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [choice], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(cells[length - 1]), ref(cells[0])]]], [
                    ...definitions, ['loop', loop],
                ]),
            })
            const normalized = normalizeMemo(fn.body)
            const recipes = normalized.statements.flatMap(statement => statement[0] === 'define'
                && statement[2] instanceof Array && statement[2][0] === 'function' ? [statement[2][1]] : [])
            assertEq(recipes.length, length)
            for (const recipe of recipes) { assertEq(recipe.parameters.length, 1) }
            const analysis = assertOk(identityAnalysis(fromFast(result(['function', fn]))))
            // One caller, one normal loop helper, and one shared recipe per cell.
            assertEq(analysis.nodes.filter(node => node[0] === '=>').length, length + 2)
            for (const selected of [false, true]) {
                const value = evaluate(calledFunction(fn, [selected]))
                assert(value instanceof Array)
                assertEq(value[0], value[1])
                let current = value[0]
                for (let level = length - 1; level > 0; --level) {
                    assert(current instanceof Array)
                    assertEq(current[1], selected ? 'left' : 'right')
                    current = current[0]
                }
                assertEq(current, value[2])
                assertStructurallySame(current, [0])
            }
            return { nodes: analysis.nodes.length, fast: JSON.stringify(normalized).length }
        })
        // Copying the full memo vector costs quadratic transport. Shared
        // recipe definitions prevent recursive duplication of the prerequisites.
        assert(sizes[1].nodes < sizes[0].nodes * 5)
        assert(sizes[2].nodes < sizes[1].nodes * 3)
        assert(sizes[2].nodes - sizes[1].nodes <= 2 * (sizes[1].nodes - sizes[0].nodes))
        assert(sizes[1].fast < sizes[0].fast * 5)
        assert(sizes[2].fast < sizes[1].fast * 3)
        assert(sizes[2].fast - sizes[1].fast <= 2 * (sizes[1].fast - sizes[0].fast))
    },
    loopMemoEstablishedEnvironmentPrerequisite: () => {
        const external = id(0), dependent = id(0)
        const supplied = /** @type {Exp} */ (['[]', [4]])
        const environments = /** @type {readonly Environment[]} */ ([
            [[external, supplied]],
            [[external, supplied], [external, ['[]', [9]], 'lazy']],
        ])
        const loop = collectingMemo(ref(dependent), 2)
        const block = result(['array', [collectedMemo(ref(loop.results[0])), ref(external)]], [
            ['define', dependent, ['array', [ref(external)]], 'lazy'], ['loop', loop],
        ])
        for (const environment of environments) {
            const value = evaluate(fromFast(block, environment))
            assert(value instanceof Array && value[0] instanceof Array)
            assertStructurallySame(value, [[[4]], [4]])
            assertEq(value[0][0], value[1])
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
