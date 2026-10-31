/**
 * Native callees retain their read and invocation boundaries across returns.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Runtime } from '../../value/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { staticIds } from '../../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction } from '../proof.f.mjs'
import { requiredFunction, escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'

/** A represented provider; its answer establishes the read without invoking it. @type {(answer: Exp) => Runtime} */
export const staticRuntime = answer => ['{}', [[':', 'static', ['=>', 1, [], answer]]]]

/** @type {Runtime} */
const throwingCall = staticRuntime(['=>', 0, [], ['throw', 'native invocation']])

/** @type {(value: Value) => readonly Value[]} */
export const wrappers = value => [value, ['block', result(value)], [',', [0, value]],
    ['if', true, result(value), result(value)], ['?:', false, value, value]]

export const proof = /** @type {const} */ ({
    lazyInitializerReturnsAtDemand: () => {
        const lazy = id(0)
        assertEq(evaluate(calledFunction({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(lazy)], [['define', lazy, ['()', ['slice'], [escape()]], 'lazy']]) })), 7)
    },
    staticArgumentsReturnBeforeInvocation: () => {
        for (const name of staticIds) {
            for (const callee of wrappers([name])) {
                const fn = requiredFunction(['()', callee, [escape('returned'), failed('skipped argument')]])
                assertEq(evaluate(calledFunction(fn), throwingCall), 'returned')
            }
        }
    },
    helperArgumentsReturnBeforeInvocation: () => {
        for (const name of /** @type {const} */ (['entry', 'hasEntry', 'slice', 'charCodeAt'])) {
            for (const callee of wrappers([name])) {
                assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [null, escape('returned'), failed('skipped helper argument')]]))), 'returned')
            }
        }
    },
    staticReadFailsBeforeSuccessfulArgumentReturn: () => {
        const throwingRead = staticRuntime(['throw', 'static read'])
        const missing = /** @type {readonly (Runtime | undefined)[]} */ ([undefined, ['{}', []],
            ['{}', [[':', 'static', 0]]], staticRuntime(['undefined']), staticRuntime(0), staticRuntime(['{}', []])])
        for (const callee of wrappers(['Number.isInteger'])) {
            const graph = calledFunction(requiredFunction(['()', callee, [escape()]]))
            assertEq(failure(graph, throwingRead), 'static read')
            for (const runtime of missing) { assertEq(failure(graph, runtime), 'no binding for the static Number.isInteger') }
        }
    },
    calleePrefixFailsBeforeLaterReturn: () => {
        const before = id(0)
        const callee = /** @type {Value} */ (['block', result(['Number.isInteger'], [
            ['define', before, failed('callee prefix'), 'required'],
        ])])
        assertEq(failure(calledFunction(requiredFunction(['()', callee, [escape()]])), throwingCall), 'callee prefix')
        assertEq(failure(calledFunction(requiredFunction(['()', [',', [failed('comma prefix'), ['slice']]], [escape()]]))), 'comma prefix')
    },
    earlierArgumentAndSpreadFailures: () => {
        assertEq(failure(calledFunction(requiredFunction(['()', ['slice'], [failed('first argument'), escape()]]))), 'first argument')
        assertEq(failure(calledFunction(requiredFunction(['()', ['slice'], ['abc', failed('second argument'), escape()]]))), 'second argument')
        failure(calledFunction(requiredFunction(['()', ['slice'], [['...', 0], escape()]])))
        failure(calledFunction(requiredFunction(['()', ['entry'], [['...', null], escape()]])))
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['slice'], [['...', ['array', ['abc', 0, 1]]], escape('extra argument')]]))), 'extra argument')
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['charCodeAt'], ['abc', ['...', escape('spread operand')]]]))), 'spread operand')
    },
    normalIntrinsicAndHelperCalls: () => {
        const stop = id(0)
        for (const callee of wrappers(['slice'])) {
            const fn = requiredFunction(['()', callee, ['abcd', mixed(ref(stop), 1), 3]], [stop])
            assertEq(evaluate(calledFunction(fn, [false])), 'bc')
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['charCodeAt'], [['...', ['array', ['ABC', mixed(false, 1)]]]]]))), 66)
        const receiver = /** @type {Value} */ (['object', [[':', 'present', undefined]]])
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['entry'], [receiver, mixed(false, 'present')]]))), undefined)
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['hasEntry'], [receiver, mixed(false, 'present')]]))), true)
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['hasEntry'], [receiver, mixed(false, 'missing')]]))), false)
    },
    resolvedStaticBodyGetsNormalArguments: () => {
        const stop = id(0)
        const runtime = staticRuntime(['=>', 2, [], ['[]', [['arg', 0], ['arg', 1], ['===', ['self'], ['self']], ['rest']]]])
        for (const callee of wrappers(['Object.is'])) {
            const fn = requiredFunction(['()', callee, [1, ['...', ['array', [mixed(ref(stop), 2), 3, 4]]]]], [stop])
            assertStructurallySame(evaluate(calledFunction(fn, [false]), runtime), [1, 2, true, [3, 4]])
            assertEq(evaluate(calledFunction(fn, [true]), runtime), 7)
        }
        const normal = calledFunction(requiredFunction(['()', ['Number.isInteger'], [mixed(false, 1)]]))
        assertEq(failure(normal, throwingCall), 'native invocation')
    },
    returningCalleeSkipsArguments: () => {
        const stop = id(0)
        const callee = /** @type {Value} */ (['if', ref(stop), body(['return', target, 'callee return']), result(['slice'])])
        const fn = requiredFunction(['()', callee, [mixed(false, 'abcd'), 1, 3]], [stop])
        assertEq(evaluate(calledFunction(fn, [false])), 'bc')
        assertEq(evaluate(calledFunction(fn, [true])), 'callee return')
        const terminal = /** @type {Value} */ (['block', body(['return', target, 9])])
        assertEq(evaluate(calledFunction(requiredFunction(['()', terminal, [failed('skipped callee argument')]]))), 9)
    },
    callerAndInitializerMemoIdentity: () => {
        const stop = id(0), caller = id(0), selected = id(0), local = id(0), output = id(0)
        const runtime = staticRuntime(['=>', 2, [], ['arg', 0]])
        const returned = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(local), ref(local)]], [
                    ['define', local, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'],
                ['define', output, ['()', ['block', result(['Object.is'])], [ref(selected), mixed(ref(stop), ref(caller), returned)]], 'required'],
            ]) })
        for (const stopped of /** @type {const} */ ([false, true])) {
            const value = evaluate(calledFunction(fn, [stopped]), runtime)
            assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0][0], value[0][1])
            assertEq(value[0][0][0], value[2])
        }
    },
    iterationReturnKeepsEscapedCaptureLifetime: () => {
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
                ['define', dead, ['()', ['entry'], [['object', [[':', 'x', ref(local)]]], mixed(['===', ref(count), 1], 'x', getter)]], 'required'],
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
        const runtime = staticRuntime(['=>', 2, [], ['[]', [['arg', 0], ['arg', 1]]]])
        const returned = /** @type {Value} */ (['array', [ref(captured), ref(captured), ref(rest)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop, argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', output, ['()', [',', [0, ['Number.isInteger']]], [ref(captured), mixed(ref(stop), ref(argument), returned)]], 'required'],
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
            const stopped = evaluate(['()', current, [true, 1, 8, 9]], runtime)
            assert(stopped instanceof Array)
            assertEq(stopped[0], stopped[1])
            assertStructurallySame(stopped, [[4], [4], [8, 9]])
            assertStructurallySame(evaluate(['()', current, [false, 1, 8, 9]], runtime), [[[4], 1], [8, 9], true])
        }
    },
    noReturnIdentityAndIdempotence: () => {
        for (const callee of wrappers(['slice'])) {
            const source = requiredFunction(['()', callee, ['abc', 1]]).body
            assertEq(liftReturns(source, target), source)
            const returning = requiredFunction(['()', callee, ['abc', mixed(false, 1)]]).body
            const lifted = liftReturns(returning, target)
            assert(lifted !== returning)
            assertEq(liftReturns(lifted, target), lifted)
        }
    },
    throw: {
        foreignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(requiredFunction(['()', ['slice'], [['block', body(['return', foreign, 7])]]]))
        },
    },
})
