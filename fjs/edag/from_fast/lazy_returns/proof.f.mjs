/**
 * Deferred initializers expose owning returns only at a reached first demand.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction } from '../proof.f.mjs'
import { escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'
import { staticRuntime } from '../native_returns/proof.f.mjs'

/** @type {(initializer: Value, consume: (binding: BindingId) => Block, parameters?: readonly BindingId[]) => FastFunction} */
export const _deferred = (initializer, consume, parameters = []) => {
    const lazy = id(0)
    const consumed = consume(lazy)
    return { target, parameters, rest: null, self: null, captures: [],
        body: { ...consumed, statements: [['define', lazy, initializer, 'lazy'], ...consumed.statements] } }
}

export const proof = /** @type {const} */ ({
    computedObjectKeyConversionPrecedesLazyValueDemand: () => {
        const stop = id(0)
        const keyOwner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const key = /** @type {Value} */ (['object', [[':', 'toString', ['function', {
            target: keyOwner, parameters: [], rest: null, self: null, captures: [], body: body(['throw', 'key conversion']),
        }]]]])
        for (const prerequisite of /** @type {const} */ ([false, true])) {
            const dependent = id(0)
            for (const spread of /** @type {const} */ ([false, true])) {
                const fn = _deferred(mixed(ref(stop), 9), lazy => body(['return', target, ['object', [
                    ...spread ? [/** @type {const} */ (['...', ['object', []]])] : [], [':', key, ref(prerequisite ? dependent : lazy)],
                ]]], prerequisite ? [['define', dependent, ['array', [ref(lazy)]], 'lazy']] : []), [stop])
                for (const returning of /** @type {const} */ ([false, true])) {
                    assertEq(failure(calledFunction(fn, [returning])), 'key conversion')
                }
            }
        }
    },
    returningObjectKeyDemandSkipsItsValueAndLaterEntries: () => {
        const stop = id(0)
        const suffix = failed('after key demand')
        for (const atValue of /** @type {const} */ ([false, true])) {
            const fn = _deferred(mixed(ref(stop), 'normal'), lazy => body(['return', target, ['object', [
                [':', 'before', 1], [':', ref(lazy), atValue ? suffix : 9], [':', 'after', atValue ? 9 : suffix],
            ]]]), [stop])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            assertEq(failure(calledFunction(fn, [false])), 'after key demand')
        }
    },
    convertedObjectKeyRetainsSharedNormalPayload: () => {
        const stop = id(0), output = id(0)
        const keyOwner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const key = /** @type {Value} */ (['object', [[':', 'toString', ['function', {
            target: keyOwner, parameters: [], rest: null, self: null, captures: [], body: body(['return', keyOwner, 'converted']),
        }]]]])
        const fn = _deferred(mixed(ref(stop), ['array', [4]]), lazy => body(['return', target, ['array', [
            ['.', ref(output), 'converted'], ref(lazy),
        ]]], [['define', output, ['object', [[':', key, ref(lazy)]]], 'required']]), [stop])
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array)
        assertStructurallySame(normal, [[4], [4]])
        assertEq(normal[0], normal[1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    initializerOwnedLoopLocalCell: () => {
        const inner = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [ref(inner)]], [['define', inner, escape(), 'lazy']]),
        })
        assertEq(evaluate(calledFunction(_deferred(['block', result(ref(output), [['loop', loop]])],
            outer => body(['return', target, ref(outer)])))), 7)
    },
    undemandedInitializerRemainsDeferred: () => {
        for (const initializer of /** @type {readonly Value[]} */ ([escape(), failed('undemanded initializer')])) {
            assertEq(evaluate(calledFunction(_deferred(initializer, () => body(['return', target, 9])))), 9)
        }
    },
    selectedFirstDemandReturnsBeforeConsumerAndSuffix: () => {
        const reached = id(0), output = id(0), tail = id(0)
        const fn = _deferred(escape(), lazy => body(['return', target, 9], [
            ['if', [], ref(reached), body(['yield', []], [
                ['define', output, ['array', [ref(lazy), failed('skipped consumer')]], 'required'],
                ['define', tail, failed('skipped suffix'), 'required'],
            ]), body(['yield', []])],
        ]), [reached])
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    declarationDoesNotMoveReturnBeforeReachedPrefix: () => {
        const prefix = id(0)
        const fn = _deferred(escape(), lazy => body(['return', target, ref(lazy)], [
            ['define', prefix, failed('before demand'), 'required'],
        ]))
        assertEq(failure(calledFunction(fn)), 'before demand')
    },
    initializerPrefixRunsBeforeItsReturn: () => {
        const prefix = id(0), unused = id(0)
        const failing = /** @type {Value} */ (['block', body(['return', target, 7], [
            ['define', prefix, failed('initializer prefix'), 'required'],
        ])])
        assertEq(failure(calledFunction(_deferred(failing, lazy => body(['return', target, ref(lazy)])))), 'initializer prefix')
        const normal = /** @type {Value} */ (['block', body(['return', target, 7], [
            ['define', unused, failed('undemanded initializer local'), 'lazy'], ['define', prefix, 1, 'required'],
        ])])
        assertEq(evaluate(calledFunction(_deferred(normal, lazy => body(['return', target, ref(lazy)])))), 7)
    },
    successfulDemandCachesAcrossConditionalUses: () => {
        const stop = id(0), first = id(0), second = id(0)
        const fn = _deferred(mixed(ref(stop), ['array', [4]]), lazy => body(['return', target, ['array', [ref(first), ref(second), ref(lazy)]]], [
            ['if', [first], true, result(ref(lazy)), result(null)],
            ['if', [second], false, result(null), result(ref(lazy))],
        ]), [stop])
        const factory = id(0), left = id(0), right = id(0)
        const value = evaluate(fromFast(result(['array', [ref(left), ref(right)]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', left, ['()', ref(factory), [false]], 'required'], ['define', right, ['()', ref(factory), [false]], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[4], [4], [4]], [[4], [4], [4]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0], value[0][2])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    completionShapedNormalPayloadsStayOpaque: () => {
        const payloads = /** @type {readonly Value[]} */ ([
            ['array', [false, 7]], ['array', [true, 7]], ['array', [0, 7]], ['array', [1, 7]],
            ['array', ['return', 7]], ['array', ['normal', 7]],
            ['object', [[':', 'kind', 'return'], [':', 'value', 7]]],
        ])
        for (const payload of payloads) {
            const fn = _deferred(mixed(false, payload), lazy => body(['return', target, ['array', [ref(lazy), ref(lazy)]]]))
            const value = evaluate(calledFunction(fn))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assertStructurallySame(value[0], evaluate(fromFast(result(payload))))
        }
    },
    prerequisiteAndAliasShareFirstDemand: () => {
        const stop = id(0), prerequisite = id(0), alias = id(0), dependent = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(alias), ref(prerequisite), ref(dependent)]]], [
                ['define', prerequisite, mixed(ref(stop), ['array', [4]]), 'lazy'],
                ['define', alias, ref(prerequisite), 'lazy'],
                ['define', dependent, ['array', [ref(alias), ref(prerequisite)]], 'lazy'],
                ['define', output, ref(dependent), 'required'],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array)
        assertEq(normal[0], normal[3])
        assertEq(normal[0][0], normal[0][1])
        assertEq(normal[0][0], normal[1])
        assertEq(normal[1], normal[2])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    unselectedPrerequisiteIsNotCapturedEagerly: () => {
        const selected = id(0), bad = id(0), lazy = id(0)
        const initializer = /** @type {Value} */ (['if', ref(selected), result(ref(bad)), body(['return', target, 7])])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ref(lazy)], [
                ['define', bad, failed('selected prerequisite'), 'lazy'], ['define', lazy, initializer, 'lazy'],
            ]) })
        assertEq(evaluate(calledFunction(fn, [false])), 7)
        assertEq(failure(calledFunction(fn, [true])), 'selected prerequisite')
    },
    recipeLocalLifetimesRemainSharedWithinOneDemand: () => {
        const stop = id(0), caller = id(0), local = id(0), selected = id(0)
        const returned = /** @type {Value} */ (['array', [ref(local), ref(local), ref(caller)]])
        const initializer = /** @type {Value} */ (['block', result(['array', [ref(local), ref(local), ref(caller)]], [
            ['define', local, ['array', [ref(caller)]], 'lazy'],
            ['if', [], ref(stop), body(['return', target, returned]), body(['yield', []])],
        ])])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(selected), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['define', selected, initializer, 'lazy'],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[0][0] instanceof Array)
        assertEq(normal[0], normal[1])
        assertEq(normal[0][0], normal[0][1])
        assertEq(normal[0][0][0], normal[2])
        const stopped = evaluate(calledFunction(fn, [true]))
        assert(stopped instanceof Array && stopped[0] instanceof Array)
        assertEq(stopped[0], stopped[1])
        assertEq(stopped[0][0], stopped[2])
    },
    callerDemandThroughLoopEntryAndTransfer: () => {
        const stop = id(0), lazy = id(0), count = id(0), held = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, held], initial: [0, ref(lazy)], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ref(lazy)]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [['array', [ref(held), ref(lazy)]]]]), body(['yield', []])],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(lazy)]]], [
                ['define', lazy, mixed(ref(stop), ['array', [4]]), 'lazy'], ['loop', loop],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array)
        assertEq(normal[0][0], normal[0][1])
        assertEq(normal[0][0], normal[1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    firstDemandInBreakAndContinuePayloads: () => {
        const stop = id(0), lazy = id(0), count = id(0), held = id(0), output = id(0)
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, held], initial: [0, null], results: [output],
                body: body(kind === 'break' ? ['break', loopTarget, [['array', [ref(lazy), ref(lazy)]]]]
                    : ['continue', loopTarget, [['+', ref(count), 1], ref(lazy)]], [
                    ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [['array', [ref(held), ref(lazy)]]]]), body(['yield', []])],
                ]) })
            const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['define', lazy, mixed(ref(stop), ['array', [4]]), 'lazy'], ['loop', loop]]) })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array)
            assertEq(normal[0], normal[1])
            assertStructurallySame(normal, [[4], [4]])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
    },
    loopDemandIsSkippedUntilItsSelectedIteration: () => {
        const reached = id(0), lazy = id(0), count = id(0), observed = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [9]]), body(['yield', []])],
                ['if', [], ['?:', ['===', ref(count), 1], ref(reached), false], body(['yield', []], [
                    ['define', observed, ['array', [ref(lazy), failed('skipped loop consumer')]], 'required'],
                ]), body(['yield', []])],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [reached], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['define', lazy, escape(), 'lazy'], ['loop', loop]]) })
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    iterationDeclarationsHaveFreshMemoAndEscapingCaptures: () => {
        const count = id(0), lazy = id(0), local = id(0), captured = id(0), dead = id(0), output = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(local) }], body: body(['return', owner, ['array', [ref(captured), ref(captured)]]]),
        }])
        const initializer = /** @type {Value} */ (['block', result(ref(local), [
            ['define', local, ['array', [ref(count)]], 'lazy'],
            ['if', [], ['===', ref(count), 1], body(['return', target, getter]), body(['yield', []])],
        ])])
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [null]]), body(['yield', []])],
                ['define', lazy, initializer, 'lazy'], ['define', dead, ['array', [ref(lazy), ref(lazy)]], 'required'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['loop', loop]]) })
        const factory = id(0), first = id(0), second = id(0)
        const value = evaluate(fromFast(result(['array', [['()', ref(first), []], ['()', ref(second), []]]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), []], 'required'], ['define', second, ['()', ref(factory), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    selectedOperandDemandRetainsSkipAndPrefixOrder: () => {
        const selected = id(0)
        const fn = _deferred(escape(), lazy => body(['return', target, ['if', ref(selected), result(ref(lazy)), result(9)]]), [selected])
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
        assertEq(evaluate(calledFunction(_deferred(escape(), lazy => body(['return', target, ['?.', null, 'method', ['|()', [ref(lazy)]]]])))), undefined)
        assertEq(failure(calledFunction(_deferred(escape(), lazy => body(['return', target, ['array', [failed('operand prefix'), ref(lazy)]]])))), 'operand prefix')
    },
    nativeReadRemainsAtTheSelectedDemand: () => {
        const reached = id(0), stop = id(0)
        const initializer = /** @type {Value} */ (['()', ['Number.isInteger'], [mixed(ref(stop), 9)]])
        const fn = _deferred(initializer, lazy => body(['return', target, ['if', ref(reached), result(ref(lazy)), result(3)]]), [reached, stop])
        const throwingRead = staticRuntime(['throw', 'demand static read'])
        assertEq(evaluate(calledFunction(fn, [false, true])), 3)
        assertEq(evaluate(calledFunction(fn, [false, true]), throwingRead), 3)
        assertEq(failure(calledFunction(fn, [true, true])), 'no binding for the static Number.isInteger')
        assertEq(failure(calledFunction(fn, [true, true]), throwingRead), 'demand static read')
        assertEq(evaluate(calledFunction(fn, [true, true]), staticRuntime(['=>', 1, [], ['throw', 'skipped native call']])), 7)
        assertEq(evaluate(calledFunction(fn, [true, false]), staticRuntime(['=>', 1, [], ['arg', 0]])), 9)
    },
    nestedFunctionKeepsItsOwnReturnBoundary: () => {
        const outerLazy = id(0), nestedLazy = id(0), nested = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const inner = /** @type {FastFunction} */ ({ target: owner, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', owner, ['array', [ref(nestedLazy), failed('skipped nested consumer')]]], [
                ['define', nestedLazy, ['block', body(['return', owner, 3])], 'lazy'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(nested), ref(outerLazy)]]], [
                ['define', outerLazy, mixed(false, 9), 'lazy'], ['define', nested, ['()', ['function', inner], []], 'required'],
            ]) })
        assertStructurallySame(evaluate(calledFunction(fn)), [3, 9])
    },
    firstCaptureDemandKeepsTheConstructingOwner: () => {
        const stop = id(0), captured = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = _deferred(mixed(ref(stop), 3), lazy => body(['return', target, ['()', ['function', {
            target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(lazy) }], body: body(['return', owner, ref(captured)]),
        }], []]]), [stop])
        assertEq(evaluate(calledFunction(fn, [false])), 3)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), self = id(0), captured = id(0), lazy = id(0)
        const returned = /** @type {Value} */ (['array', [ref(captured), ref(captured), ref(rest)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop, argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(lazy), ref(lazy), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', lazy, mixed(ref(stop), ['array', [ref(argument), ref(captured), ref(rest), ['===', ref(self), ref(self)]]], returned), 'lazy'],
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
    noReturnInitializerKeepsSyntaxIdentity: () => {
        const lazy = id(0)
        const source = body(['return', target, ref(lazy)], [['define', lazy, ['array', [4]], 'lazy']])
        assertEq(liftReturns(source, target), source)
    },
    throw: {
        demandedForeignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(_deferred(['block', body(['return', foreign, 7])], lazy => body(['return', target, ref(lazy)])))
        },
        demandCannotEscapeToEnclosingLoop: () => {
            const lazy = id(0), output = id(0), observed = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', loopTarget, [9]], [
                    ['define', lazy, ['block', body(['break', loopTarget, [7]])], 'lazy'], ['define', observed, ref(lazy), 'required'],
                ]) })
            calledFunction({ target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['loop', loop]]) })
        },
    },
})
