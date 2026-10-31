/**
 * Array and call spread completion integration over normalized FAST.
 *
 * @import { BindingId, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Runtime } from '../../value/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo } from '../proof.f.mjs'
import { requiredFunction, escape, failed, mixed, evaluate, failure, runtimeReturning, throwingRuntime, flat } from '../member_returns/proof.f.mjs'

/** @type {(parameters: readonly BindingId[], value: Value, rest?: BindingId | null) => Value} */
const simpleFunction = (parameters, value, rest = null) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target: owner, parameters, rest, self: null, captures: [], body: body(['return', owner, value]) }]
}

/** @type {() => Value} */
export const _collector = () => {
    const rest = id(0)
    return simpleFunction([], ref(rest), rest)
}

export const proof = /** @type {const} */ ({
    expansionBeforeLaterSuccessfulReturn: () => {
        for (const source of /** @type {readonly Value[]} */ ([null, undefined, false, 0, ['object', []], simpleFunction([], 1)])) {
            failure(calledFunction(requiredFunction(['array', [['...', source], escape()]])))
            failure(calledFunction(requiredFunction(['()', _collector(), [['...', source], escape()]])))
            failure(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [['...', source], escape()]]])))
        }
        assertEq(failure(calledFunction(requiredFunction(['array', [['...', failed('spread operand')], escape()]]))), 'spread operand')
        assertEq(failure(calledFunction(requiredFunction(['()', _collector(), [['...', ['array', [1]]], failed('later argument'), escape()]]))), 'later argument')
        assertEq(failure(calledFunction(requiredFunction(['array', [failed('earlier value'), ['...', escape()]]]))), 'earlier value')
    },
    returningSpreadSkipsExpansionAndTail: () => {
        for (const payload of /** @type {readonly Value[]} */ ([7, null, ['object', []], ['array', [1, 2]]])) {
            const array = /** @type {Value} */ (['array', [1, ['...', escape(payload)], failed('array tail')]])
            const call = /** @type {Value} */ (['()', 0, [['...', ['array', [1]]], ['...', escape(payload)], failed('call tail')]])
            const member = /** @type {Value} */ (['.', 'abc', 'slice', ['|()', [['...', escape(payload)], failed('member tail')]]])
            const optional = /** @type {Value} */ (['.', 'abc', 'slice', ['|?.()', [['...', escape(payload)], failed('optional tail')]]])
            assertStructurallySame(evaluate(calledFunction(requiredFunction(array))), evaluate(calledFunction(requiredFunction(payload))))
            assertStructurallySame(evaluate(calledFunction(requiredFunction(call))), evaluate(calledFunction(requiredFunction(payload))))
            assertStructurallySame(evaluate(calledFunction(requiredFunction(member))), evaluate(calledFunction(requiredFunction(payload))))
            assertStructurallySame(evaluate(calledFunction(requiredFunction(optional))), evaluate(calledFunction(requiredFunction(payload))))
        }
        assertEq(evaluate(calledFunction(requiredFunction(['array', [escape(11), ['...', failed('unreached spread')]]]))), 11)
        assertEq(evaluate(calledFunction(requiredFunction(['()', _collector(), [escape(12), ['...', failed('unreached argument spread')]]]))), 12)
    },
    normalUnicodeAndSeveralSpreads: () => {
        const text = /** @type {const} */ ('\ud800A😀\udfff')
        const expected = /** @type {const} */ ([0, '\ud800', 'A', '😀', '\udfff', 1, 2, 3])
        const items = /** @type {const} */ ([0, ['...', text], ['...', ['array', [1, 2]]], ['...', ''], mixed(false, 3)])
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['array', items]))), expected)
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['()', _collector(), items]))), expected)
        const first = id(0), second = id(0), rest = id(0)
        const fn = simpleFunction([first, second], ['array', [ref(first), ref(second), ref(rest)]], rest)
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['()', fn, [['...', ['array', [4]]], 5, ['...', '😀x'], mixed(false, 6)]]))), [4, 5, ['😀', 'x', 6]])
        const nested = simpleFunction([], ['array', [8, 9]])
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['array', [['...', ['()', nested, []]], mixed(false, 10)]]))), [8, 9, 10])
    },
    callableValidationAndPayloadIdentity: () => {
        const payload = id(0)
        const observed = /** @type {Value} */ (['array', [ref(payload), ref(payload)]])
        for (const callee of /** @type {readonly Value[]} */ ([0, null, undefined])) {
            const fn = requiredFunction(['()', callee, [['...', ['array', [1, 2]]], escape(observed)]], [payload])
            const value = evaluate(calledFunction(fn, [['array', [4]]]))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assertStructurallySame(value, [[4], [4]])
        }
        const value = evaluate(calledFunction(requiredFunction(['array', [['...', ['array', [ref(payload), ref(payload)]]], mixed(false, 0)]], [payload]), [['array', [5]]]))
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertStructurallySame(value, [[5], [5], 0])
    },
    memberLookupAndReceiverBinding: () => {
        for (const receiver of /** @type {readonly Value[]} */ ([null, undefined])) {
            failure(calledFunction(requiredFunction(['.', receiver, 'x', ['|()', [['...', escape()]]]])))
            failure(calledFunction(requiredFunction(['()', ['.', receiver, 'x'], [['...', escape()]]])))
        }
        const stop = id(0)
        for (const direct of /** @type {const} */ ([false, true])) {
            const args = /** @type {const} */ ([['...', ['array', [1]]], mixed(ref(stop), 2)])
            const value = /** @type {Value} */ (direct ? ['()', ['.', 'abc', 'slice'], args] : ['.', 'abc', 'slice', ['|()', args]])
            const fn = requiredFunction(value, [stop])
            assertEq(evaluate(calledFunction(fn, [false])), 'b')
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
        const own = /** @type {Value} */ (['object', [[':', 'x', _collector()]]])
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['.', own, 'x', ['|()', [['...', '😀x'], mixed(false, 3)]]]))), ['😀', 'x', 3])
    },
    optionalSkipsAndForcedExpansion: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['?.', null, 'x', ['|()', [['...', failed('skipped spread')], escape()]]],
            ['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [['...', failed('skipped spread')], escape()]]],
            ['?.()', undefined, [['...', failed('skipped spread')], escape()]],
        ])) { assertEq(evaluate(calledFunction(requiredFunction(value))), undefined) }
        for (const value of /** @type {readonly Value[]} */ ([
            ['?.', null, 'x', ['|!()', [['...', ['array', [1]]], escape('forced')]]],
            ['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [['...', failed('skipped spread')]], ['|!()', [['...', ['array', []]], escape('forced')]]]],
            ['?.()', null, [['...', failed('skipped spread')]], ['|!()', [['...', ['array', []]], escape('forced')]]],
        ])) { assertEq(evaluate(calledFunction(requiredFunction(value))), 'forced') }
        const invalidForced = /** @type {Value} */ (['?.', null, 'x', ['|!()', [['...', 0], escape()]]])
        failure(calledFunction(requiredFunction(invalidForced)))
        const liveForced = /** @type {Value} */ (['?.', 'abc', 'slice', ['|!()', [['...', ['array', [1]]], mixed(false, 2)]]])
        assertEq(evaluate(calledFunction(requiredFunction(liveForced))), 'b')
    },
    runtimePresencePrecedesSpreadControl: () => {
        assertEq(failure(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [['...', escape()]]]])), throwingRuntime), 'lookup')
        assertEq(failure(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|?.()', [['...', escape()]]]])), throwingRuntime), 'lookup')
        for (const runtime of /** @type {readonly (Runtime | undefined)[]} */ ([undefined, ['{}', []], runtimeReturning(['undefined'])])) {
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|?.()', [['...', 0], escape()]]])), runtime), undefined)
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|()', [['...', ['array', []]], escape()]]])), runtime), 7)
        }
        for (const value of /** @type {readonly Exp[]} */ ([null, 0, false, ['{}', []], ['=>', 0, [], 99]])) {
            const runtime = runtimeReturning(value)
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|?.()', [['...', ['array', [1]]], escape()]]])), runtime), 7)
            failure(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|?.()', [['...', 0], escape()]]])), runtime)
        }
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [['...', ['array', [8, 9]]], mixed(false, 10)]]])), runtimeReturning(['=>', 0, [], ['rest']])), [8, 9, 10])
    },
    memoCallerAndInitializerSharing: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), output = id(0)
        for (const asCall of /** @type {const} */ ([false, true])) {
            const items = /** @type {const} */ ([['...', ref(selected)], mixed(ref(stop), 0, ['array', [ref(selected), ref(selected), ref(caller)]])])
            const value = /** @type {Value} */ (asCall ? ['()', _collector(), items] : ['array', items])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller)]]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'],
                    ['define', output, value, 'required'],
                ]),
            })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array && normal[0] instanceof Array && normal[1] instanceof Array)
            assertEq(normal[0][0], normal[0][1])
            assertEq(normal[0][0], normal[1][0])
            assertEq(normal[1][0], normal[1][1])
            assertEq(normal[0][0][0], normal[2])
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
        }
    },
    optionalSkippedMemoAndConditionalRegion: () => {
        const latent = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), 9]]], [
                ['define', latent, failed('skipped memo spread'), 'lazy'],
                ['define', output, ['?.', null, 'x', ['|()', [['...', ref(latent)], escape()]]], 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn)), [undefined, 9])
        const unselected = /** @type {Value} */ (['if', false, result(['array', [['...', 0], escape()]]), result(11)])
        assertEq(evaluate(calledFunction(requiredFunction(unselected))), 11)
    },
    iterationClosureAndFreshInvocation: () => {
        const local = id(0), count = id(0), output = id(0), captured = id(0), made = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const witness = collectingMemo(ref(local), 2)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', loopTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', loopTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', witness],
                    ['define', made, ['()', _collector(), [['...', ['array', [ref(local)]]], mixed(['===', ref(count), 1], 0, getter)]], 'required'],
                ]), body(['yield', []])],
            ]),
        })
        const factory = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, null], [['loop', loop]]) })
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), left = id(0), right = id(0)
        const value = evaluate(fromFast(result(['array', [ref(left), ref(right)]], [
            ['define', factoryBinding, ['function', factory], 'required'],
            ['define', firstFn, ['()', ref(factoryBinding), []], 'required'], ['define', secondFn, ['()', ref(factoryBinding), []], 'required'],
            ['define', left, ['()', ref(firstFn), []], 'required'], ['define', right, ['()', ref(secondFn), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(captured), ref(rest), ref(self)]]], [
                ['define', output, ['array', [['...', ref(rest)], mixed(ref(stop), ref(argument), ['array', [ref(captured), ref(captured), ref(rest)]])]], 'required'],
            ]),
        })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) {
            graph = fromFast(assertOk(toFast(graph)))
            graphs = [...graphs, graph]
        }
        for (const later of graphs.slice(4)) { assertStructurallySame(flat(later), flat(graphs[3])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            const returned = evaluate(['()', current, [true, 1, 8, 9]])
            assert(returned instanceof Array)
            assertEq(returned[0], returned[1])
            assertStructurallySame(returned, [[4], [4], [8, 9]])
            const called = /** @type {Exp} */ (['()', current, [false, 1, 8, 9]])
            const observed = /** @type {Exp} */ (['[]', [['.', called, 0], ['.', called, 1], ['.', called, 2], ['===', ['.', called, 3], current]]])
            assertStructurallySame(evaluate(observed), [[8, 9, 1], [4], [8, 9], true])
        }
    },
    noReturnIdentity: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['array', [['...', '😀x'], 1]], ['()', _collector(), [['...', ['array', [1]]]]],
            ['.', 'abc', 'slice', ['|()', [['...', ['array', [1]]]]]],
            ['?.', null, 'x', ['|()', [['...', 0]]]], ['?.()', undefined, [['...', 0]]],
        ])) {
            const source = requiredFunction(value).body
            assertEq(liftReturns(source, target), source)
        }
    },
    throw: {
        foreignSpreadReturn: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const wrong = /** @type {Value} */ (['block', body(['return', foreign, 7])])
            fromFast(result(['function', requiredFunction(['array', [['...', wrong]]])]))
        },
    },
})
