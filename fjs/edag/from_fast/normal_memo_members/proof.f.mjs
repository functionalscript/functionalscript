/**
 * Normal lazy demands retain member regions without a return-bearing recipe.
 *
 * @import { BindingId, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _afterLoop as afterLoop, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'
import { requiredFunction, failed, evaluate, failure, flat, throwingRuntime } from '../member_returns/proof.f.mjs'

/** Demand one normal recipe through repeated loop operands. @type {(initializer: Value, use: (lazy: BindingId) => Value, observe?: (lazy: BindingId, loop: Loop) => Value, limit?: Value, selected?: Value) => Exp} */
export const _acrossLoop = (initializer, use, observe = (_, loop) => collectedMemo(ref(loop.results[0])), limit = 2, selected = true) => {
    const lazy = id(0), loop = collectingMemo(use(lazy), limit, selected)
    return fromFast(result(observe(lazy, loop), [['define', lazy, initializer, 'lazy'], ['loop', loop]]))
}

export const proof = /** @type {const} */ ({
    optionalReceiverSharesItsEstablishedProperty: () => {
        const value = evaluate(_acrossLoop(['array', [['array', [4]]]], lazy => ['?.', ref(lazy), 0], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 0],
        ]]))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    optionalComputedKeyRetainsNormalDemandState: () => {
        const value = evaluate(_acrossLoop(['+', 0, 0], lazy => ['?.', ['array', [7]], ['Number', ref(lazy)]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy),
        ]]))
        assertStructurallySame(value, [7, 7, 0])
    },
    nullishOptionalRegionsSkipFailingKeyAndArguments: () => {
        for (const receiver of /** @type {readonly Value[]} */ ([null, undefined])) {
            assertEq(evaluate(_acrossLoop(failed('skipped key'), lazy => ['?.', receiver, ['Number', ref(lazy)], ['|()', [ref(lazy)]]])), undefined)
            assertEq(evaluate(_acrossLoop(failed('skipped bare argument'), lazy => ['?.()', receiver, [ref(lazy)]])), undefined)
            assertEq(evaluate(_acrossLoop(failed('skipped member argument'), lazy => ['.', ['object', [[':', 'method', receiver]]], 'method', ['|?.()', [ref(lazy)]]])), undefined)
        }
    },
    optionalCallableAndArgumentsShareTheirNormalCells: () => {
        const argument = id(0)
        const callable = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        assertStructurallySame(evaluate(_acrossLoop(callable, lazy => ['?.()', ref(lazy), [9]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['===', ref(lazy), ref(lazy)],
        ]])), [9, 9, true])
        const shared = evaluate(_acrossLoop(['array', [4]], lazy => ['?.()', callable, [ref(lazy)]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy),
        ]]))
        assert(shared instanceof Array)
        assertStructurallySame(shared, [[4], [4], [4]])
        assertEq(shared[0], shared[1])
        assertEq(shared[0], shared[2])
    },
    directAndContinuedMembersRetainTheirReceiver: () => {
        for (const optional of /** @type {const} */ ([false, true])) {
            assertEq(evaluate(_acrossLoop(['+', 0, 1], lazy => ['.', 'abcd', 'slice', [optional ? '|?.()' : '|()', [ref(lazy)]]])), 'bcd')
        }
        assertEq(evaluate(_acrossLoop(['+', 0, 1], lazy => ['()', ['.', 'abcd', 'slice'], [ref(lazy)]])), 'bcd')
        assertEq(evaluate(_acrossLoop(['+', 0, 1], lazy => ['?.', 'abcd', 'slice', ['|()', [ref(lazy)]]])), 'bcd')
    },
    ownMemberAndWrappedNormalCalleeKeepArgumentSharing: () => {
        const argument = id(0)
        const object = /** @type {Value} */ (['object', [[':', 'method', ['function', requiredFunction(ref(argument), [argument])]]]])
        const values = /** @type {readonly ((lazy: BindingId) => Value)[]} */ ([
            lazy => ['.', object, 'method', ['|()', [ref(lazy)]]],
            lazy => ['.', object, 'method', ['|?.()', [ref(lazy)]]],
            lazy => ['()', ['block', result(['.', object, 'method'])], [ref(lazy)]],
        ])
        for (const use of values) {
            const value = evaluate(_acrossLoop(['array', [4]], use, (lazy, loop) => ['array', [
                collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy),
            ]]))
            assert(value instanceof Array)
            assertStructurallySame(value, [[4], [4], [4]])
            assertEq(value[0], value[1])
            assertEq(value[0], value[2])
        }
    },
    lookupAndKeyConversionFailuresRemainReached: () => {
        const argument = id(0)
        const callable = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        const badKey = /** @type {Value} */ (['object', [[':', 'valueOf', ['function', {
            ...requiredFunction(0), body: body(['throw', 'key conversion']),
        }]]]])
        assertEq(failure(_acrossLoop(['array', [4]], lazy => ['.', failed('receiver prefix'), 'method', ['|()', [ref(lazy)]]])), 'receiver prefix')
        assertEq(failure(_acrossLoop(['array', [4]], lazy => ['.', ['array', [callable]], ['Number', badKey], ['|()', [ref(lazy)]]])), 'key conversion')
        assertEq(failure(_acrossLoop(['array', [4]], lazy => ['.', 'abcd', 'slice', ['|()', [ref(lazy)]]]), throwingRuntime), 'lookup')
    },
    onlyNullishCallablesSkipNormalDemandArguments: () => {
        const argument = id(0), callable = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        assertEq(failure(_acrossLoop(failed('reached argument'), lazy => ['?.()', callable, [ref(lazy)]])), 'reached argument')
        for (const value of /** @type {readonly Value[]} */ ([0, false, ''])) {
            failure(_acrossLoop(['array', [4]], lazy => ['?.()', value, [ref(lazy)]]))
            failure(_acrossLoop(['array', [4]], lazy => ['.', ['object', [[':', 'method', value]]], 'method', ['|?.()', [ref(lazy)]]]))
        }
    },
    optionalMemberSpreadsSkipOrExpandAtTheirReachedPosition: () => {
        const rest = id(0)
        const callable = /** @type {Value} */ (['function', { ...requiredFunction(ref(rest)), rest }])
        const receiver = /** @type {Value} */ (['object', [[':', 'method', callable]]])
        const value = evaluate(_acrossLoop(['array', [['array', [4]]]], lazy => ['.', receiver, 'method', ['|?.()', [0, ['...', ref(lazy)], 9]]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 0],
        ]]))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[0, [4], 9], [0, [4], 9], [4]])
        assertEq(value[0][1], value[1][1])
        assertEq(value[0][1], value[2])
        assertEq(evaluate(_acrossLoop(failed('skipped spread'), lazy => ['.', ['object', [[':', 'method', null]]], 'method', ['|?.()', [['...', ref(lazy)]]]])), undefined)
        assertEq(failure(_acrossLoop(failed('reached spread'), lazy => ['.', receiver, 'method', ['|()', [0, ['...', ref(lazy)], 9]]])), 'reached spread')
    },
    zeroAndUnselectedIterationsKeepDemandDeferred: () => {
        assertEq(evaluate(_acrossLoop(failed('zero iterations'), lazy => ['?.', ref(lazy), 'length'], (_, loop) => ref(loop.results[0]), 0)), null)
        assertStructurallySame(evaluate(_acrossLoop(failed('unselected demand'), lazy => ['?.', ref(lazy), 'length'], (_, loop) => ref(loop.results[0]), 2, false)), [[null, null], null])
    },
    sequentialHelpersAndCallerShareTheMemberValue: () => {
        const lazy = id(0)
        const first = collectingMemo(['?.', ref(lazy), 0], 2)
        const second = collectingMemo(['.', ref(lazy), 'at', ['|()', [0]]], 2)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0])), ['.', ref(lazy), 0],
        ]], [['define', lazy, ['array', [['array', [4]]]], 'lazy'], ['loop', first], ['loop', second]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    nestedIterationCellsKeepCapturedValuesAndResetFresh: () => {
        const count = id(0), saved = id(0), local = id(0), output = id(0), captured = id(0)
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = collectingMemo(['?.', ref(local), 0], 2)
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)),
            captures: [{ binding: captured, value: collectedMemo(ref(inner.results[0])) }],
        }])
        const loop = /** @type {Loop} */ ({ target: outer, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', outer, [['+', ref(count), 1], ['array', [ref(saved), getter, ref(local)]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', outer, [ref(saved)]]), body(['yield', []])],
                ['define', local, ['array', [['array', [ref(count)]]]], 'lazy'], ['loop', inner],
            ]) })
        const previous = /** @type {Value} */ (['.', ref(output), 0])
        const value = evaluate(fromFast(afterLoop(loop, ['array', [
            ['()', ['.', ref(output), 1], []], ['()', ['.', previous, 1], []],
            ['.', ['.', ref(output), 2], 0], ['.', ['.', previous, 2], 0],
        ]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[1], [0], [1], [0]])
        assertEq(value[0], value[2])
        assertEq(value[1], value[3])
        assert(value[0] !== value[1])
    },
    recipeLocalMembersKeepBorrowedPrerequisites: () => {
        const caller = id(0), selected = id(0), local = id(0)
        const inner = collectingMemo(['?.', ref(local), 0], 2)
        const outer = collectingMemo(['?.', ref(selected), 0], 2)
        const initializer = /** @type {Value} */ (['block', result(ref(local), [['define', local, ['array', [ref(caller)]], 'lazy'], ['loop', inner]])])
        const value = evaluate(fromFast(result(['array', [
            ref(selected), ref(selected), ref(caller), collectedMemo(ref(outer.results[0])),
        ]], [['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', outer]])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[2], value[3])
    },
    functionMetadataAndNormalSharingSurviveSevenGraphs: () => {
        const argument = id(0), rest = id(0), self = id(0), captured = id(0), lazy = id(0)
        const loop = collectingMemo(['?.', ref(lazy), 0], 2)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(lazy), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', lazy, ['array', [ref(argument), ref(captured), ref(rest)]], 'lazy'], ['loop', loop],
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
            assert(value instanceof Array && value[1] instanceof Array)
            assertStructurallySame(value, [[8], [[8], [4], [9, 10]], [9, 10], true])
            assertEq(value[0], value[1][0])
            assertEq(value[1][2], value[2])
        }
    },
})
