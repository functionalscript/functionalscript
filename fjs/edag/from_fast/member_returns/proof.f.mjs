/**
 * Member and optional-call completion integration over normalized FAST.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Runtime } from '../../value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { memo } from '../../memo/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { toData } from '../../value/to_unknown/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../proof.f.mjs'

/** @type {(value: Value, parameters?: readonly BindingId[]) => FastFunction} */
export const requiredFunction = (value, parameters = []) => {
    const output = id(0)
    return { target, parameters, rest: null, self: null, captures: [],
        body: body(['return', target, ref(output)], [['define', output, value, 'required']]) }
}

/** @type {(value?: Value) => Value} */
export const escape = (value = 7) => ['block', body(['return', target, value])]

/** @type {(message: string) => Value} */
export const failed = message => ['block', body(['throw', message])]

/** @type {(condition: Value, normal: Value, returned?: Value) => Value} */
export const mixed = (condition, normal, returned = 7) => ['if', condition, body(['return', target, returned]), result(normal)]

/** @type {(parameters: readonly BindingId[], value: Value) => Value} */
const simpleFunction = (parameters, value) => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target: owner, parameters, rest: null, self: null, captures: [], body: body(['return', owner, value]) }]
}

/** @type {(graph: Exp, runtime?: Runtime) => unknown} */
export const evaluate = (graph, runtime) => assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [], runtime }))))

/** @type {(graph: Exp, runtime?: Runtime) => unknown} */
export const failure = (graph, runtime) => assertError(memo(assertOk(identityAnalysis(graph)))({ args: [], runtime }))

/** A pure represented lookup provider, with no argument-stage call. @type {(value: Exp) => Runtime} */
export const runtimeReturning = value => ['{}', [[':', 'dot', ['=>', 2, [], value]]]]

/** @type {Runtime} */
export const throwingRuntime = ['{}', [[':', 'dot', ['=>', 2, [], ['throw', 'lookup']]]]]

/** Flat analysis avoids recursively comparing redundant expanded DAGs. @type {(graph: Exp) => unknown} */
export const flat = graph => {
    const { root, nodes, scope, shared } = assertOk(identityAnalysis(graph))
    return { root, nodes, scope, shared }
}

export const proof = /** @type {const} */ ({
    receiverAndComputedKeyReturns: () => {
        for (const tag of /** @type {const} */ (['.', '?.'])) {
            const value = /** @type {Value} */ ([tag, escape('receiver'), ['Number', failed('skipped key')], ['|()', [failed('skipped argument')]]])
            assertEq(evaluate(calledFunction(requiredFunction(value))), 'receiver')
        }
        assertEq(evaluate(calledFunction(requiredFunction(['.', null, ['Number', escape('key')], ['|()', [failed('skipped argument')]]]))), 'key')
        assertEq(evaluate(calledFunction(requiredFunction(['?.', null, ['Number', escape('skipped key')], ['|()', [escape('skipped argument')]]]))), undefined)
        assertEq(evaluate(calledFunction(requiredFunction(['?.', undefined, ['Number', escape('skipped key')], ['|()', [escape('skipped argument')]]]))), undefined)
        const argument = id(0)
        const indexed = /** @type {Value} */ (['array', [simpleFunction([argument], ref(argument))]])
        const stop = id(0)
        const key = /** @type {const} */ (['Number', mixed(ref(stop), '0', 'key return')])
        for (const tag of /** @type {const} */ (['.', '?.'])) {
            const fn = requiredFunction([tag, indexed, key, ['|()', [9]]], [stop])
            assertEq(evaluate(calledFunction(fn, [false])), 9)
            assertEq(evaluate(calledFunction(fn, [true])), 'key return')
        }
    },
    lookupAndConversionBeforeArgumentReturn: () => {
        for (const receiver of /** @type {readonly Value[]} */ ([null, undefined])) {
            failure(calledFunction(requiredFunction(['.', receiver, 'x', ['|()', [escape()]]])))
        }
        const prefix = id(0)
        const receiver = /** @type {Value} */ (['block', result(['object', []], [['define', prefix, failed('receiver prefix'), 'required']])])
        assertEq(failure(calledFunction(requiredFunction(['.', receiver, 'x', ['|()', [escape()]]]))), 'receiver prefix')
        const conversion = /** @type {Value} */ (['object', [[':', 'valueOf', simpleFunction([], failed('numeric key conversion'))]]])
        assertEq(failure(calledFunction(requiredFunction(['.', ['array', []], ['Number', conversion], ['|()', [escape()]]]))), 'numeric key conversion')
        assertEq(failure(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [escape()]]])), throwingRuntime), 'lookup')
        // The read of a static function's length is part of lookup, even
        // though length is no admitted method name.
        failure(calledFunction(requiredFunction(['.', ['Object.is'], 'length', ['|()', [escape()]]])))
    },
    ordinaryArgumentsBeforeCallableValidation: () => {
        const receivers = /** @type {readonly Value[]} */ ([
            ['object', []], ['object', [[':', 'x', null]]], ['object', [[':', 'x', undefined]]],
            ['object', [[':', 'x', 0]]], ['object', [[':', 'x', false]]], ['object', [[':', 'x', '']]],
        ])
        for (const receiver of receivers) {
            assertEq(evaluate(calledFunction(requiredFunction(['.', receiver, 'x', ['|()', [escape()]]]))), 7)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['.', ['array', []], 'length', ['|()', [escape()]]]))), 7)
        const argument = id(0)
        const callable = simpleFunction([argument], ref(argument))
        const stop = id(0)
        for (const tag of /** @type {const} */ (['.', '?.'])) {
            const fn = requiredFunction([tag, ['object', [[':', 'x', callable]]], 'x', ['|()', [mixed(ref(stop), 9)]]], [stop])
            assertEq(evaluate(calledFunction(fn, [false])), 9)
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [mixed(false, 1)]]]))), 'bc')
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [mixed(true, 1)]]]))), 7)
        const earlier = /** @type {Value} */ (['.', ['object', []], 'x', ['|()', [failed('first argument'), escape()]]])
        assertEq(failure(calledFunction(requiredFunction(earlier))), 'first argument')
        const tail = /** @type {Value} */ (['.', ['object', []], 'x', ['|()', [escape(), failed('skipped argument tail')]]])
        assertEq(evaluate(calledFunction(requiredFunction(tail))), 7)
    },
    optionalMemberPresenceAndBareCalls: () => {
        for (const value of /** @type {readonly Value[]} */ ([null, undefined])) {
            const receiver = /** @type {Value} */ (['object', [[':', 'toString', value]]])
            assertEq(evaluate(calledFunction(requiredFunction(['.', receiver, 'toString', ['|?.()', [escape()]]]))), undefined)
            assertEq(evaluate(calledFunction(requiredFunction(['?.', receiver, 'toString', ['|?.()', [escape()]]]))), undefined)
            assertEq(evaluate(calledFunction(requiredFunction(['?.()', value, [escape()]]))), undefined)
        }
        for (const value of /** @type {readonly Value[]} */ ([0, false, ''])) {
            const receiver = /** @type {Value} */ (['object', [[':', 'toString', value]]])
            assertEq(evaluate(calledFunction(requiredFunction(['.', receiver, 'toString', ['|?.()', [escape()]]]))), 7)
            assertEq(evaluate(calledFunction(requiredFunction(['?.()', value, [escape()]]))), 7)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['.', ['object', []], 'missing', ['|?.()', [escape()]]]))), undefined)
        assertEq(evaluate(calledFunction(requiredFunction(['.', ['array', []], 'length', ['|?.()', [escape()]]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|?.()', [mixed(false, 1)]]]))), 'bc')
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|?.()', [mixed(true, 1)]]]))), 7)
        const argument = id(0)
        const callable = simpleFunction([argument], ref(argument))
        assertEq(evaluate(calledFunction(requiredFunction(['?.()', callable, [mixed(false, 9)]]))), 9)
        assertEq(evaluate(calledFunction(requiredFunction(['?.()', callable, [mixed(true, 9)]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['?.()', escape(11), [failed('skipped bare argument')]]))), 11)
    },
    runtimeGuardAndOwnShadowing: () => {
        for (const value of /** @type {readonly Exp[]} */ ([null, 0, false, ['{}', []], ['=>', 0, [], 99]])) {
            const runtime = runtimeReturning(value)
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|?.()', [escape()]]])), runtime), 7)
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [escape()]]])), runtime), 7)
            const shadowed = /** @type {Value} */ (['object', [[':', 'toString', undefined]]])
            assertEq(evaluate(calledFunction(requiredFunction(['.', shadowed, 'toString', ['|?.()', [escape()]]])), runtime), undefined)
        }
        for (const runtime of /** @type {readonly (Runtime | undefined)[]} */ ([undefined, ['{}', []], runtimeReturning(['undefined'])])) {
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|?.()', [escape()]]])), runtime), undefined)
            assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'startsWith', ['|()', [escape()]]])), runtime), 7)
        }
        const runtime = runtimeReturning(['=>', 1, [], ['arg', 0]])
        assertEq(evaluate(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|()', [mixed(false, 9)]]])), runtime), 9)
        assertEq(failure(calledFunction(requiredFunction(['.', 'abc', 'slice', ['|?.()', [escape()]]])), throwingRuntime), 'lookup')
        // An unadmitted missing name never asks the runtime provider.
        assertEq(evaluate(calledFunction(requiredFunction(['.', ['object', []], 'startsWith', ['|?.()', [escape()]]])), throwingRuntime), undefined)
    },
    continuedOptionalAndForcedBoundaries: () => {
        const skipped = /** @type {readonly Value[]} */ ([
            ['?.', null, 'x', ['|.', ['Number', escape('skipped key')], ['|()', [escape('skipped argument')]]]],
            ['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [escape('skipped argument')], ['|.', ['Number', escape('skipped continuation')]]]],
            ['?.()', null, [escape('skipped argument')], ['|.', ['Number', escape('skipped continuation')]]],
        ])
        for (const value of skipped) { assertEq(evaluate(calledFunction(requiredFunction(value))), undefined) }
        const forced = /** @type {readonly Value[]} */ ([
            ['?.', null, 'x', ['|()', [escape('skipped argument')], ['|!()', [escape('forced')]]]],
            ['.', ['object', [[':', 'x', null]]], 'x', ['|?.()', [escape('skipped argument')], ['|!()', [escape('forced')]]]],
            ['?.()', null, [escape('skipped argument')], ['|!()', [escape('forced')]]],
        ])
        for (const value of forced) { assertEq(evaluate(calledFunction(requiredFunction(value))), 'forced') }
        const live = /** @type {Value} */ (['.', 'abc', 'slice', ['|()', [mixed(false, 1)], ['|.', 'length', ['|()', [escape('later argument')]]]]])
        assertEq(evaluate(calledFunction(requiredFunction(live))), 'later argument')
        const laterKey = /** @type {Value} */ (['.', 'abc', 'slice', ['|()', [1], ['|.', ['Number', escape('continuation key')], ['|()', [failed('skipped continuation argument')]]]]])
        assertEq(evaluate(calledFunction(requiredFunction(laterKey))), 'continuation key')
    },
    memoCallerAndInitializerIdentity: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), initialized = id(0)
        const argument = id(0)
        const identity = simpleFunction([argument], ref(argument))
        for (const reached of /** @type {const} */ ([0, 1])) {
            const witness = collectingMemo(ref(selected), reached)
            const earlier = reached === 0 ? null : collectedMemo(ref(witness.results[0]))
            const payload = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller), 'returned']])
            const initializer = /** @type {Value} */ (['.', ['object', [[':', 'x', identity]]], 'x', ['|()', [mixed(ref(stop), ref(selected), payload)]]])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(initialized), earlier, ref(selected), ref(caller), 'normal']]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'], ['loop', witness], ['define', initialized, initializer, 'required'],
                ]),
            })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array && normal[0] instanceof Array && normal[0][0] instanceof Array)
            assertEq(normal[0], normal[2])
            assertEq(normal[1], reached === 0 ? null : normal[0])
            assertEq(normal[0][0], normal[0][1])
            assertEq(normal[0][0][0], normal[3])
            assertEq(normal[4], 'normal')
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
            assertEq(returned[3], 'returned')
        }
    },
    optionalSkippedMemoDemand: () => {
        const caller = id(0), observed = id(0), selected = id(0), output = id(0)
        const payload = /** @type {Value} */ (['array', [ref(caller), ref(caller)]])
        const receiver = /** @type {Value} */ (['if', ref(selected), result(['object', [[':', 'x', 0]]]), result(null)])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), 9]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', observed, failed('skipped memo demand'), 'lazy'],
                ['define', output, ['?.', receiver, ['Number', ['block', result(0, [['if', [], false, body(['return', target, ref(observed)]), body(['yield', []])]])]], ['|()', [escape(payload)]]], 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [false])), [undefined, 9])
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array)
        assertEq(returned[0], returned[1])
        assertStructurallySame(returned, [[4], [4]])
    },
    iterationClosuresAndFreshInvocations: () => {
        const local = id(0), count = id(0), output = id(0), captured = id(0), made = id(0)
        const argument = id(0)
        const identity = simpleFunction([argument], ref(argument))
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), left = id(0), right = id(0)
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
                    ['define', made, ['.', ['object', [[':', 'x', identity]]], 'x', ['|()', [mixed(['===', ref(count), 1], 0, getter)]]], 'required'],
                ]), body(['yield', []])],
            ]),
        })
        const factory = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, null], [['loop', loop]]),
        })
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
    identityAndOwnerBoundaries: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['.', 'abc', 'slice', ['|()', [1]]], ['?.', null, 'x'], ['?.()', null, [1]],
            ['.', ['object', []], 'x', ['|?.()', [1], ['|!()', [2]]]],
        ])) {
            const source = requiredFunction(value).body
            assertEq(liftReturns(source, target), source)
        }
        const nested = simpleFunction([], 11)
        assertEq(evaluate(calledFunction(requiredFunction(['.', ['object', [[':', 'x', nested]]], 'x', ['|()', [mixed(false, 1)]]]))), 11)
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(captured), ref(rest), ref(self)]]], [
                ['define', output, ['.', 'abc', 'slice', ['|()', [mixed(ref(stop), ref(argument), ['array', [ref(captured), ref(captured), ref(rest)]])]]], 'required'],
            ]),
        })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 5; index += 1) {
            graph = fromFast(assertOk(toFast(graph)))
            graphs = [...graphs, graph]
        }
        assertStructurallySame(flat(graphs[3]), flat(graphs[4]))
        assertStructurallySame(flat(graphs[4]), flat(graphs[5]))
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            const returned = evaluate(['()', current, [true, 1, 8, 9]])
            assert(returned instanceof Array)
            assertEq(returned[0], returned[1])
            assertStructurallySame(returned, [[4], [4], [8, 9]])
            // Observe self inside the graph; toData deliberately refuses a
            // public result containing a represented function.
            const called = /** @type {Exp} */ (['()', current, [false, 1, 8, 9]])
            const observed = /** @type {Exp} */ (['[]', [['.', called, 0], ['.', called, 1], ['.', called, 2], ['===', ['.', called, 3], current]]])
            assertStructurallySame(evaluate(observed), ['bc', [4], [8, 9], true])
        }
    },
    throw: {
        foreignMemberArgument: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const wrong = /** @type {Value} */ (['block', body(['return', foreign, 7])])
            fromFast(result(['function', requiredFunction(['.', ['object', []], 'x', ['|()', [wrong]]])]))
        },
        foreignOptionalArgument: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const wrong = /** @type {Value} */ (['block', body(['return', foreign, 7])])
            const argument = id(0)
            fromFast(result(['function', requiredFunction(['?.()', ref(argument), [wrong]], [argument])]))
        },
    },
})
