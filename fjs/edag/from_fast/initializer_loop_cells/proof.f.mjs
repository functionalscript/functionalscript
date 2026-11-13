/**
 * Initializer-owned loops give local recipes fresh iteration lifetimes.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _afterLoop as afterLoop, _calledFunction as calledFunction, _collectingMemo as collectingMemo } from '../proof.f.mjs'
import { escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'
import { _deferred as deferred } from '../lazy_returns/proof.f.mjs'

export const proof = /** @type {const} */ ({
    normalIterationCellsAreFreshAndShared: () => {
        const count = id(0), history = id(0), local = id(0), alias = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, history], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ['array', [ref(history), ref(local), ref(alias)]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [ref(history)]]), body(['yield', []])],
                ['define', local, mixed(false, ['array', [ref(count)]]), 'lazy'], ['define', alias, ref(local), 'lazy'],
            ]) })
        const fn = deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)]))
        const factory = id(0), left = id(0), right = id(0)
        const value = evaluate(fromFast(result(['array', [ref(left), ref(right)]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', left, ['()', ref(factory), []], 'required'], ['define', right, ['()', ref(factory), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[0][0] instanceof Array)
        assertStructurallySame(value, [[[null, [0], [0]], [1], [1]], [[null, [0], [0]], [1], [1]]])
        assertEq(value[0][1], value[0][2])
        assertEq(value[0][0][1], value[0][0][2])
        assert(value[0][1] !== value[0][0][1])
        assert(value[0][1] !== value[1][1])
    },
    firstDemandReturnSkipsConsumerAndInitializerSuffix: () => {
        const stop = id(0), count = id(0), held = id(0), local = id(0), observed = id(0), output = id(0), dead = id(0)
        const condition = /** @type {Value} */ (['?:', ['===', ref(count), 1], ref(stop), false])
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, held], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ref(local)]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [ref(held)]]), body(['yield', []])],
                ['define', local, mixed(condition, ['array', [ref(count)]], ['array', ['returned', ref(count)]]), 'lazy'],
                ['define', observed, ['array', [ref(local), ['?:', condition, failed('skipped consumer'), 0]]], 'required'],
            ]) })
        const initializer = /** @type {Value} */ (['block', result(ref(output), [
            ['loop', loop], ['if', [], ref(stop), body(['yield', []], [['define', dead, failed('skipped initializer suffix'), 'required']]), body(['yield', []])],
        ])])
        const fn = deferred(initializer, lazy => body(['return', target, ref(lazy)]), [stop])
        assertStructurallySame(evaluate(calledFunction(fn, [false])), [1])
        assertStructurallySame(evaluate(calledFunction(fn, [true])), ['returned', 1])
    },
    zeroIterationsAndUnselectedDemandsStayDeferred: () => {
        const limit = id(0), reached = id(0), count = id(0), local = id(0), observed = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1]]], [
                ['if', [], ['>=', ref(count), ref(limit)], body(['break', loopTarget, [9]]), body(['yield', []])],
                ['define', local, escape(), 'lazy'],
                ['if', [], ref(reached), body(['yield', []], [['define', observed, ref(local), 'required']]), body(['yield', []])],
            ]) })
        const fn = deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)]), [limit, reached])
        assertEq(evaluate(calledFunction(fn, [0, true])), 9)
        assertEq(evaluate(calledFunction(fn, [2, false])), 9)
        assertEq(evaluate(calledFunction(fn, [2, true])), 7)
    },
    reachedPrefixFailurePrecedesLocalDemandReturn: () => {
        const local = id(0), before = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [ref(local)]], [
                ['define', local, escape(), 'lazy'], ['define', before, failed('before loop-local demand'), 'required'],
            ]) })
        const fn = deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)]))
        assertEq(failure(calledFunction(fn)), 'before loop-local demand')
    },
    callerPrerequisitesAndRecipeLocalsCrossIterations: () => {
        const caller = id(0), recipeLocal = id(0), outer = id(0), count = id(0), history = id(0), local = id(0), alias = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, history], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ['array', [ref(history), ref(local), ref(alias)]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [ref(history)]]), body(['yield', []])],
                ['define', local, ['array', [ref(recipeLocal), ref(recipeLocal), ref(caller), ref(count)]], 'lazy'],
                ['define', alias, ref(local), 'lazy'],
            ]) })
        const initializer = /** @type {Value} */ (['block', result(ref(output), [
            ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'], ['loop', loop],
        ])])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(outer), ref(outer), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', outer, initializer, 'lazy'], ['loop', collectingMemo(ref(outer), 2)],
            ]) })
        const value = evaluate(calledFunction(fn))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array && value[0][1] instanceof Array && value[0][0][1] instanceof Array)
        const current = value[0][1], prior = value[0][0][1]
        assert(current[0] instanceof Array)
        assertEq(value[0], value[1])
        assertEq(current, value[0][2])
        assertEq(current[0], current[1])
        assertEq(current[0], prior[0])
        assertEq(current[0][0], value[2])
        assertEq(current[2], value[2])
        assert(current !== prior)
        assertEq(current[3], 1)
        assertEq(prior[3], 0)
    },
    nestedLoopsCarryNormalStateAndOwningReturn: () => {
        const stop = id(0), outerCount = id(0), total = id(0), outerLocal = id(0), innerCount = id(0), sum = id(0), innerLocal = id(0), observed = id(0), innerOut = id(0), output = id(0)
        const condition = /** @type {Value} */ (['?:', ['===', ref(outerCount), 1], ['?:', ['===', ref(innerCount), 1], ref(stop), false], false])
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [innerCount, sum], initial: [0, 0], results: [innerOut],
            body: body(['continue', innerTarget, [['+', ref(innerCount), 1], ['+', ref(sum), ['+', ref(outerLocal), ref(innerCount)]]]], [
                ['if', [], ['>=', ref(innerCount), 2], body(['break', innerTarget, [ref(sum)]]), body(['yield', []])],
                ['define', innerLocal, mixed(condition, ['array', [ref(outerLocal), ref(innerCount)]]), 'lazy'],
                ['define', observed, ref(innerLocal), 'required'],
            ]) })
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [outerCount, total], initial: [0, 0], results: [output],
            body: body(['continue', outerTarget, [['+', ref(outerCount), 1], ['+', ref(total), ref(innerOut)]]], [
                ['if', [], ['>=', ref(outerCount), 2], body(['break', outerTarget, [ref(total)]]), body(['yield', []])],
                ['define', outerLocal, mixed(false, ref(outerCount)), 'lazy'], ['loop', inner],
            ]) })
        const fn = deferred(['block', afterLoop(outer, ref(output))], lazy => body(['return', target, ref(lazy)]), [stop])
        assertEq(evaluate(calledFunction(fn, [false])), 4)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    statementTransfersKeepTheInitializerLoopScope: () => {
        const count = id(0), held = id(0), local = id(0), output = id(0)
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [], initial: [], results: [],
                body: body(kind === 'break' ? ['break', outerTarget, [ref(local)]] : ['continue', outerTarget, [['+', ref(count), 1], ref(local)]], [
                    ['define', local, mixed(false, ['array', [ref(count)]]), 'lazy'],
                ]) })
            const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [count, held], initial: [0, null], results: [output],
                body: body(['break', outerTarget, [null]], [
                    ['if', [], ['>=', ref(count), 3], body(['break', outerTarget, [ref(held)]]), body(['yield', []])], ['loop', inner],
                ]) })
            const fn = deferred(['block', afterLoop(outer, ref(output))], lazy => body(['return', target, ref(lazy)]))
            assertStructurallySame(evaluate(calledFunction(fn)), kind === 'break' ? [0] : [2])
        }
    },
    escapedClosuresFreezeIterationCellsAndFreshCalls: () => {
        const count = id(0), prior = id(0), local = id(0), getter = id(0), captured = id(0), output = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(local) }], body: body(['return', owner, ['array', [ref(captured), ref(captured)]]]),
        }])
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, prior], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ref(getter)]], [
                ['define', local, mixed(false, ['array', [ref(count)]]), 'lazy'], ['define', getter, closure, 'required'],
                ['if', [], ['===', ref(count), 1], body(['break', loopTarget, [['array', [ref(prior), ref(getter), ref(local)]]]]), body(['yield', []])],
            ]) })
        const fn = deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)]))
        const factory = id(0), first = id(0), second = id(0)
        const value = evaluate(fromFast(result(['array', [
            ['()', ['.', ref(first), 0], []], ['()', ['.', ref(first), 1], []], ['.', ref(first), 2], ['()', ['.', ref(second), 1], []],
        ]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), []], 'required'], ['define', second, ['()', ref(factory), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[3] instanceof Array)
        assertStructurallySame(value, [[[0], [0]], [[1], [1]], [1], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assertEq(value[1][0], value[2])
        assert(value[0][0] !== value[1][0])
        assert(value[1][0] !== value[3][0])
    },
    loopParameterShadowsAnActiveRecipeAlias: () => {
        const caller = id(0), alias = id(0), local = id(0), output = id(0), outer = id(0), before = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [alias], initial: [9], results: [output],
            body: body(['break', loopTarget, [ref(local)]], [['define', local, mixed(false, ['array', [ref(alias)]]), 'lazy']]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(outer), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', alias, ref(caller), 'lazy'],
                ['define', outer, ['block', result(ref(output), [['define', before, ref(alias), 'required'], ['loop', loop]])], 'lazy'],
            ]) })
        assertStructurallySame(evaluate(calledFunction(fn)), [[9], [4]])
    },
    completionShapedLocalPayloadIsOrdinaryData: () => {
        const local = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [['array', [ref(local), ref(local)]]]], [
                ['define', local, mixed(false, ['array', ['return', ['array', ['normal', 7]]]]), 'lazy'],
            ]) })
        const fn = deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)]))
        const value = evaluate(calledFunction(fn))
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertStructurallySame(value, [['return', ['normal', 7]], ['return', ['normal', 7]]])
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), self = id(0), captured = id(0), outer = id(0), count = id(0), held = id(0), local = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const condition = /** @type {Value} */ (['?:', ['===', ref(count), 1], ref(stop), false])
        const returned = /** @type {Value} */ (['array', [ref(captured), ref(captured), ref(rest)]])
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, held], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ref(local)]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [ref(held)]]), body(['yield', []])],
                ['define', local, mixed(condition, ['array', [ref(argument), ref(captured), ref(rest), ['===', ref(self), ref(self)]]], returned), 'lazy'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop, argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(outer), ref(outer), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', outer, ['block', afterLoop(loop, ref(output))], 'lazy'],
            ]) })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) { graph = fromFast(assertOk(toFast(graph))); graphs = [...graphs, graph] }
        for (const later of graphs.slice(4)) { assertStructurallySame(flat(later), flat(graphs[3])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            const stopped = evaluate(['()', current, [true, 1, 8, 9]])
            assert(stopped instanceof Array)
            assertEq(stopped[0], stopped[1])
            assertStructurallySame(stopped, [[4], [4], [8, 9]])
            const normal = evaluate(['()', current, [false, 1, 8, 9]])
            assert(normal instanceof Array)
            assertEq(normal[0], normal[1])
            assertStructurallySame(normal, [[1, [4], [8, 9], true], [1, [4], [8, 9], true], [8, 9], true])
        }
    },
    throw: {
        demandedForeignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const local = id(0), output = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', loopTarget, [ref(local)]], [['define', local, ['block', body(['return', foreign, 7])], 'lazy']]) })
            calledFunction(deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)])))
        },
        localInitializerCannotEscapeToItsDeclaringLoop: () => {
            const local = id(0), output = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', loopTarget, [ref(local)]], [['define', local, ['block', body(['break', loopTarget, [7]])], 'lazy']]) })
            calledFunction(deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)])))
        },
        transferCannotNameAnEqualIndexForeignTarget: () => {
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const local = id(0), output = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', foreign, [ref(local)]], [['define', local, mixed(false, 7), 'lazy']]) })
            calledFunction(deferred(['block', afterLoop(loop, ref(output))], lazy => body(['return', target, ref(lazy)])))
        },
    },
})
