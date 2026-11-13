/**
 * Operand-local declarations retain their selected demands behind consumers.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'
import { requiredFunction, failed, escape, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'
import { _acrossLoop as acrossLoop } from '../normal_memo_members/proof.f.mjs'
import { _collector as collector } from '../spread_returns/proof.f.mjs'
import { _deferred as deferred } from '../lazy_returns/proof.f.mjs'

/** The selected declaration is wholly inside this value's loop region. @type {(initializer: Value) => Value} */
export const _ownedLoopValue = initializer => {
    const local = id(0), innerOutput = id(0), outerOutput = id(0)
    const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return ['block', result(ref(outerOutput), [['loop', {
        target: outer, parameters: [], initial: [], results: [outerOutput], body: body(['break', outer, [ref(innerOutput)]], [
            ['define', local, initializer, 'lazy'],
            ['loop', { target: inner, parameters: [], initial: [], results: [innerOutput], body: body(['break', inner, [ref(local)]]) }],
        ]),
    }]])]
}

/** Preserve an actual source return owner while demanding the recipe twice. @type {(initializer: Value) => Exp} */
const calledRecipe = initializer => calledFunction(deferred(initializer, lazy => {
    const loop = collectingMemo(ref(lazy), 2)
    return body(['return', target, collectedMemo(ref(loop.results[0]))], [['loop', loop]])
}))

export const proof = /** @type {const} */ ({
    optionalCallSkipsWhollyOwnedNormalAndReturningCells: () => {
        for (const completion of /** @type {const} */ ([false, true])) {
            const initializer = completion ? mixed(false, failed('hidden optional demand')) : failed('hidden optional demand')
            assertEq(evaluate(calledRecipe(['?.()', null, [_ownedLoopValue(initializer)]])), undefined)
            assertEq(evaluate(calledRecipe(['?.()', undefined, [_ownedLoopValue(initializer)]])), undefined)
        }
    },
    reachedOptionalArgumentSharesItsWhollyOwnedCell: () => {
        const argument = id(0)
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        const value = evaluate(acrossLoop(['?.()', identity, [_ownedLoopValue(['array', [4]])]], lazy => ref(lazy), (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy),
        ]]))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertStructurallySame(evaluate(calledRecipe(['?.()', identity, [_ownedLoopValue(mixed(false, ['array', [4]]))]])), [4])
    },
    reachedOwnedReturnSkipsInvocationAndRemainingArguments: () => {
        const callee = /** @type {Value} */ (['function', { ...requiredFunction(0), body: body(['throw', 'skipped invocation']) }])
        assertEq(evaluate(calledRecipe(['?.()', callee, [_ownedLoopValue(escape(7)), failed('skipped argument suffix')]])), 7)
        assertEq(evaluate(calledRecipe(['()', callee, [_ownedLoopValue(escape(8)), failed('skipped argument suffix')]])), 8)
    },
    arrayCallObjectSpreadsAndEntriesExposeOwnedNormalCells: () => {
        for (const completion of /** @type {const} */ ([false, true])) {
            const array = _ownedLoopValue(completion ? mixed(false, ['array', [4, 5]]) : ['array', [4, 5]])
            const object = _ownedLoopValue(completion ? mixed(false, ['object', [[':', 'key', 4]]]) : ['object', [[':', 'key', 4]]])
            assertStructurallySame(evaluate(calledRecipe(['array', [0, ['...', array], 9]])), [0, 4, 5, 9])
            assertStructurallySame(evaluate(calledRecipe(['()', collector(), [0, ['...', array], 9]])), [0, 4, 5, 9])
            assertStructurallySame(evaluate(calledRecipe(['object', [[':', 'before', 1], ['...', object], [':', 'after', 9]]])), { before: 1, key: 4, after: 9 })
            assertStructurallySame(evaluate(calledRecipe(['object', [[':', 'key', array]]])), { key: [4, 5] })
        }
    },
    earlierExpansionsAndArgumentsPrecedeLaterOwnedReturns: () => {
        const returning = _ownedLoopValue(escape(7))
        failure(calledRecipe(['array', [['...', 0], returning]]))
        failure(calledRecipe(['()', collector(), [['...', 0], returning]]))
        assertEq(failure(calledRecipe(['()', collector(), [failed('earlier argument'), returning]])), 'earlier argument')
        assertEq(failure(calledRecipe(['object', [['...', failed('earlier object spread')], [':', 'key', returning]]])), 'earlier object spread')
        assertEq(evaluate(calledRecipe(['array', [['...', ['array', [1, 2]]], returning, failed('skipped array suffix')]])), 7)
    },
    computedObjectKeysConvertBeforeOwnedNormalOrReturningValues: () => {
        const key = /** @type {Value} */ (['object', [[':', 'toString', ['function', {
            ...requiredFunction('key'), body: body(['throw', 'key conversion']),
        }]]]])
        for (const inert of /** @type {const} */ ([false, true])) {
            for (const returning of /** @type {const} */ ([false, true])) {
                const value = _ownedLoopValue(returning ? escape(7) : ['array', [4]])
                assertEq(failure(calledRecipe(['object', [
                    ...inert ? [/** @type {const} */ (['...', ['object', []]])] : [], [':', key, value],
                ]])), 'key conversion')
            }
            const selected = evaluate(acrossLoop(['object', [
                ...inert ? [/** @type {const} */ (['...', ['object', []]])] : [],
                [':', ['object', [[':', 'toString', ['function', requiredFunction('converted')]]]], _ownedLoopValue(['array', [4]])],
            ]], lazy => ['.', ref(lazy), 'converted'], (lazy, loop) => ['array', [
                collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 'converted'],
            ]]))
            assert(selected instanceof Array)
            assertStructurallySame(selected, [[4], [4]])
            assertEq(selected[0], selected[1])
        }
    },
    nestedOwnedCellsKeepPrerequisitesAndCapturedIterationValues: () => {
        const prerequisite = id(0), local = id(0), alias = id(0), count = id(0), saved = id(0), output = id(0), captured = id(0)
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = collectingMemo(['array', [ref(local), ref(alias)]], 2)
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(local) }] }])
        const loop = /** @type {Loop} */ ({ target: outer, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', outer, [['+', ref(count), 1], ['array', [ref(saved), getter, ref(local), collectedMemo(ref(inner.results[0]))]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', outer, [ref(saved)]]), body(['yield', []])],
                ['define', local, ['array', [ref(prerequisite), ref(count)]], 'lazy'], ['define', alias, ref(local), 'lazy'], ['loop', inner],
            ]) })
        const argument = /** @type {Value} */ (['block', result(ref(output), [['define', prerequisite, ['array', [4]], 'lazy'], ['loop', loop]])])
        const parameter = id(0), identity = /** @type {Value} */ (['function', requiredFunction(ref(parameter), [parameter])])
        const value = evaluate(acrossLoop(['?.()', identity, [argument]], lazy => ref(lazy), lazy => {
            const previous = /** @type {Value} */ (['.', ref(lazy), 0])
            return ['array', [
                ['()', ['.', ref(lazy), 1], []], ['()', ['.', previous, 1], []], ['.', ref(lazy), 2], ['.', previous, 2],
                ['.', ref(lazy), 3], ['.', previous, 3],
            ]]
        }))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[4] instanceof Array && value[5] instanceof Array)
        assertStructurallySame(value, [[[4], 1], [[4], 0], [[4], 1], [[4], 0], [[[4], 1], [[4], 1]], [[[4], 0], [[4], 0]]])
        assertEq(value[0], value[2])
        assertEq(value[1], value[3])
        assert(value[0] !== value[1])
        assertEq(value[0][0], value[1][0])
        assertEq(value[4][0], value[0])
        assertEq(value[4][1], value[0])
        assertEq(value[5][0], value[1])
        assertEq(value[5][1], value[1])
    },
    functionCaptureValuesStayEagerInsideTheirSelectedRegion: () => {
        const argument = id(0), captured = id(0)
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        const skipped = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)),
            captures: [{ binding: captured, value: _ownedLoopValue(failed('skipped capture')) }],
        }])
        assertEq(evaluate(calledRecipe(['?.()', null, [skipped]])), undefined)
        const reached = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)),
            captures: [{ binding: captured, value: _ownedLoopValue(['array', [4]]) }],
        }])
        const value = evaluate(acrossLoop(['?.()', identity, [reached]], lazy => ['()', ref(lazy), []], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['()', ref(lazy), []],
        ]]))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    ordinaryFunctionBodiesKeepTheirOwnEvaluationBoundary: () => {
        const ordinary = /** @type {Value} */ (['function', requiredFunction(_ownedLoopValue(failed('uninvoked body')))])
        assertEq(evaluate(calledRecipe(['?.()', null, [ordinary]])), undefined)
        assertEq(evaluate(calledRecipe(['?.', ordinary, 'length'])), 0)
    },
    unusedRecipesAndUnselectedBranchesKeepOwnedCellsDeferred: () => {
        const unused = id(0)
        const argument = /** @type {Value} */ (['block', result(9, [['define', unused, _ownedLoopValue(failed('unused recipe')), 'lazy']])])
        const parameter = id(0), identity = /** @type {Value} */ (['function', requiredFunction(ref(parameter), [parameter])])
        assertEq(evaluate(calledRecipe(['?.()', identity, [argument]])), 9)
        assertStructurallySame(evaluate(calledRecipe(['array', [['...', ['?:', false,
            _ownedLoopValue(failed('unselected normal branch')), ['array', [9]],
        ]]]])), [9])
        assertStructurallySame(evaluate(calledRecipe(['array', [['...', ['?:', false,
            _ownedLoopValue(escape(7)), ['array', [9]],
        ]]]])), [9])
    },
    selectedDirectDeclarationsExposeWithoutAFreeAliasOrLoop: () => {
        const local = id(0), parameter = id(0)
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(parameter), [parameter])])
        const argument = /** @type {Value} */ (['block', result(ref(local), [['define', local, mixed(false, ['array', [4]]), 'lazy']])])
        assertEq(evaluate(calledRecipe(['?.()', null, [argument]])), undefined)
        assertStructurallySame(evaluate(calledRecipe(['?.()', identity, [argument]])), [4])
        assertEq(evaluate(calledRecipe(['?.()', identity, [['block', result(ref(local), [['define', local, escape(7), 'lazy']])]]])), 7)
    },
    nestedEagerRegionsFindTheirExactOwnedOccurrences: () => {
        const bound = id(0), state = id(0), output = id(0), parameter = id(0)
        const selected = _ownedLoopValue(['array', [4]])
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(parameter), [parameter])])
        const test = _ownedLoopValue(['block', result(true)])
        const entered = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const unrelated = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const wrappers = /** @type {readonly Value[]} */ ([
            ['block', result(ref(bound), [['define', bound, selected, 'required']])],
            ['block', result(ref(bound), [['block', [bound], result(selected)]])],
            ['block', result(ref(bound), [['if', [bound], true, result(selected), result(['array', [9]])]])],
            ['block', result(ref(bound), [['if', [bound], test, result(['array', [4]]), result(['array', [9]])]])],
            ['if', true, result(selected), result(['array', [9]])],
            ['if', test, result(['array', [4]]), result(['array', [9]])],
            ['block', result(selected)],
            ['block', result(ref(output), [['loop', { target: entered, parameters: [state], initial: [selected], results: [output], body: body(['break', entered, [ref(state)]]) }]])],
            ['block', result(ref(bound), [
                ['loop', { target: unrelated, parameters: [], initial: [], results: [], body: body(['break', unrelated, []]) }],
                ['define', bound, selected, 'required'],
            ])],
        ])
        for (const argument of wrappers) {
            assertStructurallySame(evaluate(calledRecipe(['?.()', identity, [argument]])), [4])
        }
    },
    sharedOperandSyntaxKeepsDistinctReachedDeclarationOccurrences: () => {
        const left = id(0), right = id(0)
        const pair = /** @type {Value} */ (['function', requiredFunction(['array', [ref(left), ref(right)]], [left, right])])
        const shared = _ownedLoopValue(['array', [4]])
        const value = evaluate(acrossLoop(['?.()', pair, [shared, shared]], lazy => ref(lazy), (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy),
        ]]))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4], [4]], [[4], [4]], [[4], [4]]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assert(value[0][0] !== value[0][1])
    },
    owningFunctionMetadataAndSharingSurviveSevenGraphs: () => {
        const argument = id(0), rest = id(0), self = id(0), captured = id(0), lazy = id(0), parameter = id(0)
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(parameter), [parameter])])
        const initializer = /** @type {Value} */ (['?.()', identity, [_ownedLoopValue(['array', [ref(argument), ref(captured), ref(rest), ['===', ref(self), ref(self)]]])]])
        const loop = collectingMemo(ref(lazy), 2)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(lazy), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', lazy, initializer, 'lazy'], ['loop', loop],
            ]) })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) { graph = fromFast(assertOk(toFast(graph))); graphs = [...graphs, graph] }
        for (const later of graphs.slice(5)) { assertStructurallySame(flat(later), flat(graphs[4])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 1)
            assertEq(current[2].length, 1)
            const value = evaluate(['()', current, [['[]', [8]], 9, 10]])
            assert(value instanceof Array && value[0] instanceof Array)
            assertStructurallySame(value, [[[8], [4], [9, 10], true], [[8], [4], [9, 10], true], [9, 10], true])
            assertEq(value[0], value[1])
            assertEq(value[0][2], value[2])
        }
    },
})
