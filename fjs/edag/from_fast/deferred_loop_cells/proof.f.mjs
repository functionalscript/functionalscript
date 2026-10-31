/**
 * Deferred-only loop demand borrows caller-owned recipes without evaluating them.
 *
 * @import { Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { normalizeMemo } from '../../../js/ast/memo/module.f.mjs'
import { prepareFunction } from '../../../js/ast/prepare/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _afterLoop as afterLoop, _calledFunction as calledFunction, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'
import { requiredFunction, failed, mixed, evaluate, flat } from '../member_returns/proof.f.mjs'
import { _ownedLoopValue as ownedLoopValue } from '../operand_owned_demands/proof.f.mjs'

export const proof = /** @type {const} */ ({
    deferredOnlyLoopSharesTheCallerReadyCell: () => {
        const shared = id(0), owner = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output], body: body(['break', loopTarget, [ref(shared)]]) })
        const value = evaluate(fromFast(result(['array', [ref(owner), ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['define', owner, ['block', afterLoop(loop, ref(output))], 'lazy'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    aliasesAndTransitivePrerequisitesShareTheirCallerRoots: () => {
        const shared = id(0), alias = id(0), dependent = id(0), owner = id(0)
        const value = evaluate(fromFast(result(['array', [ref(owner), ref(dependent), ref(shared), ref(alias)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['define', alias, ref(shared), 'lazy'],
            ['define', dependent, ['array', [ref(alias)]], 'lazy'], ['define', owner, ownedLoopValue(ref(dependent)), 'lazy'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[2], value[3])
    },
    nestedDeferredRecipesRetainTheBorrowedPrefix: () => {
        const shared = id(0), owner = id(0), nested = id(0), computed = id(0)
        const initializer = /** @type {Value} */ (['block', result(['array', [ref(nested), ref(computed)]], [
            ['define', nested, ownedLoopValue(ref(shared)), 'lazy'], ['define', computed, ['array', [ref(nested), ref(shared)]], 'lazy'],
        ])])
        const value = evaluate(fromFast(result(['array', [ref(owner), ref(shared)]], [['define', shared, ['array', [4]], 'lazy'], ['define', owner, initializer, 'lazy']])))
        assert(value instanceof Array && value[0] instanceof Array && value[0][1] instanceof Array)
        assertStructurallySame(value, [[[4], [[4], [4]]], [4]])
        assertEq(value[0][0], value[1])
        assertEq(value[0][1][0], value[1])
        assertEq(value[0][1][1], value[1])
    },
    zeroIterationsAndSkippedDemandsDoNotEstablishPrerequisites: () => {
        const shared = id(0), owner = id(0)
        const zero = collectingMemo(ref(shared), 0)
        const skipped = collectingMemo(ref(shared), 2, false)
        for (const loop of [zero, skipped]) {
            assertEq(evaluate(fromFast(result(ref(owner), [
                ['define', shared, failed('skipped prerequisite'), 'lazy'], ['define', owner, ['block', afterLoop(loop, 9)], 'lazy'],
            ]))), 9)
        }
    },
    unreadOwnerDoesNotEvaluateItsPrefixOrBorrowedCell: () => {
        const shared = id(0), owner = id(0), prefix = id(0)
        const loop = collectingMemo(ref(shared), 2)
        const initializer = /** @type {Value} */ (['block', result(collectedMemo(ref(loop.results[0])), [
            ['define', prefix, failed('unread owner prefix'), 'required'], ['loop', loop],
        ])])
        assertEq(evaluate(fromFast(result(9, [['define', shared, failed('unread prerequisite'), 'lazy'], ['define', owner, initializer, 'lazy']]))), 9)
    },
    unselectedOwnerAndRecipeBranchesRetainDemandBoundaries: () => {
        const shared = id(0), owner = id(0)
        assertEq(evaluate(fromFast(result(['?:', false, ref(owner), 9], [
            ['define', shared, failed('unselected owner'), 'lazy'], ['define', owner, ownedLoopValue(ref(shared)), 'lazy'],
        ]))), 9)
        assertEq(evaluate(fromFast(result(ref(owner), [
            ['define', shared, failed('unselected recipe branch'), 'lazy'],
            ['define', owner, ['?:', true, 9, ownedLoopValue(ref(shared))], 'lazy'],
        ]))), 9)
    },
    callerReadsBeforeAndAfterOwnerKeepOneEstablishedValue: () => {
        const shared = id(0), owner = id(0), before = id(0)
        const value = evaluate(fromFast(result(['array', [ref(before), ref(owner), ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['define', owner, ownedLoopValue(ref(shared)), 'lazy'], ['define', before, ref(shared), 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4], [4]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
    },
    recipeLocalAliasesDoNotEvaluateOrDuplicateBorrowedCells: () => {
        const shared = id(0), owner = id(0), alias = id(0)
        const loop = collectingMemo(ref(alias), 2)
        const initializer = /** @type {Value} */ (['block', result(['array', [collectedMemo(ref(loop.results[0])), ref(alias)]], [
            ['define', alias, ref(shared), 'lazy'], ['loop', loop],
        ])])
        const value = evaluate(fromFast(result(['array', [ref(owner), ref(shared)]], [['define', shared, ['array', [4]], 'lazy'], ['define', owner, initializer, 'lazy']])))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4], [4]], [4]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0], value[1])
    },
    deferredOwnersAndCapturesStayFreshAcrossInvocations: () => {
        const argument = id(0), shared = id(0), owner = id(0), captured = id(0)
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(owner) }] }])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest: null, self: null, captures: [],
            body: body(['return', target, getter], [['define', shared, ['array', [ref(argument)]], 'lazy'], ['define', owner, ownedLoopValue(ref(shared)), 'lazy']]) })
        const factory = id(0), original = id(0), first = id(0), second = id(0)
        const value = evaluate(fromFast(result(['array', [['()', ref(first), []], ['()', ref(first), []], ['()', ref(second), []], ref(original)]], [
            ['define', factory, ['function', fn], 'required'], ['define', original, ['array', [4]], 'required'],
            ['define', first, ['()', ref(factory), [ref(original)]], 'required'], ['define', second, ['()', ref(factory), [ref(original)]], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array)
        assertStructurallySame(value, [[[4]], [[4]], [[4]], [4]])
        assertEq(value[0], value[1])
        assert(value[0] !== value[2])
        assertEq(value[0][0], value[3])
        assertEq(value[2][0], value[3])
    },
    iterationOwnedPrerequisitesAndOwnersResetAtReachedDeclarations: () => {
        const count = id(0), saved = id(0), prerequisite = id(0), owner = id(0), output = id(0), captured = id(0)
        const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const getter = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(owner) }] }])
        const loop = /** @type {Loop} */ ({ target: outer, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', outer, [['+', ref(count), 1], ['array', [ref(saved), getter, ref(prerequisite)]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', outer, [ref(saved)]]), body(['yield', []])],
                ['define', prerequisite, ['array', [ref(count)]], 'lazy'], ['define', owner, ownedLoopValue(ref(prerequisite)), 'lazy'],
            ]) })
        const previous = /** @type {Value} */ (['.', ref(output), 0])
        const value = evaluate(fromFast(afterLoop(loop, ['array', [
            ['()', ['.', ref(output), 1], []], ['.', ref(output), 2], ['()', ['.', previous, 1], []], ['.', previous, 2],
        ]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[1], [1], [0], [0]])
        assertEq(value[0], value[1])
        assertEq(value[2], value[3])
        assert(value[0] !== value[2])
    },
    establishedExternalValuesNeedNoUnavailableRecipe: () => {
        const external = id(0), owner = id(0)
        const supplied = /** @type {Exp} */ (['[]', [4]])
        const value = evaluate(fromFast(result(['array', [ref(owner), ref(external)]], [['define', owner, ownedLoopValue(ref(external)), 'lazy']]), [[external, supplied]]))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    ordinaryBodiesAndUnrelatedPureLoopsKeepNoPlanIdentity: () => {
        const shared = id(0), owner = id(0), local = id(0), nested = id(0), callee = id(0)
        const pure = collectingMemo(7, 2)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(nested)], [['define', local, failed('uninvoked body'), 'lazy'], ['define', nested, ownedLoopValue(ref(local)), 'lazy']]) })
        const source = /** @type {Block} */ (result(9, [
            ['define', shared, failed('unrelated source'), 'lazy'], ['define', owner, ['block', afterLoop(pure, ref(shared))], 'lazy'], ['define', callee, ['function', fn], 'required'],
        ]))
        assertEq(normalizeMemo(source), source)
        assertEq(evaluate(fromFast(source)), 9)
        const demanded = /** @type {Block} */ (result(['array', [ref(owner), ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'], ['define', owner, ['block', afterLoop(pure, ref(shared))], 'lazy'],
        ]))
        assertEq(normalizeMemo(demanded), demanded)
        const value = evaluate(fromFast(demanded))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
    },
    owningReturnPrerequisitesKeepTheirSourceFunction: () => {
        const stop = id(0), shared = id(0), owner = id(0)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(owner), ref(shared)]]], [
                ['define', shared, mixed(ref(stop), ['array', [4]], 7), 'lazy'], ['define', owner, ownedLoopValue(ref(shared)), 'lazy'],
            ]) })
        const value = evaluate(calledFunction(fn, [false]))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    rawAndGraphMetadataAndSharingSurviveSevenGraphs: () => {
        const argument = id(0), rest = id(0), self = id(0), captured = id(0), shared = id(0), owner = id(0)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(owner), ref(shared), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', shared, ['array', [ref(argument), ref(captured), ref(rest)]], 'lazy'], ['define', owner, ownedLoopValue(ref(shared)), 'lazy'],
            ]) })
        const raw = prepareFunction(fn)
        assertEq(raw.target, target)
        assertEq(raw.parameters[0], argument)
        assertEq(raw.rest, rest)
        assertEq(raw.self, self)
        assertEq(raw.captures.length, 1)
        assertEq(raw.captures[0].binding, captured)
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) { graph = fromFast(assertOk(toFast(graph))); graphs = [...graphs, graph] }
        for (const later of graphs.slice(5)) { assertStructurallySame(flat(later), flat(graphs[4])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], raw.parameters.length)
            assertEq(current[2].length, raw.captures.length)
            const restored = assertOk(toFast(current))
            assert(restored.exit[0] === 'yield')
            const returned = restored.exit[1][0]
            const definition = returned instanceof Array && returned[0] === 'ref'
                ? restored.statements.find(statement => statement[0] === 'define' && statement[1] === returned[1]) : undefined
            const value = definition?.[0] === 'define' ? definition[2] : returned
            assert(value instanceof Array && value[0] === 'function')
            const prepared = prepareFunction(value[1])
            assertEq(prepared.parameters.length, raw.parameters.length)
            assertEq(prepared.captures.length, raw.captures.length)
            assert(prepared.rest !== null && prepared.self !== null)
            const normal = evaluate(['()', current, [['[]', [8]], 9, 10]])
            assert(normal instanceof Array && normal[0] instanceof Array)
            assertStructurallySame(normal, [[[8], [4], [9, 10]], [[8], [4], [9, 10]], [9, 10], true])
            assertEq(normal[0], normal[1])
            assertEq(normal[0][2], normal[2])
        }
    },
    throw: {
        trueExternalDeferredPrerequisiteStillHasNoOwnedRecipe: () => {
            const external = id(0), owner = id(0)
            fromFast(result(ref(owner), [['define', owner, ownedLoopValue(ref(external)), 'lazy']]), [[external, ['[]', [4]], 'lazy']])
        },
        transitiveExternalPrerequisiteCannotAcquireCallerOwnership: () => {
            const external = id(0), dependent = id(0), owner = id(0)
            fromFast(result(ref(owner), [
                ['define', dependent, ['array', [ref(external)]], 'lazy'], ['define', owner, ownedLoopValue(ref(dependent)), 'lazy'],
            ]), [[external, ['[]', [4]], 'lazy']])
        },
    },
})
