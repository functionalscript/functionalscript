/**
 * Wrapped callee values lose member-call provenance before ordinary arguments.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { exp } from '../../module.f.mjs'
import { validate } from '../../../rtti/validate/module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction } from '../proof.f.mjs'
import { requiredFunction, escape, failed, mixed, evaluate, failure, flat, runtimeReturning, throwingRuntime } from '../member_returns/proof.f.mjs'
import { wrappers } from '../native_returns/proof.f.mjs'

/** @type {(value: Value) => readonly Value[]} */
const wrapped = value => wrappers(value).slice(1)

/** @type {(value: Value) => Value} */
const identityMember = value => {
    const argument = id(0)
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const fn = /** @type {Value} */ (['function', { target: owner, parameters: [argument], rest: null, self: null, captures: [],
        body: body(['return', owner, ref(argument)]),
    }])
    return ['.', ['object', [[':', value, fn]]], ['Number', value]]
}

export const proof = /** @type {const} */ ({
    lazyInitializerReturnsAtDemand: () => {
        const lazy = id(0)
        assertEq(evaluate(calledFunction({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(lazy)], [['define', lazy, ['()', ['block', result(identityMember(0))], [escape()]], 'lazy']]) })), 7)
    },
    wrappedOwnCallableArgumentsReturn: () => {
        for (const callee of wrapped(identityMember(0))) {
            const stop = id(0)
            const fn = requiredFunction(['()', callee, [mixed(ref(stop), 9), failed('skipped call tail')]], [stop])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            assertEq(failure(calledFunction(fn, [false])), 'skipped call tail')
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [mixed(false, 9)]]))), 9)
        }
    },
    wrappedMissingAndNoncallableArgumentsStillReturn: () => {
        const values = /** @type {readonly Value[]} */ ([null, undefined, 0, false, '', ['object', []], ['array', []]])
        for (const value of values) {
            for (const callee of wrapped(['.', ['object', [[':', 'method', value]]], 'method'])) {
                assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape(), failed('skipped noncallable tail')]]))), 7)
                failure(calledFunction(requiredFunction(['()', callee, [mixed(false, 9)]])))
            }
        }
        for (const callee of wrapped(['.', ['object', []], 'missing'])) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
        }
    },
    wrappedNativeMethodValueDoesNotResolveMemberCall: () => {
        for (const tag of /** @type {const} */ (['.', '?.'])) {
            for (const callee of wrapped([tag, 'abcd', 'slice'])) {
                const graph = calledFunction(requiredFunction(['()', callee, [escape()]]))
                assertEq(evaluate(graph, throwingRuntime), 7)
                assert(!assertOk(identityAnalysis(graph)).nodes.some(node => node instanceof Array && node[0] === 'memberPresent'))
                failure(calledFunction(requiredFunction(['()', callee, [mixed(false, 1)]])), runtimeReturning(['=>', 1, [], 9]))
            }
        }
        const direct = requiredFunction(['.', 'abcd', 'slice', ['|()', [mixed(false, 1), 3]]])
        assertEq(evaluate(calledFunction(direct)), 'bc')
        assertEq(failure(calledFunction(requiredFunction(['.', 'abcd', 'slice', ['|()', [escape()]]])), throwingRuntime), 'lookup')
    },
    wrappedNonNativeMethodValueDoesNotResolveRuntime: () => {
        const runtime = runtimeReturning(['=>', 1, [], 9])
        for (const callee of wrapped(['.', 'abc', 'startsWith'])) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]])), throwingRuntime), 7)
            failure(calledFunction(requiredFunction(['()', callee, [mixed(false, 'a')]])), runtime)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|()', ['a']]])), runtime), 9)
    },
    optionalValueSkipDoesNotSkipOrdinaryArguments: () => {
        for (const receiver of /** @type {readonly Value[]} */ ([null, undefined])) {
            const value = /** @type {Value} */ (['?.', receiver, ['Number', failed('skipped optional key')]])
            for (const callee of wrapped(value)) {
                assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
                failure(calledFunction(requiredFunction(['()', callee, [mixed(false, 1)]])))
            }
            assertEq(evaluate(calledFunction(requiredFunction(['?.', receiver, 'method', ['|()', [escape()]]]))), undefined)
        }
    },
    continuedPropertyResultRemainsDetached: () => {
        const member = identityMember(0)
        assert(member instanceof Array && member[0] === '.')
        const nested = /** @type {Value} */ (['object', [[':', 'nested', member[1]]]])
        const properties = /** @type {readonly Value[]} */ ([
            ['.', ['.', nested, 'nested'], ['Number', 0]],
            ['?.', nested, 'nested', ['|.', ['Number', 0]]],
        ])
        for (const property of properties) {
            for (const callee of wrapped(property)) {
                const normal = calledFunction(requiredFunction(['()', callee, [mixed(false, 9)]]))
                const returned = calledFunction(requiredFunction(['()', callee, [escape()]]))
                assertOk(validate(exp)(normal))
                assertOk(validate(exp)(returned))
                assertEq(evaluate(normal), 9)
                assertEq(evaluate(returned), 7)
            }
        }
        const skipped = /** @type {Value} */ (['?.', null, 'nested', ['|.', ['Number', failed('skipped continuation key')]]])
        for (const callee of wrapped(skipped)) {
            const graph = calledFunction(requiredFunction(['()', callee, [escape()]]))
            assertOk(validate(exp)(graph))
            assertEq(evaluate(graph), 7)
        }
    },
    reachedReceiverKeyAndPrefixFailuresPrecedeArgumentReturn: () => {
        const prefix = id(0)
        const callee = /** @type {Value} */ (['block', result(identityMember(0), [['define', prefix, failed('callee prefix'), 'required']])])
        assertEq(failure(calledFunction(requiredFunction(['()', callee, [escape()]]))), 'callee prefix')
        for (const callee of wrapped(['.', failed('receiver'), ['Number', escape('key return')]])) {
            assertEq(failure(calledFunction(requiredFunction(['()', callee, [escape()]]))), 'receiver')
        }
        for (const callee of wrapped(['.', ['object', []], ['Number', failed('key')]])) {
            assertEq(failure(calledFunction(requiredFunction(['()', callee, [escape()]]))), 'key')
        }
        for (const callee of wrapped(['.', null, 'method'])) {
            failure(calledFunction(requiredFunction(['()', callee, [escape()]])))
        }
        assertEq(failure(calledFunction(requiredFunction(['()', [',', [failed('comma prefix'), identityMember(0)]], [escape()]]))), 'comma prefix')
    },
    computedKeyConversionPrecedesArgumentReturn: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const conversion = /** @type {Value} */ (['object', [[':', 'valueOf', ['function', { target: owner, parameters: [], rest: null, self: null, captures: [],
            body: body(['throw', 'key conversion']),
        }]]]])
        for (const callee of wrapped(['.', ['object', []], ['Number', conversion]])) {
            assertEq(failure(calledFunction(requiredFunction(['()', callee, [escape()]]))), 'key conversion')
        }
        for (const callee of wrapped(identityMember('0'))) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [mixed(false, 9)]]))), 9)
        }
    },
    selectedMemberNativeAndBareArms: () => {
        const selected = id(0), argument = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const bare = /** @type {Value} */ (['function', { target: owner, parameters: [argument], rest: null, self: null, captures: [],
            body: body(['return', owner, ref(argument)]),
        }])
        for (const kind of /** @type {const} */ (['if', '?:'])) {
            for (const other of /** @type {readonly Value[]} */ ([['slice'], bare])) {
                const callee = kind === 'if' ? /** @type {Value} */ (['if', ref(selected), result(identityMember(0)), result(other)])
                    : /** @type {Value} */ (['?:', ref(selected), identityMember(0), other])
                const fn = requiredFunction(['()', callee, [mixed(false, 'abcd'), 1, 3]], [selected])
                assertEq(evaluate(calledFunction(fn, [true])), 'abcd')
                assertEq(evaluate(calledFunction(fn, [false])), other === bare ? 'abcd' : 'bc')
                for (const pick of /** @type {const} */ ([false, true])) {
                    assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]], [selected]), [pick])), 7)
                }
            }
        }
    },
    unselectedCalleeArmRemainsUnreached: () => {
        const callee = /** @type {Value} */ (['if', true, result(identityMember(0)), result(['.', failed('unselected receiver'), 'method'])])
        assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [mixed(false, 9)]]))), 9)
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['?:', false, failed('unselected callee'), identityMember(0)], [escape()]]))), 7)
    },
    argumentPrefixAndSpreadBoundaries: () => {
        for (const callee of wrapped(identityMember(0))) {
            assertEq(failure(calledFunction(requiredFunction(['()', callee, [failed('first argument'), escape()]]))), 'first argument')
            failure(calledFunction(requiredFunction(['()', callee, [['...', 0], escape()]])))
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [['...', ['array', [1]]], escape('later argument'), failed('skipped tail')]]))), 'later argument')
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [['...', ['array', [mixed(false, 9)]]]]]))), 9)
        }
    },
    callerMemoAndReturnedIdentity: () => {
        const stop = id(0), caller = id(0), selected = id(0), local = id(0), output = id(0)
        const returned = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(local), ref(local)]], [
                    ['define', local, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'],
                ['define', output, ['()', ['block', result(identityMember(0))], [ref(selected), mixed(ref(stop), 0, returned)]], 'required'],
            ]) })
        for (const stopped of /** @type {const} */ ([false, true])) {
            const value = evaluate(calledFunction(fn, [stopped]))
            assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0][0], value[0][1])
            assertEq(value[0][0][0], value[2])
        }
    },
    iterationCaptureOutlivesWrappedCallReturn: () => {
        const count = id(0), local = id(0), captured = id(0), output = id(0), dead = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(local) }], body: body(['return', owner, ['array', [ref(captured), ref(captured)]]]),
        }])
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [null]]), body(['yield', []])],
                ['define', local, ['array', [ref(count)]], 'lazy'],
                ['define', dead, ['()', ['block', result(identityMember(0))], [ref(local), mixed(['===', ref(count), 1], 0, getter)]], 'required'],
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
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), self = id(0), captured = id(0), output = id(0)
        const returned = /** @type {Value} */ (['array', [ref(captured), ref(captured), ref(rest)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop, argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', output, ['()', [',', [0, identityMember(0)]], [ref(captured), mixed(ref(stop), ref(argument), returned)]], 'required'],
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
            assertStructurallySame(evaluate(['()', current, [false, 1, 8, 9]]), [[4], [8, 9], true])
        }
    },
    noReturnIdentityAndIdempotence: () => {
        for (const callee of wrapped(identityMember(0))) {
            const source = requiredFunction(['()', callee, [9]]).body
            assertEq(liftReturns(source, target), source)
            const returning = requiredFunction(['()', callee, [mixed(false, 9)]]).body
            const lifted = liftReturns(returning, target)
            assert(lifted !== returning)
            assertEq(liftReturns(lifted, target), lifted)
        }
    },
    throw: {
        foreignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(requiredFunction(['()', ['block', result(identityMember(0))], [['block', body(['return', foreign, 7])]]]))
        },
    },
})
