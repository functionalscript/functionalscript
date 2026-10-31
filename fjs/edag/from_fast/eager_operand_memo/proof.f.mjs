/**
 * Caller planning retains lazy state through reached eager operand regions.
 *
 * @import { Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { normalizeMemo } from '../../../js/ast/memo/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _afterLoop as afterLoop, _calledFunction as calledFunction, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'
import { requiredFunction, failed, mixed, evaluate, flat } from '../member_returns/proof.f.mjs'
import { _ownedLoopValue as ownedLoopValue } from '../operand_owned_demands/proof.f.mjs'
import { _deferred as deferred } from '../lazy_returns/proof.f.mjs'

/** A reached operand owns its helper and yields its last observation. @type {(value: Value, limit?: Value, selected?: Value) => Value} */
const loopValue = (value, limit = 2, selected = true) => {
    const loop = collectingMemo(value, limit, selected)
    return ['block', afterLoop(loop, collectedMemo(ref(loop.results[0])))]
}

export const proof = /** @type {const} */ ({
    operandLoopIsTheOnlyCallerCrossing: () => {
        const shared = id(0)
        const value = evaluate(fromFast(result(['array', [loopValue(ref(shared)), ref(shared)]], [['define', shared, ['array', [4]], 'lazy']])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    computedOperandLocalsShareTheirCallerAndResetPerIteration: () => {
        const shared = id(0), local = id(0), alias = id(0)
        const operand = /** @type {Value} */ (['block', result(['array', [ref(local), ref(alias)]], [
            ['define', local, ['array', [ref(shared)]], 'lazy'], ['define', alias, ref(local), 'lazy'],
        ])])
        const loop = collectingMemo(operand, 2)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['loop', loop],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array && value[0][0] instanceof Array && value[1][0] instanceof Array)
        assertStructurallySame(value, [[[[4]], [[4]]], [[[4]], [[4]]], [4]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
        assertEq(value[0][0][0], value[2])
        assertEq(value[1][0][0], value[2])
    },
    operandAliasesKeepEarlierRootsAcrossRequiredShadows: () => {
        const shared = id(0), alias = id(0)
        const loop = collectingMemo(ref(alias), 1)
        const operand = /** @type {Value} */ (['block', result(['array', [collectedMemo(ref(loop.results[0])), ref(shared), ref(alias)]], [
            ['define', alias, ref(shared), 'lazy'], ['loop', loop], ['define', shared, ['array', [9]], 'required'],
        ])])
        const value = evaluate(fromFast(result(['array', [operand, ref(shared)]], [['define', shared, ['array', [4]], 'lazy']])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4], [9], [4]], [4]])
        assertEq(value[0][0], value[1])
        assertEq(value[0][2], value[1])
        assert(value[0][1] !== value[1])
    },
    zeroAndUnselectedOperandRegionsKeepCallerDemandDeferred: () => {
        const shared = id(0), zero = collectingMemo(ref(shared), 0)
        const definitions = /** @type {Block['statements']} */ ([['define', shared, failed('skipped caller demand'), 'lazy']])
        assertEq(evaluate(fromFast(result(['block', afterLoop(zero, ref(zero.results[0]))], definitions))), null)
        assertEq(evaluate(fromFast(result(loopValue(ref(shared), 2, false), definitions))), null)
        assertEq(evaluate(fromFast(result(['?:', false, loopValue(ref(shared)), 9], definitions))), 9)
    },
    nestedOperandHelpersAndSequentialLoopsRetainPrerequisites: () => {
        const prerequisite = id(0), shared = id(0)
        const nested = ownedLoopValue(['array', [ref(shared), ref(prerequisite)]])
        const following = collectingMemo(ref(shared), 2)
        const reached = id(0)
        const value = evaluate(fromFast(result(['array', [ref(reached), collectedMemo(ref(following.results[0])), ref(shared), ref(prerequisite)]], [
            ['define', prerequisite, ['array', [4]], 'lazy'], ['define', shared, ['array', [ref(prerequisite)]], 'lazy'],
            ['define', reached, nested, 'required'], ['loop', following],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array)
        assertStructurallySame(value, [[[[4]], [4]], [[4]], [[4]], [4]])
        assertEq(value[0][0], value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[0][1], value[3])
        assertEq(value[2][0], value[3])
    },
    eagerLoopEntriesAndBreakPayloadsCarryUpdatedCallerState: () => {
        const shared = id(0), state = id(0), output = id(0)
        const entryTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const entry = /** @type {Loop} */ ({ target: entryTarget, parameters: [state], initial: [loopValue(ref(shared))], results: [output], body: body(['break', entryTarget, [ref(state)]]) })
        const exitTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const exiting = /** @type {Loop} */ ({ target: exitTarget, parameters: [], initial: [], results: [output], body: body(['break', exitTarget, [loopValue(ref(shared))]]) })
        for (const loop of [entry, exiting]) {
            const value = evaluate(fromFast(result(['array', [ref(output), ref(shared)]], [['define', shared, ['array', [4]], 'lazy'], ['loop', loop]])))
            assert(value instanceof Array)
            assertStructurallySame(value, [[4], [4]])
            assertEq(value[0], value[1])
        }
    },
    eagerCaptureValuesShareCallerCellsAfterOperandCompletion: () => {
        const shared = id(0), captured = id(0), callee = id(0)
        const fn = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: loopValue(ref(shared)) }] }])
        const value = evaluate(fromFast(result(['array', [['()', ref(callee), []], ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['define', callee, fn, 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    capturedOperandLocalsStayFreshAcrossFactoryInvocations: () => {
        const argument = id(0), shared = id(0), local = id(0), reached = id(0), captured = id(0)
        const inner = collectingMemo(ref(local), 2)
        const operand = /** @type {Value} */ (['block', result(collectedMemo(ref(inner.results[0])), [
            ['define', local, ['array', [ref(shared)]], 'lazy'], ['loop', inner],
        ])])
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(reached) }] }])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest: null, self: null, captures: [],
            body: body(['return', target, getter], [['define', shared, ['array', [ref(argument)]], 'lazy'], ['define', reached, operand, 'required']]) })
        const factory = id(0), first = id(0), second = id(0), original = id(0)
        const value = evaluate(fromFast(result(['array', [['()', ref(first), []], ['()', ref(first), []], ['()', ref(second), []], ref(original)]], [
            ['define', original, ['array', [4]], 'required'], ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), [ref(original)]], 'required'], ['define', second, ['()', ref(factory), [ref(original)]], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array && value[0][0] instanceof Array && value[2][0] instanceof Array)
        assertStructurallySame(value, [[[[4]]], [[[4]]], [[[4]]], [4]])
        assertEq(value[0], value[1])
        assert(value[0] !== value[2])
        assert(value[0][0] !== value[2][0])
        assertEq(value[0][0][0], value[3])
        assertEq(value[2][0][0], value[3])
    },
    sharedOperandSyntaxKeepsDistinctLocalOccurrencesAndExactTargets: () => {
        const shared = id(0)
        const operand = ownedLoopValue(['array', [ref(shared)]])
        const value = evaluate(fromFast(result(['array', [operand, operand, ref(shared)]], [['define', shared, ['array', [4]], 'lazy']])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [4]])
        assert(value[0] !== value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[1][0], value[2])
    },
    operandLoopParametersShadowWithoutReplacingCallerCells: () => {
        const shared = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [shared], initial: [['array', [9]]], results: [output], body: body(['break', loopTarget, [ref(shared)]]) })
        const value = evaluate(fromFast(result(['array', [loopValue(ref(shared)), ['block', afterLoop(loop, ref(output))], ref(shared)]], [['define', shared, ['array', [4]], 'lazy']])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [9], [4]])
        assertEq(value[0], value[2])
        assert(value[0] !== value[1])
    },
    optionalOperandsSkipOrReachTheirOnlyCallerCrossing: () => {
        const shared = id(0), argument = id(0)
        assertEq(evaluate(fromFast(result(['?.()', null, [loopValue(ref(shared))]], [['define', shared, failed('skipped optional demand'), 'lazy']]))), undefined)
        const identity = /** @type {Value} */ (['function', requiredFunction(ref(argument), [argument])])
        const value = evaluate(fromFast(result(['array', [['?.()', identity, [loopValue(ref(shared))]], ref(shared)]], [['define', shared, ['array', [4]], 'lazy']])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    normalAndOwningReturnRecipesDemandAtOperandHelperExecution: () => {
        const stop = id(0)
        const fn = deferred(mixed(ref(stop), ['array', [4]], 7), shared => body(['return', target, ['array', [
            loopValue(ref(shared)), ref(shared), ['?:', ref(stop), failed('skipped consumer'), 0],
        ]]]), [stop])
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array)
        assertStructurallySame(normal, [[4], [4], 0])
        assertEq(normal[0], normal[1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    noPlanKeepsOrdinaryBodiesAndUnusedInitializersOpaque: () => {
        const shared = id(0), unused = id(0), callee = id(0)
        const ordinary = deferred(failed('uninvoked body'), local => body(['return', target, loopValue(ref(local))]))
        const source = /** @type {Block} */ (result(9, [
            ['define', shared, failed('unreached caller'), 'lazy'], ['define', unused, ownedLoopValue(failed('unused owned recipe')), 'lazy'],
            ['define', callee, ['function', ordinary], 'required'],
        ]))
        assertEq(normalizeMemo(source), source)
        assertEq(evaluate(fromFast(source)), 9)
    },
    unreadDeferredLoopOwnerDoesNotEvaluateItsCallerPrerequisite: () => {
        const shared = id(0), unused = id(0)
        assertEq(evaluate(fromFast(result(9, [
            ['define', shared, failed('unread caller prerequisite'), 'lazy'], ['define', unused, loopValue(ref(shared)), 'lazy'],
        ]))), 9)
    },
    callerMetadataAndOperandSharingSurviveSevenGraphs: () => {
        const argument = id(0), rest = id(0), self = id(0), captured = id(0), shared = id(0)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [loopValue(ref(shared)), ref(shared), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', shared, ['array', [ref(argument), ref(captured), ref(rest)]], 'lazy'],
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
            assertStructurallySame(value, [[[8], [4], [9, 10]], [[8], [4], [9, 10]], [9, 10], true])
            assertEq(value[0], value[1])
            assertEq(value[0][2], value[2])
        }
    },
    throw: {
        operandBreakCannotEscapeToTheEnclosingStatementLoop: () => {
            const shared = id(0), reached = id(0), output = id(0), innerOutput = id(0)
            const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const operand = /** @type {Loop} */ ({ target: inner, parameters: [], initial: [], results: [innerOutput], body: body(['break', outer, [ref(shared)]]) })
            const loop = /** @type {Loop} */ ({ target: outer, parameters: [], initial: [], results: [output], body: body(['break', outer, [ref(reached)]], [['define', reached, ['block', afterLoop(operand, ref(innerOutput))], 'required']]) })
            fromFast(result(ref(output), [['define', shared, ['array', [4]], 'lazy'], ['loop', loop]]))
        },
        operandContinueCannotEscapeToTheEnclosingStatementLoop: () => {
            const shared = id(0), count = id(0), reached = id(0), output = id(0), innerOutput = id(0)
            const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const operand = /** @type {Loop} */ ({ target: inner, parameters: [], initial: [], results: [innerOutput], body: body(['continue', outer, [ref(count)]], [['define', reached, ref(shared), 'required']]) })
            const loop = /** @type {Loop} */ ({ target: outer, parameters: [count], initial: [0], results: [output], body: body(['break', outer, [0]], [['define', reached, ['block', afterLoop(operand, ref(innerOutput))], 'required']]) })
            fromFast(result(ref(output), [['define', shared, ['array', [4]], 'lazy'], ['loop', loop]]))
        },
        demandedForeignReturnOwnerRemainsForeignInsideAnOperand: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(deferred(['block', body(['return', foreign, 7])], shared => body(['return', target, loopValue(ref(shared))])))
        },
    },
})
