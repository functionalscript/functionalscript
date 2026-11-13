/**
 * Normal lazy recipes share values through reached spread operations.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'
import { requiredFunction, failed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'
import { _acrossLoop as acrossLoop } from '../normal_memo_members/proof.f.mjs'
import { _collector as collector } from '../spread_returns/proof.f.mjs'
import { staticRuntime } from '../native_returns/proof.f.mjs'

export const proof = /** @type {const} */ ({
    arrayExpansionRetainsSharedPayloadAndFreshConsumers: () => {
        const value = evaluate(acrossLoop(['array', [['array', [4]]]], lazy => ['array', [0, ['...', ref(lazy)], 9]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 0],
        ]]))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[0, [4], 9], [0, [4], 9], [4]])
        assertEq(value[0][1], value[1][1])
        assertEq(value[0][1], value[2])
        assert(value[0] !== value[1])
    },
    arrayExpansionPreservesMultipleSpreadOrderAndStringIteration: () => {
        assertStructurallySame(evaluate(acrossLoop(['array', [1, 2]], lazy => ['array', [
            0, ['...', ref(lazy)], 3, ['...', '😀x'], 4, ['...', ref(lazy)], 5,
        ]])), [0, 1, 2, 3, '😀', 'x', 4, 1, 2, 5])
        failure(acrossLoop(['block', result(undefined)], lazy => ['array', [['...', ref(lazy)], 9]]))
    },
    unselectedAndZeroIterationSpreadsKeepFailuresDeferred: () => {
        assertStructurallySame(evaluate(acrossLoop(failed('unselected array spread'), lazy => ['?:', false,
            ['array', [['...', ref(lazy)]]], ['array', [9]],
        ])), [9])
        assertEq(evaluate(acrossLoop(failed('zero-iteration spread'), lazy => ['array', [['...', ref(lazy)]]], (_, loop) => ref(loop.results[0]), 0)), null)
        assertStructurallySame(evaluate(acrossLoop(failed('unselected object spread'), lazy => ['?:', true,
            ['object', [[':', 'chosen', 9]]], ['object', [['...', ref(lazy)]]],
        ])), { chosen: 9 })
    },
    plainCallExpansionSharesPayloadAcrossInvocationsAndCaller: () => {
        const fn = collector()
        const value = evaluate(acrossLoop(['array', [['array', [4]]]], lazy => ['()', fn, [0, ['...', ref(lazy)], 9]], (lazy, loop) => ['array', [
            collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 0],
        ]]))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[0, [4], 9], [0, [4], 9], [4]])
        assertEq(value[0][1], value[1][1])
        assertEq(value[0][1], value[2])
        assert(value[0] !== value[1])
    },
    selectedCalleeAndSpreadArgumentsRetainTheirEvaluationRegions: () => {
        assertStructurallySame(evaluate(acrossLoop(collector(), lazy => ['()', ref(lazy), [0, ['...', ['array', [1, 2]]], 9]])), [0, 1, 2, 9])
        assertEq(failure(acrossLoop(failed('callee'), lazy => ['()', ref(lazy), [['...', ['array', [1, 2]]]]])), 'callee')
        assertEq(failure(acrossLoop(['array', [4]], lazy => ['()', ['function', requiredFunction(7)], [failed('argument prefix'), ['...', ref(lazy)]]])), 'argument prefix')
        assertEq(failure(acrossLoop(failed('spread operand'), lazy => ['()', ['function', requiredFunction(7)], [0, ['...', ref(lazy)], 9]])), 'spread operand')
        assertEq(failure(acrossLoop(['array', [4]], lazy => ['()', ['function', requiredFunction(7)], [['...', ref(lazy)], failed('argument suffix')]])), 'argument suffix')
    },
    spreadCallsPreserveMissingExtraAndRestArguments: () => {
        const first = id(0), second = id(0), rest = id(0)
        const fn = /** @type {Value} */ (['function', { ...requiredFunction(['array', [ref(first), ref(second), ref(rest)]], [first, second]), rest }])
        assertStructurallySame(evaluate(acrossLoop(['array', [1]], lazy => ['()', fn, [['...', ref(lazy)]]])), [1, undefined, []])
        assertStructurallySame(evaluate(acrossLoop(['array', [1, 2, 3, 4]], lazy => ['()', fn, [['...', ref(lazy)]]])), [1, 2, [3, 4]])
        assertStructurallySame(evaluate(acrossLoop(['array', [1, 2, 3, 4]], lazy => ['()', fn, [0, ['...', ref(lazy)]]])), [0, 1, [2, 3, 4]])
        const fixed = /** @type {Value} */ (['function', requiredFunction(ref(first), [first])])
        assertEq(failure(acrossLoop(['array', [1]], lazy => ['()', fixed, [['...', ref(lazy)], failed('unused extra argument')]])), 'unused extra argument')
    },
    nativePlainCallReceivesExpandedEstablishedArguments: () => {
        const payload = id(0), lazy = id(0)
        const loop = collectingMemo(['()', ['Object.is'], [['...', ref(lazy)]]], 2)
        const graph = fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ['.', ref(lazy), 0], ['.', ref(lazy), 1], ref(payload)]], [
            ['define', payload, ['array', [4]], 'required'], ['define', lazy, ['array', [ref(payload), ref(payload)]], 'lazy'], ['loop', loop],
        ]))
        const value = evaluate(graph, staticRuntime(['=>', 2, [], ['===', ['arg', 0], ['arg', 1]]]))
        assert(value instanceof Array)
        assertStructurallySame(value, [true, [4], [4], [4]])
        assertEq(value[1], value[2])
        assertEq(value[1], value[3])
    },
    objectSpreadsCopyOwnValuesAndRetainOverwriteEnumeration: () => {
        const source = /** @type {Value} */ (['object', [
            [':', 2, 'two'], [':', 'a', ['array', [4]]], [':', 'b', ['array', [9]]], [':', '__proto__', ['array', [8]]],
        ]])
        const value = evaluate(acrossLoop(source, lazy => ['object', [
            [':', 'before', 1], ['...', ref(lazy)], [':', 'a', ['array', [5]]], [':', 'c', ['.', ref(lazy), 'b']],
        ]], (lazy, loop) => ['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(lazy)]]))
        assert(value instanceof Array && value[0] !== null && typeof value[0] === 'object' && value[1] !== null && typeof value[1] === 'object' && value[2] !== null && typeof value[2] === 'object')
        const first = /** @type {StringMap<unknown>} */ (value[0]), second = /** @type {StringMap<unknown>} */ (value[1]), original = /** @type {StringMap<unknown>} */ (value[2])
        assertStructurallySame(Object.keys(first), ['2', 'before', 'a', 'b', '__proto__', 'c'])
        assertStructurallySame(Object.entries(first), [['2', 'two'], ['before', 1], ['a', [5]], ['b', [9]], ['__proto__', [8]], ['c', [9]]])
        assertEq(first.b, original.b)
        assertEq(first.c, original.b)
        assertEq(second.b, original.b)
        assertEq(first['__proto__'], original['__proto__'])
        assert(Object.hasOwn(first, '__proto__'))
        assert(first !== second && first !== original)
        assert(first.a !== original.a)
    },
    objectSpreadsPreserveNullishAndStringOwnCopyRules: () => {
        for (const source of /** @type {readonly Value[]} */ ([null, undefined, false, 0])) {
            assertStructurallySame(evaluate(acrossLoop(['block', result(source)], lazy => ['object', [[':', 'before', 1], ['...', ref(lazy)], [':', 'after', 2]]])), { before: 1, after: 2 })
        }
        const value = evaluate(acrossLoop(['block', result('😀x')], lazy => ['object', [['...', ref(lazy)], [':', 'after', 2]]]))
        assert(value !== null && typeof value === 'object')
        assertStructurallySame(Object.entries(value), [['0', '\ud83d'], ['1', '\ude00'], ['2', 'x'], ['after', 2]])
    },
    objectKeysConvertNormallyWithAndWithoutAnInertSpread: () => {
        const keys = /** @type {readonly (readonly [Value, string])[]} */ ([
            [undefined, 'undefined'], [null, 'null'], [-0, '0'], [7n, '7'], [['array', [1, null, 3]], '1,,3'],
            [['object', [[':', 'toString', ['function', requiredFunction('chosen')]]]], 'chosen'],
        ])
        for (const [key, spelling] of keys) {
            for (const inert of /** @type {const} */ ([false, true])) {
                const value = evaluate(acrossLoop(['array', [4]], lazy => ['object', [
                    ...inert ? [/** @type {const} */ (['...', ['object', []]])] : [], [':', key, ref(lazy)],
                ]], (lazy, loop) => ['array', [collectedMemo(ref(loop.results[0])), ref(lazy)]]))
                assert(value instanceof Array && value[0] !== null && typeof value[0] === 'object')
                const object = /** @type {StringMap<unknown>} */ (value[0])
                assertStructurallySame(Object.keys(object), [spelling])
                assertEq(object[spelling], value[1])
            }
        }
    },
    reachedObjectKeyAndEntryFailuresStayRequired: () => {
        const key = /** @type {Value} */ (['object', [[':', 'toString', ['function', { ...requiredFunction('key'), body: body(['throw', 'key conversion']) }]]]])
        for (const inert of /** @type {const} */ ([false, true])) {
            assertEq(failure(acrossLoop(['array', [4]], lazy => ['object', [
                ...inert ? [/** @type {const} */ (['...', ['object', []]])] : [], [':', key, ref(lazy)],
            ]])), 'key conversion')
        }
        assertEq(failure(acrossLoop(['object', [[':', 'x', 4]]], lazy => ['object', [['...', failed('earlier spread')], ['...', ref(lazy)]]])), 'earlier spread')
        assertEq(failure(acrossLoop(['object', [[':', 'x', 4]]], lazy => ['object', [['...', ref(lazy)], [':', 'x', failed('overwriting value')]]])), 'overwriting value')
    },
    sequentialArrayAndObjectSpreadsReuseOneCallerCell: () => {
        const lazy = id(0)
        const first = collectingMemo(['array', [['...', ref(lazy)]]], 2)
        const second = collectingMemo(['object', [['...', ref(lazy)]]], 2)
        const value = evaluate(fromFast(result(['array', [
            collectedMemo(ref(first.results[0])), collectedMemo(ref(second.results[0])), ref(lazy),
        ]], [['define', lazy, ['array', [['array', [4]]]], 'lazy'], ['loop', first], ['loop', second]])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] !== null && typeof value[1] === 'object' && value[2] instanceof Array)
        const object = /** @type {StringMap<unknown>} */ (value[1])
        assertStructurallySame(value, [[[4]], { '0': [4] }, [[4]]])
        assertEq(value[0][0], object['0'])
        assertEq(value[0][0], value[2][0])
        assert(value[0] !== value[2])
    },
    initializerLoopSpreadsRetainPrerequisitesAndCapturedIterationCells: () => {
        const caller = id(0), recipe = id(0), selected = id(0), count = id(0), saved = id(0), local = id(0), output = id(0), captured = id(0)
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = collectingMemo(['array', [['...', ref(local)]]], 2)
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(local) }] }])
        const loop = /** @type {Loop} */ ({ target: outer, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', outer, [['+', ref(count), 1], ['array', [ref(saved), getter, ref(local), collectedMemo(ref(inner.results[0]))]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', outer, [ref(saved)]]), body(['yield', []])],
                ['define', local, ['array', [ref(recipe), ref(count)]], 'lazy'], ['loop', inner],
            ]) })
        const initializer = /** @type {Value} */ (['block', result(ref(output), [['define', recipe, ['array', [ref(caller)]], 'lazy'], ['loop', loop]])])
        const driver = collectingMemo(ref(selected), 2)
        const previous = /** @type {Value} */ (['.', ref(selected), 0])
        const value = evaluate(fromFast(result(['array', [
            ['()', ['.', ref(selected), 1], []], ['()', ['.', previous, 1], []], ['.', ref(selected), 2], ['.', previous, 2],
            ['.', ref(selected), 3], ['.', previous, 3], ref(caller),
        ]], [['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'], ['loop', driver]])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[0][0] instanceof Array && value[4] instanceof Array)
        assertStructurallySame(value, [[[[4]], 1], [[[4]], 0], [[[4]], 1], [[[4]], 0], [[[4]], 1], [[[4]], 0], [4]])
        assertEq(value[0], value[2])
        assertEq(value[1], value[3])
        assert(value[0] !== value[1])
        assertEq(value[0][0], value[1][0])
        assertEq(value[0][0], value[4][0])
        assertEq(value[0][0][0], value[6])
        assert(value[0] !== value[4])
    },
    spreadMetadataAndSharingSurviveSevenGraphs: () => {
        const argument = id(0), rest = id(0), self = id(0), captured = id(0), lazy = id(0)
        const loop = collectingMemo(['()', collector(), [['...', ref(lazy)], ['...', ref(rest)]]], 2)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [collectedMemo(ref(loop.results[0])), ref(lazy), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', lazy, ['array', [ref(argument), ref(captured)]], 'lazy'], ['loop', loop],
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
            assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
            assertStructurallySame(value, [[[8], [4], 9, 10], [[8], [4]], [9, 10], true])
            assertEq(value[0][0], value[1][0])
            assertEq(value[0][1], value[1][1])
        }
    },
})
