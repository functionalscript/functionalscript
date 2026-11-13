/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../../../../js/ast/types.ts'
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

/** Run a fresh inner entry on each selected outer iteration, retaining its history. @type {(inner: Loop, limit?: Value, selected?: Value, value?: Value, prefix?: (index: Value) => readonly Statement[]) => Loop} */
const collectingInnerMemo = (inner, limit = 2, selected = true, value = ref(inner.results[0]), prefix = () => []) => {
    const count = id(0), saved = id(0), output = id(0), chosen = id(0)
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target: loopTarget, parameters: [count, saved], initial: [0, null], results: [output],
        body: body(['continue', loopTarget, [ref(count), ref(saved)]], [
            ['if', [], ['<', ref(count), limit],
                body(['continue', loopTarget, [['+', ref(count), 1], ['array', [ref(saved), ref(chosen)]]]], [
                    ...prefix(ref(count)),
                    ['if', [chosen], selected, afterLoop(inner, value), result(null)],
                ]),
                body(['break', loopTarget, [ref(saved)]]),
            ],
        ]),
    }
}

/** Observe two inner demands and the following outer demand for each iteration. @type {(outer: Loop, iterations?: number) => Value} */
const innerObservations = (outer, iterations = 2) => ['array', Array.from({ length: iterations }, (_, index) => {
    const iteration = collectedMemo(ref(outer.results[0]), iterations - index - 1)
    const history = /** @type {Value} */ (['.', iteration, 0])
    return /** @type {Value} */ (['array', [collectedMemo(history, 1), collectedMemo(history), ['.', iteration, 1]]])
})]

/** A deferred local allocation occurs once within each enclosing recipe call. @type {(local: BindingId, initializer: Value) => Value} */
const localPairRecipe = (local, initializer) => ['block', result(['array', [ref(local), ref(local)]], [
    ['define', local, initializer, 'lazy'],
])]

/** @type {(makeBody: (target: Loop['target']) => Block, results?: readonly BindingId[]) => Loop} */
const exitMemoLoop = (makeBody, results = []) => {
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return { target: loopTarget, parameters: [], initial: [], results, body: makeBody(loopTarget) }
}

export const proof = /** @type {const} */ ({
    loopMemoRecipeLocalOperandLoop: () => {
        const caller = id(0), selected = id(0), local = id(0)
        const inner = collectingMemo(ref(local), 2), outer = collectingMemo(ref(selected), 2)
        const initializer = /** @type {Value} */ (['block', result(ref(local), [
            ['define', local, ['array', [ref(caller)]], 'lazy'], ['loop', inner],
        ])])
        const statements = /** @type {readonly Statement[]} */ ([
            ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', outer],
        ])
        assertEq(evaluate(fromFast(result(7, statements))), 7)
        const value = evaluate(fromFast(result(['array', [
            ref(selected), collectedMemo(ref(outer.results[0]), 1), collectedMemo(ref(outer.results[0])), ref(caller),
        ]], statements)))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [[4]], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[0][0], value[3])
    },
    loopMemoRecipeLocalEscapingCompletion: () => {
        const caller = id(0), selected = id(0), local = id(0)
        const initializer = /** @type {Value} */ (['block', body(['return', target, ref(local)], [
            ['define', local, ['array', [ref(caller), ref(caller)]], 'lazy'],
        ])])
        const loop = collectingMemo(ref(selected), 2)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 7], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', loop],
            ]),
        })
        const value = evaluate(calledFunction(fn))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    loopMemoOuterTransferOriginalCases: () => {
        const caller = id(0), output = id(0), count = id(0), observed = id(0)
        const breakTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const breakInner = exitMemoLoop(() => body(['break', breakTarget, [ref(caller)]]))
        const breakOuter = /** @type {Loop} */ ({
            target: breakTarget, parameters: [], initial: [], results: [output], body: body(['break', breakTarget, [null]], [['loop', breakInner]]),
        })
        const breakFn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['define', caller, ['array', [4]], 'lazy'], ['loop', breakOuter]]),
        })
        assertStructurallySame(evaluate(calledFunction(breakFn)), [4])
        const continueTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const continueInner = exitMemoLoop(() => body(['continue', continueTarget, [['+', ref(count), 1]]], [['define', observed, ref(caller), 'required']]))
        const continueOuter = /** @type {Loop} */ ({
            target: continueTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', continueTarget, [ref(count)]], [
                ['if', [], ['<', ref(count), 1], body(['break', continueTarget, [null]], [['loop', continueInner]]), body(['yield', []])],
            ]),
        })
        const continueFn = /** @type {FastFunction} */ ({ ...breakFn, body: body(['return', target, ref(output)], [
            ['define', caller, ['array', [4]], 'lazy'], ['loop', continueOuter],
        ]) })
        assertEq(evaluate(calledFunction(continueFn)), 1)
    },
    loopMemoOuterContinueSimultaneousState: () => {
        const caller = id(0), dependent = id(0), count = id(0), left = id(0), right = id(0), total = id(0), saved = id(0), dead = id(0)
        const outputs = Array.from({ length: 5 }, () => id(0))
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = exitMemoLoop(() => body(['continue', outerTarget, [
            ['+', ref(count), 1], ref(right), ref(left), ['+', ref(total), ref(left)], ['array', [ref(dependent), ref(caller)]],
        ]]))
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, left, right, total, saved], initial: [0, 1, 2, 10, null], results: outputs,
            body: body(['continue', outerTarget, [ref(count), ref(left), ref(right), ref(total), ref(saved)]], [
                ['if', [], ['<', ref(count), 3], body(['break', outerTarget, [0, 0, 0, 0, null]], [
                    ['loop', inner], ['define', dead, ['block', body(['throw', 'escaped continue suffix'])], 'required'],
                ]), body(['break', outerTarget, [ref(count), ref(left), ref(right), ref(total), ref(saved)]])],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [...outputs.map(ref), ref(dependent), ref(caller)]], [
            ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[4] instanceof Array && value[5] instanceof Array)
        assertStructurallySame(value, [3, 2, 1, 14, [[[4]], [4]], [[4]], [4]])
        assertEq(value[4][0], value[5])
        assertEq(value[4][1], value[6])
        assertEq(value[5][0], value[6])
    },
    loopMemoOuterTransferControlOnlyTargets: () => {
        const selected = id(0), caller = id(0), dependent = id(0), count = id(0), saved = id(0), output = id(0)
        const carried = id(0), nextSaved = id(0), middleOutput = id(0), dead = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const middleTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const demanded = collectingMemo(ref(dependent), 1)
        // The two transfer helpers read established values, without cell refs.
        const deepest = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], ref(selected), body(['continue', outerTarget, [['+', ref(count), 1], ref(nextSaved)]]), body(['break', middleTarget, [ref(carried)]])],
        ]))
        const middle = /** @type {Loop} */ ({
            target: middleTarget, parameters: [], initial: [], results: [middleOutput],
            body: body(['break', middleTarget, [null]], [
                ['loop', deepest], ['define', dead, ['block', body(['throw', 'control-only suffix'])], 'required'],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['break', outerTarget, [ref(saved)]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [
                    ['+', ref(count), 1], ['array', [ref(saved), ['array', [ref(middleOutput), ref(dependent), 'middle']]]],
                ]], [
                    ['loop', demanded], ['define', carried, collectedMemo(ref(demanded.results[0])), 'required'],
                    ['define', nextSaved, ['array', [ref(saved), ['array', [ref(carried), ref(dependent), 'outer']]]], 'required'],
                    ['loop', middle],
                ]), body(['yield', []])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(output), 1), collectedMemo(ref(output)), ref(dependent), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'], ['loop', outer],
            ]),
        })
        for (const goOuter of /** @type {const} */ ([false, true])) {
            const value = evaluate(calledFunction(fn, [goOuter]))
            assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[2] instanceof Array)
            for (const iteration of value.slice(0, 2)) {
                assert(iteration instanceof Array)
                assertEq(iteration[0], value[2])
                assertEq(iteration[1], value[2])
                assertEq(iteration[2], goOuter ? 'outer' : 'middle')
            }
            assertEq(value[2][0], value[3])
        }
    },
    loopMemoOuterBreakAritiesAndTags: () => {
        const caller = id(0), dependent = id(0), observed = id(0), allocation = id(0)
        for (const length of /** @type {const} */ ([0, 1, 3])) {
            const outputs = Array.from({ length }, () => id(0))
            const values = outputs.map((_, index) => index === 1 ? ref(caller) : ref(dependent))
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = exitMemoLoop(() => body(['break', outerTarget, values], [['define', observed, ref(dependent), 'required']]))
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: outputs,
                body: body(['break', outerTarget, outputs.map(() => null)], [['loop', inner]]),
            })
            const value = evaluate(fromFast(result(['array', [ref(allocation), ref(allocation), ref(dependent), ref(caller)]], [
                ['define', caller, ['array', ['continue', ['array', [4]]]], 'lazy'],
                ['define', dependent, ['array', ['break', ref(caller)]], 'lazy'], ['loop', outer],
                ['define', allocation, ['array', outputs.map(ref)], 'required'],
            ])))
            assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0].length, length)
            for (let index = 0; index < length; index += 1) { assertEq(value[0][index], index === 1 ? value[3] : value[2]) }
            assertStructurallySame(value[2], ['break', ['continue', [4]]])
            assertEq(value[2][1], value[3])
        }
    },
    loopMemoOuterTransferLocalEpochs: () => {
        const caller = id(0), local = id(0), selected = id(0), recipeLocal = id(0), count = id(0), saved = id(0), output = id(0)
        const innerCount = id(0), remembered = id(0), fnBinding = id(0), first = id(0), second = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [innerCount, remembered], initial: [0, null], results: [],
            body: body(['break', innerTarget, []], [
                ['if', [], ['<', ref(innerCount), 1], body(['continue', innerTarget, [['+', ref(innerCount), 1], ref(selected)]]),
                    body(['continue', outerTarget, [
                        ['+', ref(count), 1], ['array', [ref(saved), ['array', [ref(local), ref(selected), ref(remembered)]]]],
                    ]])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['break', outerTarget, [ref(saved)]], [
                ['if', [], ['<', ref(count), 2], body(['break', outerTarget, [null]], [
                    ['define', local, ['array', [ref(caller), ref(count)]], 'lazy'],
                    ['define', selected, localPairRecipe(recipeLocal, ['array', [ref(local)]]), 'lazy'], ['loop', inner],
                ]), body(['yield', []])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(output), 1), collectedMemo(ref(output)), ref(caller)]]], [
                ['define', caller, ['array', ['caller']], 'lazy'], ['loop', outer],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', fnBinding, ['function', fn], 'required'],
            ['define', first, ['()', ref(fnBinding), []], 'required'], ['define', second, ['()', ref(fnBinding), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        for (const invocation of value) {
            assert(invocation instanceof Array && invocation[0] instanceof Array && invocation[1] instanceof Array)
            for (const index of /** @type {const} */ ([0, 1])) {
                const iteration = invocation[index]
                assert(iteration instanceof Array && iteration[0] instanceof Array && iteration[1] instanceof Array && iteration[1][0] instanceof Array)
                assertEq(iteration[0][0], invocation[2])
                assertEq(iteration[0][1], index)
                assertEq(iteration[1], iteration[2])
                assertEq(iteration[1][0], iteration[1][1])
                assertEq(iteration[1][0][0], iteration[0])
            }
            assert(invocation[0][0] !== invocation[1][0])
            assert(invocation[0][1] !== invocation[1][1])
        }
        assert(value[0][2] !== value[1][2])
    },
    loopMemoOuterTransferMixedCompletions: () => {
        const mode = id(0), caller = id(0), dependent = id(0), count = id(0), output = id(0), observed = id(0), allocation = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['define', observed, ref(dependent), 'required'],
            ['if', [], ['===', ref(mode), 1], body(['return', target, ['array', [ref(dependent), ref(dependent), ref(caller), 'return']]]), body(['yield', []])],
            ['if', [], ['===', ref(mode), 2], body(['break', outerTarget, [ref(dependent)]]), body(['yield', []])],
            ['if', [], ['===', ref(mode), 3], body(['continue', outerTarget, [['+', ref(count), 1]]]), body(['yield', []])],
        ]))
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [ref(dependent)]], [
                ['if', [], ['<', ref(count), 1], body(['yield', []], [['loop', inner]]), body(['yield', []])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [mode], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(allocation), ref(allocation), ref(caller), 'normal']]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'], ['loop', outer],
                ['define', allocation, ['array', [ref(output), ref(dependent)]], 'required'],
            ]),
        })
        for (const selectedMode of /** @type {const} */ ([0, 1, 2, 3])) {
            const value = evaluate(calledFunction(fn, [selectedMode]))
            assert(value instanceof Array && value[0] instanceof Array)
            assertEq(value[0], value[1])
            if (selectedMode === 1) { assertEq(value[0][0], value[2]); assertEq(value[3], 'return') }
            else {
                assert(value[0][0] instanceof Array)
                assertEq(value[0][0], value[0][1])
                assertEq(value[0][0][0], value[2])
                assertEq(value[3], 'normal')
            }
        }
    },
    loopMemoOuterTransferFailuresAndSkippedWork: () => {
        const selected = id(0), caller = id(0), count = id(0), output = id(0), prefix = id(0), dead = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const fails of /** @type {const} */ ([false, true])) {
            const inner = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
                ['if', [], ref(selected), body(['break', outerTarget, [ref(caller)]], [
                    ['define', prefix, fails ? ['block', body(['throw', 'outer transfer prefix'])] : 1, 'required'],
                ]), body(['break', outerTarget, [7]])],
                ['define', dead, ['block', body(['throw', 'unreachable transfer suffix'])], 'required'],
            ]))
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [count], initial: [0], results: [output],
                body: body(['break', outerTarget, [9]], [['loop', inner]]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [
                    ['define', caller, fails ? ['array', [4]] : ['block', body(['throw', 'selected outer transfer recipe'])], 'lazy'], ['loop', outer],
                ]),
            })
            assertEq(evaluate(calledFunction(fn, [false])), 7)
            assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true]))))({ args: [] })),
                fails ? 'outer transfer prefix' : 'selected outer transfer recipe')
        }
    },
    loopMemoOuterTransferMetadataAndRoundTrip: () => {
        const again = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), caller = id(0), selected = id(0), local = id(0)
        const count = id(0), output = id(0), observed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = exitMemoLoop(() => body(['continue', outerTarget, [['+', ref(count), 1]]], [['define', observed, ref(selected), 'required']]))
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [ref(selected)]], [
                ['if', [], ['<', ref(count), 1], body(['yield', []], [['loop', inner]]), body(['yield', []])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [again, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller), ref(rest), ref(captured)]]], [
                ['if', [], ref(again), body(['return', target, ['()', ref(self), [false, ['+', ref(argument), 1], 99]]]), body(['yield', []])],
                ['define', caller, ['array', [ref(captured), ref(argument)]], 'lazy'],
                ['define', selected, localPairRecipe(local, ['array', [ref(caller), ref(rest)]]), 'lazy'], ['loop', outer],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 2)
        assertEq(graph[2].length, 1)
        assert(assertOk(identityAnalysis(graph)).nodes.some(node => node[0] === 'self'))
        const value = evaluate(calledFunction(fn, [false, 5, 7, 8]))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array && value[2] instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[2])
        assertEq(value[0][0][1], value[3])
        assertEq(value[2][0], value[4])
        assertStructurallySame(value[2], [[4], 5])
        assertStructurallySame(value[3], [7, 8])
        const recurred = evaluate(calledFunction(fn, [true, 5]))
        assert(recurred instanceof Array)
        assertStructurallySame(recurred[2], [[4], 6])
        assertStructurallySame(recurred[3], [99])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        // Reconstructed required-order anchors normalize after memo pack inlining.
        const fourth = fromFast(assertOk(toFast(third)))
        assertStructurallySame(assertOk(identityAnalysis(fourth)), assertOk(identityAnalysis(third)))
        for (const normalized of [second, third]) {
            const repeated = evaluate(['()', normalized, [false, 5, 7, 8]])
            assertStructurallySame(repeated, value)
            assert(repeated instanceof Array && repeated[0] instanceof Array && repeated[0][0] instanceof Array && repeated[2] instanceof Array)
            assertEq(repeated[0], repeated[1])
            assertEq(repeated[0][0], repeated[0][1])
            assertEq(repeated[0][0][0], repeated[2])
            assertEq(repeated[0][0][1], repeated[3])
            assertEq(repeated[2][0], repeated[4])
            assertStructurallySame(evaluate(['()', normalized, [true, 5]]), recurred)
        }
    },
    loopMemoReturnNestedIdentity: () => {
        const caller = id(0), dependent = id(0), dead = id(0)
        const inner = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], true, body(['return', target, ['array', [ref(dependent), ref(dependent), ref(caller)]]]), body(['yield', []])],
        ]))
        const outer = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [['loop', inner]]))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'],
                ['loop', outer], ['define', dead, ['block', body(['throw', 'unreachable nested suffix'])], 'required'],
            ]),
        })
        const value = evaluate(calledFunction(fn))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[2])
    },
    loopMemoReturnFirstLastAndNormalIterations: () => {
        const stop = id(0), caller = id(0), dependent = id(0), count = id(0), saved = id(0), output = id(0), observed = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [ref(count), ref(saved)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', loopTarget, [['+', ref(count), 1], ref(dependent)]], [
                    ['define', observed, ref(dependent), 'required'],
                    ['if', [], ['===', ref(count), ref(stop)],
                        body(['return', target, ['array', [ref(dependent), ref(dependent), ref(caller), ref(count), 'returned']]]), body(['yield', []])],
                ]), body(['break', loopTarget, [ref(saved)]])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(dependent), ref(caller), 3, 'normal']]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'], ['loop', loop],
            ]),
        })
        for (const stopAt of /** @type {const} */ ([0, 2, 99])) {
            const value = evaluate(calledFunction(fn, [stopAt]))
            assert(value instanceof Array && value[0] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0][0], value[2])
            assertEq(value[3], stopAt === 99 ? 3 : stopAt)
            assertEq(value[4], stopAt === 99 ? 'normal' : 'returned')
        }
    },
    loopMemoReturnCapturedLocalLifetimes: () => {
        const caller = id(0), local = id(0), selected = id(0), recipeLocal = id(0), captured = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), repeated = id(0), second = id(0)
        const userTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const userFn = /** @type {FastFunction} */ ({
            target: userTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(selected) }],
            body: body(['return', userTarget, ['array', [ref(captured), ref(captured)]]]),
        })
        const inner = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], ['===', ['.', ref(local), 1], 1], body(['return', target, ['function', userFn]]), body(['yield', []])],
        ]))
        const outer = collectingInnerMemo(inner, 3, true, ref(selected), index => [
            ['define', local, ['array', [ref(caller), index]], 'lazy'],
            ['define', selected, localPairRecipe(recipeLocal, ['array', [ref(local)]]), 'lazy'],
        ])
        const factory = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, null], [['define', caller, ['array', ['caller']], 'lazy'], ['loop', outer]]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(repeated), ref(second)]], [
            ['define', factoryBinding, ['function', factory], 'required'],
            ['define', firstFn, ['()', ref(factoryBinding), []], 'required'], ['define', secondFn, ['()', ref(factoryBinding), []], 'required'],
            ['define', first, ['()', ref(firstFn), []], 'required'], ['define', repeated, ['()', ref(firstFn), []], 'required'],
            ['define', second, ['()', ref(secondFn), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[2] instanceof Array)
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0], value[1][0])
        assertEq(value[2][0], value[2][1])
        const left = value[0][0], right = value[2][0]
        assert(left instanceof Array && right instanceof Array && left[0] instanceof Array && right[0] instanceof Array
            && left[0][0] instanceof Array && right[0][0] instanceof Array)
        assertEq(left[0], left[1])
        assertEq(right[0], right[1])
        assertStructurallySame(left[0][0], [['caller'], 1])
        assertStructurallySame(right[0][0], [['caller'], 1])
        assert(left !== right && left[0] !== right[0] && left[0][0] !== right[0][0])
    },
    loopMemoReturnSelectedAndSkippedRecipes: () => {
        const selected = id(0), caller = id(0), output = id(0)
        const loop = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], ref(selected), body(['return', target, ['array', [ref(caller), ref(caller)]]]), body(['yield', []])],
        ]))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, 7], [['define', caller, ['block', body(['throw', 'selected return recipe'])], 'lazy'], ['loop', loop]]),
        })
        assertEq(evaluate(calledFunction(fn, [false])), 7)
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true]))))({ args: [] })), 'selected return recipe')
        const literalFalse = exitMemoLoop(loopTarget => body(['break', loopTarget, [7]], [
            ['if', [], false, body(['return', target, ref(caller)]), body(['break', loopTarget, [7]])],
        ]), [output])
        const skipped = /** @type {FastFunction} */ ({ ...fn, parameters: [], body: body(['return', target, 9], [
            fn.body.statements[0], ['loop', literalFalse],
        ]) })
        assertEq(evaluate(calledFunction(skipped)), 9)
        const local = id(0)
        const innerTrue = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], true, body(['return', target, ref(local)]), body(['yield', []])],
        ]))
        const outer = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['define', local, ['array', [3]], 'lazy'], ['loop', innerTrue],
        ]))
        const returned = /** @type {FastFunction} */ ({ ...fn, parameters: [], body: body(['return', target, 9], [['loop', outer]]) })
        assertStructurallySame(evaluate(calledFunction(returned)), [3])
    },
    loopMemoReturnRequiredPrefixes: () => {
        const selected = id(0), caller = id(0), prefix = id(0), suffix = id(0)
        for (const fails of /** @type {const} */ ([false, true])) {
            const loop = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
                ['define', prefix, fails ? ['block', body(['throw', 'required return prefix'])] : ['array', [4]], 'required'],
                ['if', [], ref(selected), body(['return', target, ref(caller)]), body(['return', target, 7])],
                ['define', suffix, ['block', body(['throw', 'unreachable helper suffix'])], 'required'],
            ]))
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [
                    ['define', caller, ['block', body(['throw', 'unused return recipe'])], 'lazy'], ['loop', loop],
                    ['define', suffix, ['block', body(['throw', 'unreachable caller suffix'])], 'required'],
                ]),
            })
            const graph = calledFunction(fn, [false])
            if (fails) { assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'required return prefix') }
            else { assertEq(evaluate(graph), 7) }
        }
    },
    loopMemoReturnSequentialState: () => {
        const selected = id(0), caller = id(0), dependent = id(0), output = id(0), allocation = id(0)
        const first = collectingMemo(ref(dependent), 2)
        const second = exitMemoLoop(loopTarget => body(['break', loopTarget, [['array', [ref(dependent), ref(caller)]]]], [
            ['if', [], ref(selected), body(['return', target, ['array', [collectedMemo(ref(first.results[0])), ref(dependent), ref(caller)]]]), body(['yield', []])],
        ]), [output])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(allocation), ref(allocation), ref(dependent), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', dependent, ['array', [ref(caller)]], 'lazy'],
                ['loop', first], ['loop', second], ['define', allocation, ['array', [ref(output), ref(dependent)]], 'required'],
            ]),
        })
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array && returned[0] instanceof Array)
        assertEq(returned[0], returned[1])
        assertEq(returned[0][0], returned[2])
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[0][0] instanceof Array && normal[2] instanceof Array)
        assertEq(normal[0], normal[1])
        assertEq(normal[0][0][0], normal[2])
        assertEq(normal[0][0][1], normal[3])
        assertEq(normal[0][1], normal[2])
        assertEq(normal[2][0], normal[3])
    },
    loopMemoReturnTagPayloadsAndResultArities: () => {
        const selected = id(0), caller = id(0), payload = id(0)
        for (const tag of /** @type {const} */ (['normal', 'return'])) {
            for (const normalValues of /** @type {readonly (readonly Value[])[]} */ ([[], [0], [1, 2, 3]])) {
                const outputs = normalValues.map(() => id(0))
                const loop = exitMemoLoop(loopTarget => body(['break', loopTarget, normalValues], [
                    ['if', [], ref(selected), body(['return', target, ref(payload)]), body(['yield', []])],
                ]), outputs)
                const fn = /** @type {FastFunction} */ ({
                    target, parameters: [selected], rest: null, self: null, captures: [],
                    body: body(['return', target, ['array', [['array', outputs.map(ref)], ref(payload), ref(caller)]]], [
                        ['define', caller, ['array', [4]], 'lazy'], ['define', payload, ['array', [tag, ['array', [ref(caller)]]]], 'lazy'], ['loop', loop],
                    ]),
                })
                assertStructurallySame(evaluate(calledFunction(fn, [true])), [tag, [[4]]])
                const normal = evaluate(calledFunction(fn, [false]))
                assert(normal instanceof Array && normal[1] instanceof Array && normal[1][1] instanceof Array)
                assertStructurallySame(normal[0], normalValues)
                assertEq(normal[1][0], tag)
                assertEq(normal[1][1][0], normal[2])
            }
        }
    },
    loopMemoReturnMetadataAndRoundTrip: () => {
        const again = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), caller = id(0), selected = id(0), local = id(0)
        const loop = exitMemoLoop(loopTarget => body(['break', loopTarget, []], [
            ['if', [], ref(again), body(['return', target, ['()', ref(self), [false, ['+', ref(argument), 1], 99]]]),
                body(['return', target, ['array', [ref(selected), ref(selected), ref(caller), ref(rest), ref(captured)]]])],
        ]))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [again, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, 9], [
                ['define', caller, ['array', [ref(captured), ref(argument)]], 'lazy'],
                ['define', selected, localPairRecipe(local, ['array', [ref(caller), ref(rest)]]), 'lazy'], ['loop', loop],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 2)
        assertEq(graph[2].length, 1)
        assert(assertOk(identityAnalysis(graph)).nodes.some(node => node[0] === 'self'))
        const value = evaluate(calledFunction(fn, [false, 5, 7, 8]))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array && value[2] instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[2])
        assertEq(value[0][0][1], value[3])
        assertEq(value[2][0], value[4])
        assertStructurallySame(value[2], [[4], 5])
        assertStructurallySame(value[3], [7, 8])
        const recurred = evaluate(calledFunction(fn, [true, 5, 7, 8]))
        assert(recurred instanceof Array)
        assertStructurallySame(recurred[2], [[4], 6])
        assertStructurallySame(recurred[3], [99])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        assertStructurallySame(assertOk(identityAnalysis(fourth)), assertOk(identityAnalysis(third)))
        for (const normalized of [second, third]) {
            const repeated = evaluate(['()', normalized, [false, 5, 7, 8]])
            assertStructurallySame(repeated, value)
            assert(repeated instanceof Array && repeated[0] instanceof Array && repeated[0][0] instanceof Array && repeated[2] instanceof Array)
            assertEq(repeated[0], repeated[1])
            assertEq(repeated[0][0], repeated[0][1])
            assertEq(repeated[0][0][0], repeated[2])
            assertEq(repeated[0][0][1], repeated[3])
            assertEq(repeated[2][0], repeated[4])
            assertStructurallySame(evaluate(['()', normalized, [true, 5, 7, 8]]), recurred)
        }
    },
    loopMemoRecipeLocalIdentity: () => {
        const caller = id(0), selected = id(0), local = id(0)
        const loop = collectingMemo(ref(selected), 2)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(selected), ref(caller),
        ]], [
            ['define', caller, ['array', [4]], 'lazy'],
            ['define', selected, localPairRecipe(local, ['array', [ref(caller)]]), 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
        assertStructurallySame(value, [[[[4]], [[4]]], [[[4]], [[4]]], [[[4]], [[4]]], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[3])
    },
    loopMemoRecipeLocalSkippedFailures: () => {
        const entered = id(0), choice = id(0), caller = id(0), selected = id(0), local = id(0), unused = id(0)
        const initializer = /** @type {Value} */ (['block', result(['if', ref(choice), result(ref(local)), result(['array', [7]])], [
            ['define', local, ['array', [ref(caller), ['block', body(['throw', 'recipe local'])]]], 'lazy'],
            ['define', unused, ['array', [ref(local), ['block', body(['throw', 'unused recipe local'])]]], 'lazy'],
        ])])
        const loop = collectingMemo(ref(selected), 2, ref(entered))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [entered, choice], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', loop],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [false, true])), [null, [4]])
        assertStructurallySame(evaluate(calledFunction(fn, [true, false])), [[7], [4]])
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true, true]))))({ args: [] })), 'recipe local')
    },
    loopMemoRecipeLocalIterationReset: () => {
        const caller = id(0), selected = id(0), local = id(0)
        const inner = collectingMemo(ref(selected), 2)
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(selected)]], index => [
            ['define', selected, localPairRecipe(local, ['array', [ref(caller), index]]), 'lazy'],
        ])
        const value = evaluate(fromFast(result(['array', [innerObservations(outer), ref(caller)]], [
            ['define', caller, ['array', ['caller']], 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertEq(value[0].length, 2)
        for (const index of /** @type {const} */ ([0, 1])) {
            const iteration = value[0][index]
            assert(iteration instanceof Array && iteration[0] instanceof Array && iteration[0][0] instanceof Array)
            assertEq(iteration[0], iteration[1])
            assertEq(iteration[0], iteration[2])
            assertEq(iteration[0][0], iteration[0][1])
            assertEq(iteration[0][0][0], value[1])
            assertEq(iteration[0][0][1], index)
        }
        assert(value[0][0] instanceof Array && value[0][1] instanceof Array && value[0][0][0] instanceof Array && value[0][1][0] instanceof Array)
        assert(value[0][0][0] !== value[0][1][0])
        assert(value[0][0][0][0] !== value[0][1][0][0])
    },
    loopMemoRecipeLocalNestedDiamond: () => {
        const caller = id(0), selected = id(0), shared = id(0), left = id(0), right = id(0), joined = id(0), wrapped = id(0), nested = id(0)
        const initializer = /** @type {Value} */ (['block', result(['array', [ref(wrapped), ref(joined), ref(shared), ref(left), ref(right)]], [
            ['define', shared, ['array', [ref(caller)]], 'lazy'],
            ['define', left, ['array', [ref(shared), 'left']], 'lazy'],
            ['define', right, ['array', [ref(shared), 'right']], 'lazy'],
            ['define', joined, ['array', [ref(right), ref(left)]], 'lazy'],
            ['define', wrapped, localPairRecipe(nested, ['array', [ref(joined)]]), 'lazy'],
        ])])
        const loop = collectingMemo(ref(selected), 2)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ref(selected), ref(caller)]], [
            ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertEq(value[0], value[1])
        const payload = value[0]
        assert(payload[0] instanceof Array && payload[0][0] instanceof Array && payload[1] instanceof Array
            && payload[2] instanceof Array && payload[3] instanceof Array && payload[4] instanceof Array)
        assertEq(payload[0][0], payload[0][1])
        assertEq(payload[0][0][0], payload[1])
        assertEq(payload[1][0], payload[4])
        assertEq(payload[1][1], payload[3])
        assertEq(payload[3][0], payload[2])
        assertEq(payload[4][0], payload[2])
        assertEq(payload[2][0], value[2])
        assert(payload[3] !== payload[4])
    },
    loopMemoRecipeLocalSurvivesOuterMiss: () => {
        const caller = id(0), other = id(0), selected = id(0), local = id(0), before = id(0), missed = id(0)
        const initializer = /** @type {Value} */ (['block', result(['array', [ref(before), ref(local), ref(missed), ref(other), ref(caller)]], [
            ['define', local, ['array', [ref(caller)]], 'lazy'],
            ['define', before, ref(local), 'required'],
            ['define', missed, ref(other), 'required'],
        ])])
        const loop = collectingMemo(ref(selected), 2)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ref(selected), ref(caller), ref(other)]], [
            ['define', caller, ['array', [4]], 'lazy'], ['define', other, ['array', [9]], 'lazy'],
            ['define', selected, initializer, 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
        assertStructurallySame(value[0], [[[4]], [[4]], [9], [9], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[2])
        assertEq(value[0][4], value[2])
        assertEq(value[0][2], value[3])
        assertEq(value[0][3], value[3])
    },
    loopMemoRecipeLocalSiblingScopesAndSharedAst: () => {
        const prerequisite = id(0), first = id(0), second = id(0), local = id(0), output = id(0)
        const shared = localPairRecipe(local, ['array', [ref(prerequisite)]])
        const firstLoop = collectingMemo(ref(first), 2), secondLoop = collectingMemo(ref(second), 2)
        for (const reused of /** @type {const} */ ([false, true])) {
            const initializer = reused ? shared : localPairRecipe(local, ['array', [ref(prerequisite), 'sibling']])
            const value = evaluate(fromFast(result(['array', [ref(first), ref(output), ref(prerequisite)]], [
                ['define', prerequisite, 1, 'required'], ['define', first, shared, 'lazy'], ['loop', firstLoop],
                ['block', [output], result(ref(second), [
                    ['define', prerequisite, 2, 'required'], ['define', second, initializer, 'lazy'], ['loop', secondLoop],
                ])],
            ])))
            assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[0][0] instanceof Array && value[1][0] instanceof Array)
            assertEq(value[0][0], value[0][1])
            assertEq(value[1][0], value[1][1])
            assertEq(value[0][0][0], 1)
            assertEq(value[1][0][0], 2)
            assertEq(value[2], 1)
            assert(value[0] !== value[1])
            assert(value[0][0] !== value[1][0])
            assertStructurallySame(value[1][0], reused ? [2] : [2, 'sibling'])
        }
    },
    loopMemoRecipeLocalFunctionCaptureAndOwnership: () => {
        const caller = id(0), selected = id(0), local = id(0), captured = id(0), ordinaryLocal = id(0), first = id(0), second = id(0)
        const functionTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {FastFunction} */ ({
            target: functionTarget, parameters: [caller], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', functionTarget, ['array', [ref(ordinaryLocal), ref(ordinaryLocal)]]], [
                ['define', ordinaryLocal, ['array', [ref(caller), ref(captured)]], 'lazy'],
            ]),
        })
        const initializer = /** @type {Value} */ (['block', result(['function', fn], [['define', local, ['array', [ref(caller)]], 'lazy']])])
        const loop = collectingMemo(ref(selected), 2)
        const value = evaluate(fromFast(result(['array', [
            ref(first), ref(second), ref(caller), ['===', collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0]))],
        ]], [
            ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', loop],
            ['define', first, ['()', ref(selected), [7]], 'required'], ['define', second, ['()', ref(selected), [8]], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array
            && value[0][0] instanceof Array && value[1][0] instanceof Array && value[0][0][1] instanceof Array)
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assertEq(value[0][0][0], 7)
        assertEq(value[1][0][0], 8)
        assertEq(value[0][0][1], value[1][0][1])
        assertEq(value[0][0][1][0], value[2])
        assert(value[0][0] !== value[1][0])
        assertEq(value[3], true)
    },
    loopMemoRecipeLocalMetadataAndRoundTrip: () => {
        const again = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), caller = id(0), selected = id(0), local = id(0)
        const loop = collectingMemo(ref(selected), 2)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [again, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(selected), ref(caller), ref(rest), ref(captured)]]], [
                ['if', [], ref(again), body(['return', target, ['()', ref(self), [false, ['+', ref(argument), 1], 99]]]), body(['yield', []])],
                ['define', caller, ['array', [ref(captured), ref(argument)]], 'lazy'],
                ['define', selected, localPairRecipe(local, ['array', [ref(caller), ref(rest)]]), 'lazy'], ['loop', loop],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 2)
        assertEq(graph[2].length, 1)
        assert(assertOk(identityAnalysis(graph)).nodes.some(node => node[0] === 'self'))
        const value = evaluate(calledFunction(fn, [false, 5, 7, 8]))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array && value[2] instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0][0], value[2])
        assertEq(value[0][0][1], value[3])
        assertEq(value[2][0], value[4])
        assertStructurallySame(value[2], [[4], 5])
        assertStructurallySame(value[3], [7, 8])
        const recurred = evaluate(calledFunction(fn, [true, 5, 7, 8]))
        assert(recurred instanceof Array)
        assertStructurallySame(recurred[2], [[4], 6])
        assertStructurallySame(recurred[3], [99])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        assertStructurallySame(assertOk(identityAnalysis(fourth)), assertOk(identityAnalysis(third)))
        for (const normalized of [second, third]) {
            const repeated = evaluate(['()', normalized, [false, 5, 7, 8]])
            assertStructurallySame(repeated, value)
            assert(repeated instanceof Array && repeated[0] instanceof Array && repeated[0][0] instanceof Array && repeated[2] instanceof Array)
            assertEq(repeated[0], repeated[1])
            assertEq(repeated[0][0], repeated[0][1])
            assertEq(repeated[0][0][0], repeated[2])
            assertEq(repeated[0][0][1], repeated[3])
            assertEq(repeated[2][0], repeated[4])
            assertStructurallySame(evaluate(['()', normalized, [true, 5, 7, 8]]), recurred)
        }
    },
    loopMemoIterationLocalIdentity: () => {
        const local = id(0)
        const inner = collectingMemo(ref(local), 2)
        const outer = collectingInnerMemo(inner, 3, true, ['array', [ref(inner.results[0]), ref(local)]],
            index => [['define', local, ['array', [index]], 'lazy']])
        // No caller-owned recipe makes the outer helper free in this fixture.
        const block = result(innerObservations(outer, 3), [['loop', outer]])
        const graph = fromFast(block)
        const value = evaluate(graph)
        assert(value instanceof Array)
        assertStructurallySame(value, [[[0], [0], [0]], [[1], [1], [1]], [[2], [2], [2]]])
        for (const iteration of value) {
            assert(iteration instanceof Array)
            assertEq(iteration[0], iteration[1])
            assertEq(iteration[0], iteration[2])
        }
        assert(value[0] instanceof Array && value[1] instanceof Array && value[2] instanceof Array)
        assert(value[0][0] !== value[1][0] && value[1][0] !== value[2][0])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        const repeated = evaluate(third)
        assert(repeated instanceof Array)
        for (const iteration of repeated) {
            assert(iteration instanceof Array)
            assertEq(iteration[0], iteration[2])
        }
    },
    loopMemoIterationLocalDeclarationSnapshot: () => {
        const prerequisite = id(0), local = id(0)
        const inner = collectingMemo(ref(local), 2)
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(prerequisite)]], index => [
            ['define', prerequisite, index, 'required'],
            ['define', local, ['array', [ref(prerequisite)]], 'lazy'],
            ['define', prerequisite, ['+', index, 100], 'required'],
        ])
        const value = evaluate(fromFast(result(['array', [innerObservations(outer), ref(prerequisite)]], [
            ['define', prerequisite, ['array', [9]], 'required'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[[0], [0], 100], [[1], [1], 101]], [9]])
        for (const iteration of value[0]) {
            assert(iteration instanceof Array)
            assertEq(iteration[0], iteration[1])
        }
    },
    loopMemoIterationLocalCallerDependency: () => {
        const caller = id(0), local = id(0), unused = id(0)
        const inner = collectingMemo(ref(local), 2), following = collectingMemo(ref(caller), 1)
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(local)]], index => [
            ['define', local, ['array', [ref(caller), index]], 'lazy'],
            ['define', unused, ['array', [ref(caller), ['block', body(['throw', 'unused local dependent'])]]], 'lazy'],
        ])
        const value = evaluate(fromFast(result(['array', [innerObservations(outer), ref(caller), collectedMemo(ref(following.results[0]))]], [
            ['define', caller, ['array', ['caller']], 'lazy'], ['loop', outer], ['loop', following],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [
            [[[['caller'], 0], [['caller'], 0], [['caller'], 0]], [[['caller'], 1], [['caller'], 1], [['caller'], 1]]],
            ['caller'], ['caller'],
        ])
        for (const iteration of value[0]) {
            assert(iteration instanceof Array && iteration[0] instanceof Array)
            assertEq(iteration[0], iteration[1])
            assertEq(iteration[0], iteration[2])
            assertEq(iteration[0][0], value[1])
        }
        assert(value[0][0] instanceof Array && value[0][1] instanceof Array)
        assert(value[0][0][0] !== value[0][1][0])
        assertEq(value[1], value[2])
    },
    loopMemoIterationLocalInnerAliases: () => {
        const caller = id(0), local = id(0), alias = id(0), callerAlias = id(0)
        const source = collectingMemo(['array', [ref(alias), ref(callerAlias)]], 2)
        const inner = /** @type {Loop} */ ({ ...source, body: { ...source.body, statements: [
            ['define', alias, ref(local), 'lazy'], ['define', callerAlias, ref(caller), 'lazy'], ...source.body.statements,
        ] } })
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(local)]],
            index => [['define', local, ['array', [index]], 'lazy']])
        const value = evaluate(fromFast(result(['array', [innerObservations(outer), ref(caller)]], [
            ['define', caller, ['array', ['caller']], 'lazy'], ['loop', outer],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [
            [[[[0], ['caller']], [[0], ['caller']], [0]], [[[1], ['caller']], [[1], ['caller']], [1]]], ['caller'],
        ])
        for (const iteration of value[0]) {
            assert(iteration instanceof Array && iteration[0] instanceof Array && iteration[1] instanceof Array)
            assertEq(iteration[0][0], iteration[1][0])
            assertEq(iteration[0][0], iteration[2])
            assertEq(iteration[0][1], value[1])
            assertEq(iteration[1][1], value[1])
        }
        assert(value[0][0] instanceof Array && value[0][1] instanceof Array)
        assert(value[0][0][2] !== value[0][1][2])
    },
    loopMemoIterationLocalSkippedDemands: () => {
        const local = id(0), selectedResult = id(0)
        for (const outerLimit of /** @type {const} */ ([0, 2])) {
            for (const innerLimit of /** @type {const} */ ([0, 2])) {
                for (const selected of /** @type {const} */ ([false, true])) {
                    const inner = collectingMemo(ref(local), innerLimit)
                    /** @type {(index: Value) => readonly Statement[]} */
                    const declarations = () => [['define', local, ['block', body(['throw', 'local recipe'])], 'lazy']]
                    const outer = collectingInnerMemo(inner, outerLimit, selected, ref(inner.results[0]), declarations)
                    const graph = fromFast(afterLoop(outer, 7))
                    if (outerLimit !== 0 && innerLimit !== 0 && selected) {
                        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'local recipe')
                    } else { assertEq(evaluate(graph), 7) }
                    const following = collectingInnerMemo(inner, outerLimit, selected, ref(local), declarations)
                    const demanded = fromFast(afterLoop(following, 7))
                    if (outerLimit !== 0 && selected) {
                        assertEq(assertError(memo(assertOk(identityAnalysis(demanded)))({ args: [] })), 'local recipe')
                    } else { assertEq(evaluate(demanded), 7) }
                    assertEq(evaluate(fromFast(result(ref(selectedResult), [
                        ['if', [selectedResult], false, afterLoop(outer, 7), result(9)],
                    ]))), 9)
                }
            }
        }
    },
    loopMemoIterationLocalResetDepthAndBindingReuse: () => {
        const local = id(0), outerSnapshot = id(0)
        const inner = collectingMemo(ref(local), 2)
        const middle = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ref(local), ref(outerSnapshot)]], index => [
            ['define', outerSnapshot, ref(local), 'required'], ['define', local, ['array', ['middle', index]], 'lazy'],
        ])
        const outer = collectingInnerMemo(middle, 2, true, ['array', [ref(middle.results[0]), ref(local)]],
            index => [['define', local, ['array', ['outer', index]], 'lazy']])
        const observations = /** @type {Value} */ (['array', [1, 0].map(ago => {
            const iteration = collectedMemo(ref(outer.results[0]), ago)
            const middleHistory = /** @type {Value} */ (['.', iteration, 0])
            return /** @type {Value} */ (['array', [
                ...[1, 0].map(middleAgo => {
                    const current = collectedMemo(middleHistory, middleAgo)
                    const innerHistory = /** @type {Value} */ (['.', current, 0])
                    return /** @type {Value} */ (['array', [collectedMemo(innerHistory, 1), collectedMemo(innerHistory), ['.', current, 1], ['.', current, 2]]])
                }), ['.', iteration, 1],
            ]])
        })])
        const value = evaluate(fromFast(afterLoop(outer, observations)))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [
            [[['middle', 0], ['middle', 0], ['middle', 0], ['outer', 0]], [['middle', 1], ['middle', 1], ['middle', 1], ['outer', 0]], ['outer', 0]],
            [[['middle', 0], ['middle', 0], ['middle', 0], ['outer', 1]], [['middle', 1], ['middle', 1], ['middle', 1], ['outer', 1]], ['outer', 1]],
        ])
        for (const iteration of value) {
            assert(iteration instanceof Array && iteration[0] instanceof Array && iteration[1] instanceof Array)
            for (const current of iteration.slice(0, 2)) {
                assert(current instanceof Array)
                assertEq(current[0], current[1])
                assertEq(current[0], current[2])
                assertEq(current[3], iteration[2])
                assert(current[0] !== iteration[2])
            }
            assert(iteration[0][0] !== iteration[1][0])
        }
        assert(value[0][0] instanceof Array && value[1][0] instanceof Array)
        assert(value[0][0][0] !== value[1][0][0])
        assert(value[0][2] !== value[1][2])
    },
    loopMemoIterationLocalFunctionCapturesAndInvocations: () => {
        const local = id(0), userFn = id(0), captured = id(0), fnBinding = id(0), first = id(0), second = id(0)
        const userTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {FastFunction} */ ({
            target: userTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', userTarget, ref(captured)]),
        })
        const inner = collectingMemo(['===', ['()', ref(userFn), []], ref(local)], 2)
        const outer = collectingInnerMemo(inner, 2, true, ['array', [ref(inner.results[0]), ['()', ref(userFn), []]]], index => [
            ['define', local, ['array', [index]], 'lazy'], ['define', userFn, ['function', getter], 'required'],
        ])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, innerObservations(outer)], [['loop', outer]]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', fnBinding, ['function', fn], 'required'],
            ['define', first, ['()', ref(fnBinding), []], 'required'], ['define', second, ['()', ref(fnBinding), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [
            [[true, true, [0]], [true, true, [1]]], [[true, true, [0]], [true, true, [1]]],
        ])
        for (const invocation of value) {
            assert(invocation instanceof Array && invocation[0] instanceof Array && invocation[1] instanceof Array)
            for (const iteration of invocation) {
                assert(iteration instanceof Array)
                assertEq(iteration[0], true)
                assertEq(iteration[1], true)
            }
            assert(invocation[0][2] !== invocation[1][2])
        }
        assert(value[0][0] instanceof Array && value[1][0] instanceof Array)
        assert(value[0][0][2] !== value[1][0][2])
    },
    loopMemoIterationLocalZeroResultDemand: () => {
        const local = id(0), observed = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [],
            body: body(['break', loopTarget, []], [['define', observed, ref(local), 'required']]),
        })
        const outer = collectingInnerMemo(inner, 2, true, ref(local), index => [['define', local, ['array', [index]], 'lazy']])
        const value = evaluate(fromFast(afterLoop(outer, ['array', [collectedMemo(ref(outer.results[0]), 1), collectedMemo(ref(outer.results[0]))]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[0], [1]])
        assert(value[0] !== value[1])
        const failing = collectingInnerMemo(inner, 2, true, 7,
            () => [['define', local, ['block', body(['throw', 'required local demand'])], 'lazy']])
        const failed = fromFast(afterLoop(failing, 9))
        assertEq(assertError(memo(assertOk(identityAnalysis(failed)))({ args: [] })), 'required local demand')
    },
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
        for (const normalized of [secondGraph, thirdGraph]) {
            const repeated = evaluate(normalized)
            assertStructurallySame(repeated, value)
            assert(repeated instanceof Array)
            for (const observed of repeated.slice(0, 5)) { assertEq(observed, repeated[0]) }
            assert(repeated[5] !== repeated[6])
        }
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
        const foreign = /** @type {const} */ ({ ...target })
        const loop = /** @type {Loop} */ ({ ...source, body: body(['return', foreign, ref(dependent)]) })
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
        for (const normalized of [second, third]) {
            const repeated = evaluate(normalized)
            assertStructurallySame(repeated, value)
            assert(repeated instanceof Array)
            for (const observed of repeated) { assertEq(observed, repeated[0]) }
        }
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
                for (let level = length - 1; level > 0; level -= 1) {
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
        loopMemoReturnWithoutOwner: () => {
            const caller = id(0)
            const loop = exitMemoLoop(() => body(['return', target, ref(caller)]))
            fromFast(result(7, [['define', caller, ['array', [4]], 'lazy'], ['loop', loop]]))
        },
        loopMemoOuterTransferForeignTarget: () => {
            const caller = id(0), output = id(0)
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const foreign = /** @type {const} */ ({ ...outerTarget })
            const inner = exitMemoLoop(() => body(['break', foreign, [ref(caller)]]))
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [output],
                body: body(['break', outerTarget, [null]], [['loop', inner]]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['define', caller, ['array', [4]], 'lazy'], ['loop', outer]]),
            })
            calledFunction(fn)
        },
        loopMemoOuterTransferSiblingTarget: () => {
            const caller = id(0), observed = id(0)
            const sibling = exitMemoLoop(loopTarget => body(['break', loopTarget, []]))
            const invalid = exitMemoLoop(() => body(['break', sibling.target, []], [['define', observed, ref(caller), 'required']]))
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 7], [['define', caller, ['array', [4]], 'lazy'], ['loop', sibling], ['loop', invalid]]),
            })
            calledFunction(fn)
        },
        loopMemoOuterTransferCrossFunction: () => {
            const caller = id(0), output = id(0), fnBinding = id(0), observed = id(0)
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
            const invalid = exitMemoLoop(() => body(['break', outerTarget, [ref(caller)]]))
            const nested = /** @type {FastFunction} */ ({
                target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', nestedTarget, 9], [['define', caller, ['array', [4]], 'lazy'], ['loop', invalid]]),
            })
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [output],
                body: body(['break', outerTarget, [null]], [
                    ['define', fnBinding, ['function', nested], 'required'], ['define', observed, ['()', ref(fnBinding), []], 'required'],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['loop', outer]]),
            })
            calledFunction(fn)
        },
        loopMemoOuterTransferOperandBoundary: () => {
            const caller = id(0), output = id(0), observed = id(0)
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const invalid = exitMemoLoop(() => body(['break', outerTarget, [ref(caller)]]))
            const operand = /** @type {Value} */ (['block', body(['yield', [0]], [['loop', invalid]])])
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [output],
                body: body(['break', outerTarget, [7]], [['define', observed, operand, 'required']]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['define', caller, ['array', [4]], 'lazy'], ['loop', outer]]),
            })
            calledFunction(fn)
        },
        loopMemoReachableForeignReturnSuffix: () => {
            const selected = id(0), prerequisite = id(0), dependent = id(0)
            const source = collectingMemo(ref(dependent))
            const foreign = /** @type {const} */ ({ ...target })
            const loop = /** @type {Loop} */ ({ ...source, body: body(['return', foreign, ref(dependent)]) })
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
