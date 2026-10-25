/**
 * @import { BindingId, Function as FastFunction, Loop, Value } from '../../../../js/ast/types.ts'
 * @import { Exp } from '../../../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { fromFast } from '../../module.f.mjs'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { memo } from '../../../memo/module.f.mjs'
import { toFast } from '../../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _evaluate as evaluate, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../../proof.f.mjs'

/** @type {(value: Value, parameters?: readonly BindingId[]) => FastFunction} */
const requiredFunction = (value, parameters = []) => {
    const output = id(0)
    return { target, parameters, rest: null, self: null, captures: [],
        body: body(['return', target, ref(output)], [['define', output, value, 'required']]) }
}

/** @type {(kind: 'block' | 'if' | '?:', condition: Value, normal: readonly Value[], returned?: Value) => Value} */
const returningValue = (kind, condition, normal, returned = 7) => kind === 'if'
    ? ['if', condition, body(['return', target, returned]), body(['yield', normal])]
    : kind === '?:' ? ['?:', condition, ['block', body(['return', target, returned])], ['block', body(['yield', normal])]]
        : ['block', body(['yield', normal], [['if', [], condition, body(['return', target, returned]), body(['yield', []])]])]

/** @type {(value?: Value) => Value} */
const escape = (value = 7) => ['block', body(['return', target, value])]

/** @type {Value} */
const constantFunction = ['function', {
    target: { kind: 'function', index: 0 }, parameters: [id(0)], rest: null, self: null, captures: [],
    body: body(['yield', [0]]),
}]

export const proof = /** @type {const} */ ({
    requiredInitializerOwningReturns: () => {
        const output = id(0)
        const direct = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [['define', output, escape(), 'required']]),
        })
        assertEq(evaluate(calledFunction(direct)), 7)
        const nested = /** @type {FastFunction} */ ({ ...direct, body: body(['return', target, 7], [
            ['define', output, ['block', body(['yield', [1]], [
                ['if', [], true, body(['return', target, 9]), body(['yield', []])],
            ])], 'required'],
        ]) })
        assertEq(evaluate(calledFunction(nested)), 9)
    },
    mixedInitializerPackingAndIdentity: () => {
        const choice = id(0), output = id(0), suffix = id(0)
        const cases = /** @type {readonly (readonly [readonly Value[], unknown])[]} */ ([
            [[], []], [[['array', [4]]], [4]], [[1, 2, 3], [1, 2, 3]],
        ])
        for (const kind of /** @type {const} */ (['block', 'if', '?:'])) {
            for (const [normal, expected] of cases) {
                const fn = /** @type {FastFunction} */ ({
                    target, parameters: [choice], rest: null, self: null, captures: [],
                    body: body(['return', target, ['array', [ref(output), ref(output), ref(suffix), ref(suffix)]]], [
                        ['define', output, returningValue(kind, ref(choice), normal), 'required'],
                        ['define', suffix, ['array', [ref(output)]], 'required'],
                    ]),
                })
                assertEq(evaluate(calledFunction(fn, [true])), 7)
                const value = evaluate(calledFunction(fn, [false]))
                assert(value instanceof Array && value[2] instanceof Array)
                assertStructurallySame(value[0], expected)
                assertEq(value[0], value[1])
                assertEq(value[2], value[3])
                assertEq(value[2][0], value[0])
            }
        }
    },
    owningReturnPayloadRegions: () => {
        const choice = id(0)
        const cases = /** @type {readonly (readonly [readonly Value[], unknown])[]} */ ([
            [[], []], [[9], 9], [[1, 2, 3], [1, 2, 3]],
        ])
        for (const kind of /** @type {const} */ (['block', 'if', '?:'])) {
            for (const [normal, expected] of cases) {
                const fn = /** @type {FastFunction} */ ({
                    target, parameters: [choice], rest: null, self: null, captures: [],
                    body: body(['return', target, returningValue(kind, ref(choice), normal, ['array', ['returned', 8]])]),
                })
                assertStructurallySame(evaluate(calledFunction(fn, [true])), ['returned', 8])
                assertStructurallySame(evaluate(calledFunction(fn, [false])), expected)
            }
        }
    },
    nestedRegionsChainsAndSkippedArms: () => {
        const choice = id(0), failed = id(0)
        const chain = /** @type {Value} */ (['block', result(['block', result(returningValue('?:', ref(choice), [9]))])])
        assertEq(evaluate(calledFunction(requiredFunction(chain, [choice]), [true])), 7)
        assertEq(evaluate(calledFunction(requiredFunction(chain, [choice]), [false])), 9)
        const nested = /** @type {Value} */ (['block', body(['yield', [9]], [
            ['block', [], body(['yield', []], [
                ['if', [], ref(choice), body(['yield', []], [
                    ['block', [], body(['return', target, 7])],
                    ['define', failed, ['block', body(['throw', 'unreachable nested arm'])], 'required'],
                ]), body(['yield', []])],
            ])],
        ])])
        assertEq(evaluate(calledFunction(requiredFunction(nested, [choice]), [true])), 7)
        assertEq(evaluate(calledFunction(requiredFunction(nested, [choice]), [false])), 9)
        const conditional = /** @type {Value} */ (['if', ref(choice), body(['return', target, 7]), body(['yield', [9]], [
            ['define', failed, ['block', body(['throw', 'selected other arm'])], 'required'],
        ])])
        assertEq(evaluate(calledFunction(requiredFunction(conditional, [choice]), [true])), 7)
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(requiredFunction(conditional, [choice]), [false]))))({ args: [] })), 'selected other arm')
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const nestedOutput = id(0), outerOutput = id(0)
        const ordinary = /** @type {FastFunction} */ ({
            target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', nestedTarget, 12], [['define', nestedOutput, ['block', body(['return', nestedTarget, 11])], 'required']]),
        })
        const outer = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(outerOutput), 9]]], [['define', outerOutput, ['()', ['function', ordinary], []], 'required']]),
        })
        assertStructurallySame(evaluate(calledFunction(outer)), [11, 9])
    },
    requiredPrefixesAndUnreachableSuffixes: () => {
        const outside = id(0), inside = id(0), output = id(0), suffix = id(0)
        for (const failure of /** @type {const} */ (['none', 'outside', 'inside'])) {
            const initializer = /** @type {Value} */ (['block', body(['return', target, 7], [
                ['define', inside, failure === 'inside' ? ['block', body(['throw', 'inside prefix'])] : ['array', [1]], 'required'],
            ])])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [
                    ['define', outside, failure === 'outside' ? ['block', body(['throw', 'outside prefix'])] : ['array', [0]], 'required'],
                    ['define', output, initializer, 'required'],
                    ['define', suffix, ['block', body(['throw', 'unreachable initializer suffix'])], 'required'],
                ]),
            })
            const graph = calledFunction(fn)
            if (failure === 'none') { assertEq(evaluate(graph), 7) }
            else { assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), `${failure} prefix`) }
        }
    },
    callerRecipeMemoAcrossNestedOperandLoops: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), count = id(0), saved = id(0), output = id(0), initialized = id(0), innerOutput = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerOutput],
            body: body(['break', innerTarget, [ref(selected)]], [
                ['if', [], ref(stop), body(['return', target, ['array', [ref(selected), ref(selected), ref(caller)]]]), body(['yield', []])],
            ]),
        })
        const initializer = /** @type {Value} */ (['block', result(['array', [ref(innerOutput), ref(selected)]], [['loop', inner]])])
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['break', outerTarget, [ref(saved)]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1], ['array', [ref(saved), ref(initialized)]]]], [
                    ['define', initialized, initializer, 'required'],
                ]), body(['yield', []])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [collectedMemo(ref(output), 1), collectedMemo(ref(output)), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                    ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'], ['loop', outer],
            ]),
        })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[1] instanceof Array && normal[2] instanceof Array && normal[2][0] instanceof Array)
        assertEq(normal[0][0], normal[2])
        assertEq(normal[0][1], normal[2])
        assertEq(normal[1][0], normal[2])
        assertEq(normal[1][1], normal[2])
        assertEq(normal[2][0], normal[2][1])
        assertEq(normal[2][0][0], normal[3])
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
        assertEq(returned[0], returned[1])
        assertEq(returned[0][0], returned[0][1])
        assertEq(returned[0][0][0], returned[2])
    },
    iterationLocalReturnedFunctionCaptures: () => {
        const local = id(0), captured = id(0), count = id(0), output = id(0), initialized = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), second = id(0)
        const userTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {FastFunction} */ ({
            target: userTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', userTarget, ['array', [ref(captured), ref(captured)]]]),
        })
        const inner = collectingMemo(ref(local), 2)
        const initializer = /** @type {Value} */ (['block', body(['yield', [['array', [collectedMemo(ref(inner.results[0])), ref(local)]]]], [
            ['loop', inner], ['if', [], ['===', ref(count), 1], body(['return', target, ['function', getter]]), body(['yield', []])],
        ])])
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['define', initialized, initializer, 'required'],
                ]), body(['yield', []])],
            ]),
        })
        const factory = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, null], [['loop', outer]]),
        })
        const value = evaluate(fromFast(result(['array', [ref(first), ref(second)]], [
            ['define', factoryBinding, ['function', factory], 'required'],
            ['define', firstFn, ['()', ref(factoryBinding), []], 'required'], ['define', secondFn, ['()', ref(factoryBinding), []], 'required'],
            ['define', first, ['()', ref(firstFn), []], 'required'], ['define', second, ['()', ref(secondFn), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    functionMetadataAndRoundTrip: () => {
        const again = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0)
        const initializer = returningValue('block', ref(again), [['array', [ref(captured), ref(argument), ref(rest)]]],
            ['()', ref(self), [false, ['+', ref(argument), 1], 99]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [again, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(captured), ref(rest)]]], [['define', output, initializer, 'required']]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 2)
        assertEq(graph[2].length, 1)
        assert(assertOk(identityAnalysis(graph)).nodes.some(node => node[0] === 'self'))
        const value = evaluate(calledFunction(fn, [false, 5, 7, 8]))
        assert(value instanceof Array && value[0] instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0][0], value[2])
        assertEq(value[0][2], value[3])
        assertStructurallySame(value[0], [[4], 5, [7, 8]])
        const recurred = evaluate(calledFunction(fn, [true, 5]))
        assert(recurred instanceof Array)
        assertStructurallySame(recurred[0], [[4], 6, [99]])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        const call = /** @type {Exp} */ (['()', third, [false, 5, 7, 8]])
        const repeated = evaluate(call)
        assert(repeated instanceof Array)
        assertEq(repeated[0], repeated[1])
    },
    throw: {
        standaloneReturn: () => {
            const output = id(0)
            fromFast(result(ref(output), [['define', output, escape(), 'required']]))
        },
        foreignOwner: () => {
            const foreign = /** @type {const} */ ({ ...target })
            calledFunction(requiredFunction(['block', body(['return', foreign, 7])]))
        },
        lazyInitializer: () => {
            const output = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['define', output, escape(), 'lazy']]),
            })
            calledFunction(fn)
        },
        conditionalTestReturn: () => calledFunction(requiredFunction(['if', escape(), body(['return', target, 9]), result(2)])),
        manyYieldOperandReturn: () => calledFunction(requiredFunction(['block', body(['yield', [escape(), 0]], [
            ['if', [], false, body(['return', target, 9]), body(['yield', []])],
        ])])),
        callArgumentReturn: () => calledFunction(requiredFunction(['()', constantFunction, [escape()]])),
        binaryOperandReturn: () => calledFunction(requiredFunction(['+', 1, escape()])),
        memberOperandReturn: () => calledFunction(requiredFunction(['.', ['object', [[':', 'x', 1]]], ['Number', escape()]])),
        optionalMemberReturn: () => calledFunction(requiredFunction(['?.', null, ['Number', escape()]])),
        optionalCallReturn: () => calledFunction(requiredFunction(['?.()', constantFunction, [escape()]])),
        spreadOperandReturn: () => calledFunction(requiredFunction(['array', [['...', escape(['array', [7]])]]])),
        functionCaptureReturn: () => {
            const captured = id(0)
            const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(requiredFunction(['function', {
                target: nestedTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: escape() }],
                body: body(['return', nestedTarget, ref(captured)]),
            }]))
        },
        nestedFunctionForeignOwner: () => {
            const output = id(0)
            const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
            const nested = /** @type {FastFunction} */ ({
                target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', nestedTarget, 9], [['define', output, escape(), 'required']]),
            })
            calledFunction(requiredFunction(['()', ['function', nested], []]))
        },
        sharedLoopAcrossOperandBoundary: () => {
            const selected = id(0), output = id(0), initialized = id(0)
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const shared = /** @type {Loop} */ ({
                target: innerTarget, parameters: [], initial: [], results: [], body: body(['break', outerTarget, [7]]),
            })
            const operand = /** @type {Value} */ (['block', result(0, [
                ['if', [], false, body(['return', target, 5]), body(['yield', []])], ['loop', shared],
            ])])
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [output],
                body: body(['break', outerTarget, [9]], [
                    ['if', [], ref(selected), body(['yield', []], [['loop', shared]]), body(['yield', []], [['define', initialized, operand, 'required']])],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', outer]]),
            })
            calledFunction(fn, [false])
        },
    },
})
