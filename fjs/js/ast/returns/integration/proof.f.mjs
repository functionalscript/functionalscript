/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../types.ts'
 * @import { Exp } from '../../../../edag/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { logicalValue } from '../../sugar/logical/module.f.js'
import { fromFast } from '../../../../edag/from_fast/module.f.mjs'
import { identityAnalysis } from '../../../../edag/analysis/module.f.mjs'
import { memo } from '../../../../edag/memo/module.f.mjs'
import { toFast } from '../../../../edag/to_fast/module.f.mjs'
import { evaluate as evaluateWithRuntime } from '../../../../edag/from_fast/member_returns/proof.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _evaluate as evaluate, _collectingMemo as collectingMemo, _collectedMemo as collectedMemo } from '../../../../edag/from_fast/proof.f.mjs'

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

/** Source logical tags are deliberately not normalized FAST operators. @type {(tag: '&&' | '||' | '??', left: Value) => Value} */
const rawLogical = (tag, left) => /** @type {Value} */ (/** @type {unknown} */ ([tag, left, escape()]))

/** @type {Value} */
const constantFunction = ['function', {
    target: { kind: 'function', index: 0 }, parameters: [id(0)], rest: null, self: null, captures: [],
    body: body(['yield', [0]]),
}]

/** @type {(parameters: readonly BindingId[], value: Value, rest?: BindingId | null) => Value} */
const simpleFunction = (parameters, value, rest = null) => {
    const functionTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target: functionTarget, parameters, rest, self: null, captures: [], body: body(['return', functionTarget, value]) }]
}

/** @type {(message: string) => Value} */
const failed = message => ['block', body(['throw', message])]

/** @type {(kind: 'array' | ',' | 'yield', values: readonly Value[]) => Value} */
const sequenceValue = (kind, values) => kind === 'yield' ? ['block', body(['yield', values])]
    : kind === 'array' ? ['array', values] : [',', values]

/** @type {(toString: Value, valueOf: Value) => Value} */
const keyMethods = (toString, valueOf) => ['object', [[':', 'toString', toString], [':', 'valueOf', valueOf]]]

export const proof = /** @type {const} */ ({
    lazyInitializerReturnsAtDemand: () => {
        const output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['define', output, escape(), 'lazy']]),
        })
        assertEq(evaluate(calledFunction(fn)), 7)
    },
    wrappedMemberCalleeReturns: () => {
        const member = /** @type {Value} */ (['.', ['object', [[':', 'f', constantFunction]]], 'f'])
        for (const callee of /** @type {readonly Value[]} */ ([
            [',', [0, member]], ['block', result(member)], ['block', result(['?.', null, 'f'])],
        ])) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
        }
    },
    nativeCalleeReturns: () => {
        const runtime = /** @type {const} */ (['{}', [[':', 'static', ['=>', 1, [], ['=>', 0, [], ['throw', 'skipped native invocation']]]]]])
        for (const callee of /** @type {readonly Value[]} */ ([
            ['Number.isInteger'], [',', [0, ['Number.isInteger']]], ['block', result(['Number.isInteger'])],
        ])) {
            assertEq(evaluateWithRuntime(calledFunction(requiredFunction(['()', callee, [escape()]])), runtime), 7)
        }
    },
    spreadCompletions: () => {
        assertEq(evaluate(calledFunction(requiredFunction(['array', [['...', ['array', [1]]], escape()]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['instanceof', ['array', [['...', ['array', [1]]], escape()]], 'Array']))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['()', constantFunction, [['...', ['array', [1, 2]]], escape()]]))), 7)
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['array', [['...', escape(['array', [7]])]]]))), [7])
        assertEq(evaluate(calledFunction(requiredFunction(['object', [
            ['...', ['object', [[':', 'x', 1]]]], [':', escape(), 2],
        ]]))), 7)
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['object', [['...', escape(['object', []])]]]))), {})
    },
    memberReturnsPreviouslyRefused: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['instanceof', ['.', ['object', [[':', 'x', 1]]], ['Number', escape()]], 'Array'],
            ['.', ['object', [[':', 'x', 1]]], ['Number', escape()]],
            ['?.()', constantFunction, [escape()]],
            ['()', ['.', ['object', [[':', 'f', constantFunction]]], 'f'], [escape()]],
            ['()', ['()', ['.', ['object', [[':', 'f', constantFunction]]], 'f'], []], [escape()]],
            ['()', ['.', ['object', [[':', 'f', constantFunction]]], 'f', ['|()', []]], [escape()]],
        ])) { assertEq(evaluate(calledFunction(requiredFunction(value))), 7) }
        assertEq(evaluate(calledFunction(requiredFunction(['?.', null, ['Number', escape()]]))), undefined)
    },
    statementYieldPreviouslyRefusedReturn: () => {
        const first = id(0), second = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second)]]], [
                ['block', [first, second], body(['yield', [escape(), 0]])],
            ]),
        })
        assertEq(evaluate(calledFunction(fn)), 7)
    },
    statementYieldResultBindings: () => {
        const stop = id(0), choice = id(0), allocation = id(0)
        for (const kind of /** @type {const} */ (['block', 'if'])) {
            for (const length of /** @type {const} */ ([0, 1, 3])) {
                const bindings = Array.from({ length }, () => id(0))
                const returned = /** @type {Value} */ (['array', ['returned', ref(allocation)]])
                const values = bindings.map((_, index) => index === length - 1
                    ? returningValue('if', ref(stop), [ref(allocation)], returned) : ref(allocation))
                const region = /** @type {Block} */ (body(['yield', values], length === 0
                    ? [['if', [], ref(stop), body(['return', target, returned]), body(['yield', []])]] : []))
                const statement = /** @type {Statement} */ (kind === 'block' ? ['block', bindings, region]
                    : ['if', bindings, ref(choice), region, region])
                const fn = /** @type {FastFunction} */ ({
                    target, parameters: [stop, choice], rest: null, self: null, captures: [],
                    body: body(['return', target, ['array', bindings.map(ref)]], [
                        ['define', allocation, ['array', [4]], 'required'], statement,
                    ]),
                })
                for (const selected of /** @type {const} */ ([false, true])) {
                    const normal = evaluate(calledFunction(fn, [false, selected]))
                    assert(normal instanceof Array)
                    assertStructurallySame(normal, Array.from({ length }, () => [4]))
                    for (const value of normal) { assertEq(value, normal[0]) }
                    assertStructurallySame(evaluate(calledFunction(fn, [true, selected])), ['returned', [4]])
                }
            }
        }
        const first = id(0), second = id(0), alias = id(0)
        const swap = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second), ref(alias)]]], [
                ['define', first, ['array', [1]], 'required'], ['define', second, ['array', [2]], 'required'],
                ['block', [first, second, alias], body(['yield', [ref(second), returningValue('if', false, [ref(first)]), ref(second)]])],
            ]),
        })
        const value = evaluate(calledFunction(swap))
        assert(value instanceof Array)
        assertStructurallySame(value, [[2], [1], [2]])
        assertEq(value[0], value[2])
        assert(value[0] !== value[1])
    },
    statementYieldRequiredAndSkippedWork: () => {
        const first = id(0), second = id(0), third = id(0), dead = id(0)
        for (const kind of /** @type {const} */ (['block', 'if'])) {
            const region = body(['yield', [failed('statement yield prefix'), escape()]])
            const statement = /** @type {Statement} */ (kind === 'block' ? ['block', [first, second], region]
                : ['if', [first, second], true, region, body(['yield', [1, 2]])])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, 9], [statement]),
            })
            assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn))))({ args: [] })), 'statement yield prefix')
            const terminal = body(['yield', [1, escape(['array', ['returned']]), failed('skipped yield tail')]])
            const selected = /** @type {Statement} */ (kind === 'block' ? ['block', [first, second, third], terminal]
                : ['if', [first, second, third], true, terminal, body(['yield', [failed('unselected yield arm'), 2, 3]])])
            const skipped = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, ref(second)], [
                selected, ['define', dead, failed('skipped statement suffix'), 'required'],
            ]) })
            assertStructurallySame(evaluate(calledFunction(skipped)), ['returned'])
        }
    },
    statementYieldMemoIdentity: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), first = id(0), second = id(0)
        for (const reached of /** @type {const} */ ([0, 1])) {
            const witness = collectingMemo(ref(selected), reached)
            const earlier = reached === 0 ? null : collectedMemo(ref(witness.results[0]))
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(first), ref(second), ref(selected), ref(caller), earlier]]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'], ['loop', witness],
                    ['if', [first, second], true, body(['yield', [ref(selected),
                        returningValue('if', ref(stop), [ref(selected)], ['array', [ref(selected), ref(selected), ref(caller)]])]]),
                    body(['yield', [failed('unselected memo yield'), null]])],
                ]),
            })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array && normal[0] instanceof Array && normal[0][0] instanceof Array)
            assertEq(normal[0], normal[1])
            assertEq(normal[0], normal[2])
            assertEq(normal[0][0], normal[0][1])
            assertEq(normal[0][0][0], normal[3])
            assertEq(normal[4], reached === 0 ? null : normal[0])
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
        }
    },
    statementYieldIterationClosureLifetimes: () => {
        const local = id(0), count = id(0), output = id(0), first = id(0), second = id(0), captured = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), left = id(0), right = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const witness = collectingMemo(ref(local), 2)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', witness],
                    ['block', [first, second], body(['yield', [ref(local), returningValue('if', ['===', ref(count), 1], [ref(local)], getter)]])],
                ]), body(['yield', []])],
            ]),
        })
        const factory = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, null], [['loop', outer]]),
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
    statementYieldMetadataAndRoundTrip: () => {
        const count = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), first = id(0), second = id(0), third = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(first), ref(second), ref(third), ref(captured), ref(rest)]]], [
                ['block', [first, second, third], body(['yield', [ref(captured),
                    returningValue('block', ['>', ref(count), 0], [ref(argument)],
                        ['()', ref(self), [['-', ref(count), 1], ['+', ref(argument), 1], 99]]), ref(rest)]])],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        const secondGraph = fromFast(assertOk(toFast(graph)))
        const thirdGraph = fromFast(assertOk(toFast(secondGraph)))
        const fourthGraph = fromFast(assertOk(toFast(thirdGraph)))
        const fifthGraph = fromFast(assertOk(toFast(fourthGraph)))
        const before = assertOk(identityAnalysis(fourthGraph)), after = assertOk(identityAnalysis(fifthGraph))
        assertStructurallySame(
            { root: before.root, nodes: before.nodes, scope: before.scope, shared: before.shared },
            { root: after.root, nodes: after.nodes, scope: after.scope, shared: after.shared },
        )
        for (const current of /** @type {readonly Exp[]} */ ([graph, secondGraph, thirdGraph, fourthGraph, fifthGraph])) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            for (const depth of /** @type {const} */ ([0, 1])) {
                const call = /** @type {Exp} */ (['()', current, depth === 0 ? [0, 5, 7, 8] : [1, 5]])
                const value = evaluate(call)
                assert(value instanceof Array)
                assertEq(value[0], value[3])
                assertEq(value[2], value[4])
                assertStructurallySame(value, depth === 0 ? [[4], 5, [7, 8], [4], [7, 8]] : [[4], 6, [99], [4], [99]])
            }
        }
    },
    instanceofPreviouslyRefusedReturn: () => {
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['instanceof', escape(['array', []]), 'Array']))), [])
    },
    instanceofNormalAndMixedResults: () => {
        const stop = id(0)
        const cases = /** @type {readonly (readonly [Value, boolean])[]} */ ([
            [['array', []], true], [['array', [4]], true], [['object', []], false],
            [null, false], [1, false], [undefined, false], [simpleFunction([], 0), false],
        ])
        for (const [value, expected] of cases) {
            const fn = requiredFunction(['instanceof', returningValue('if', ref(stop), [value]), 'Array'], [stop])
            assertEq(evaluate(calledFunction(fn, [false])), expected)
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
    },
    instanceofReturnIdentityAndRequiredWork: () => {
        const original = id(0), captured = id(0), returned = id(0), output = id(0), dead = id(0), prefix = id(0)
        const consumer = simpleFunction([], failed('skipped instanceof consumer'))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(original) }],
            body: body(['return', target, 9], [
                ['define', output, ['()', consumer, [['instanceof', escape(ref(captured)), 'Array']]], 'required'],
                ['define', dead, failed('skipped instanceof suffix'), 'required'],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [ref(returned), ref(original)]], [
            ['define', original, ['array', [4]], 'required'], ['define', returned, ['()', ['function', fn], []], 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assertEq(value[0], value[1])
        const lhs = /** @type {Value} */ (['block', body(['return', target, 7], [['define', prefix, failed('instanceof prefix'), 'required']])])
        const graph = calledFunction(requiredFunction(['instanceof', lhs, 'Array']))
        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'instanceof prefix')
    },
    instanceofConditionalAndCalleePaths: () => {
        const stop = id(0), choice = id(0)
        const normal = /** @type {Value} */ (['if', ref(choice), result(['array', []]), result(['object', []])])
        const lhs = returningValue('if', ref(stop), [normal], ['array', ['lhs return']])
        const fn = requiredFunction(['?:', ['instanceof', lhs, 'Array'], 'array', 'other'], [stop, choice])
        assertEq(evaluate(calledFunction(fn, [false, true])), 'array')
        assertEq(evaluate(calledFunction(fn, [false, false])), 'other')
        assertStructurallySame(evaluate(calledFunction(fn, [true, false])), ['lhs return'])
        for (const value of /** @type {readonly Value[]} */ ([['array', []], ['object', []]])) {
            const callee = /** @type {Value} */ (['instanceof', value, 'Array'])
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
            const graph = calledFunction(requiredFunction(['()', callee, [2]]))
            assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
        }
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['instanceof', escape(), 'Array'], [failed('skipped instanceof argument')]]))), 7)
    },
    instanceofMemoAndIterationLifetimes: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), observed = id(0), initialized = id(0)
        for (const reached of /** @type {const} */ ([0, 1])) {
            const witness = collectingMemo(ref(selected), reached)
            const earlier = reached === 0 ? null : collectedMemo(ref(witness.results[0]))
            const lhs = /** @type {Value} */ (['block', result(returningValue('if', ref(stop), [ref(observed)],
                ['array', [ref(observed), ref(selected), ref(caller)]]), [['define', observed, ref(selected), 'required']])])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(initialized), earlier, ref(selected), ref(caller)]]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'], ['loop', witness], ['define', initialized, ['instanceof', lhs, 'Array'], 'required'],
                ]),
            })
            const normalValue = evaluate(calledFunction(fn, [false]))
            assert(normalValue instanceof Array && normalValue[2] instanceof Array && normalValue[2][0] instanceof Array)
            assertEq(normalValue[0], true)
            assertEq(normalValue[1], reached === 0 ? null : normalValue[2])
            assertEq(normalValue[2][0], normalValue[2][1])
            assertEq(normalValue[2][0][0], normalValue[3])
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
        }
        const local = id(0), localRecipe = id(0), nested = id(0), captured = id(0), count = id(0), output = id(0), made = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), second = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(localRecipe) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const inner = collectingMemo(ref(localRecipe), 2)
        const lhs = /** @type {Value} */ (['block', body(['yield', [ref(localRecipe)]], [
            ['loop', inner], ['if', [], ['===', ref(count), 1], body(['return', target, getter]), body(['yield', []])],
        ])])
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'],
                    ['define', localRecipe, ['block', result(['array', [ref(nested), ref(nested)]], [
                        ['define', nested, ['array', [ref(local)]], 'lazy'],
                    ])], 'lazy'], ['define', made, ['instanceof', lhs, 'Array'], 'required'],
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
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        const left = value[0][0], right = value[1][0]
        assert(left instanceof Array && right instanceof Array && left[0] instanceof Array && right[0] instanceof Array)
        assertEq(left[0], left[1])
        assertEq(right[0], right[1])
        assertStructurallySame(left[0][0], [1])
        assertStructurallySame(right[0][0], [1])
        assert(left !== right && left[0] !== right[0] && left[0][0] !== right[0][0])
    },
    instanceofMetadataAndRoundTrip: () => {
        const count = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), payload = id(0), output = id(0)
        const lhs = returningValue('block', ['>', ref(count), 0], [ref(payload)],
            ['()', ref(self), [['-', ref(count), 1], ['+', ref(argument), 1], 99]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(payload), ref(payload), ref(captured), ref(rest)]]], [
                ['define', payload, ['array', [ref(captured), ref(argument), ref(rest)]], 'required'],
                ['define', output, ['instanceof', lhs, 'Array'], 'required'],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        const fifth = fromFast(assertOk(toFast(fourth)))
        const before = assertOk(identityAnalysis(fourth)), after = assertOk(identityAnalysis(fifth))
        assertStructurallySame(
            { root: before.root, nodes: before.nodes, scope: before.scope, shared: before.shared },
            { root: after.root, nodes: after.nodes, scope: after.scope, shared: after.shared },
        )
        for (const current of /** @type {readonly Exp[]} */ ([graph, second, third, fourth, fifth])) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            for (const depth of /** @type {const} */ ([0, 1])) {
                const call = /** @type {Exp} */ (['()', current, depth === 0 ? [0, 5, 7, 8] : [1, 5]])
                const value = evaluate(call)
                assert(value instanceof Array && value[1] instanceof Array)
                assertEq(value[0], true)
                assertEq(value[1], value[2])
                assertEq(value[1][0], value[3])
                assertEq(value[1][2], value[4])
                assertStructurallySame(value[1], depth === 0 ? [[4], 5, [7, 8]] : [[4], 6, [99]])
            }
        }
    },
    objectPreviouslyRefusedReturns: () => {
        assertEq(evaluate(calledFunction(requiredFunction(['object', [[':', escape(), 1]]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['object', [[':', 'x', escape()]]]))), 7)
    },
    objectPrimitiveAndMethodKeys: () => {
        const stop = id(0)
        const primitives = /** @type {readonly (readonly [Value, string])[]} */ ([
            [undefined, 'undefined'], [null, 'null'], [false, 'false'], [true, 'true'],
            [0, '0'], [-0, '0'], [11, '11'], [1.5, '1.5'], [NaN, 'NaN'],
            [Infinity, 'Infinity'], [-Infinity, '-Infinity'], [7n, '7'], ['', ''], ['key', 'key'],
            [['array', [1, null, 3]], '1,,3'], [['object', []], '[object Object]'],
        ])
        const skipped = simpleFunction([], failed('unused coercion method'))
        const methods = /** @type {readonly (readonly [Value, string])[]} */ ([
            [keyMethods(simpleFunction([], 'alpha'), skipped), 'alpha'],
            [keyMethods(simpleFunction([], ['object', []]), simpleFunction([], 'beta')), 'beta'],
            [keyMethods(0, simpleFunction([], 9n)), '9'],
            [keyMethods(simpleFunction([], undefined), skipped), 'undefined'],
            [['object', [[':', 'valueOf', skipped]]], '[object Object]'],
        ])
        for (const [key, expected] of [...primitives, ...methods]) {
            const fn = requiredFunction(['object', [[':', key, returningValue('if', ref(stop), [9])]]], [stop])
            const value = evaluate(calledFunction(fn, [false]))
            assert(value !== null && typeof value === 'object' && !(value instanceof Array))
            assertStructurallySame(Object.entries(value), [[expected, 9]])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
        }
    },
    objectRequiredKeyConversionAndValueOrder: () => {
        const cases = /** @type {readonly (readonly [Value, string])[]} */ ([
            [['object', [[':', failed('key expression'), escape()]]], 'key expression'],
            [['object', [[':', keyMethods(simpleFunction([], failed('key conversion')), simpleFunction([], 0)), escape()]]], 'key conversion'],
            [['object', [[':', 'duplicate', failed('earlier property value')], [':', 'duplicate', escape()]]], 'earlier property value'],
            [['object', [
                [':', keyMethods(simpleFunction([], failed('earlier key conversion')), simpleFunction([], 0)), 1],
                [':', escape(), 2],
            ]], 'earlier key conversion'],
        ])
        for (const [value, message] of cases) {
            const graph = calledFunction(requiredFunction(value))
            assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), message)
        }
        const exhausted = keyMethods(simpleFunction([], ['object', []]), simpleFunction([], ['array', []]))
        const graph = calledFunction(requiredFunction(['object', [[':', exhausted, escape()]]]))
        assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
    },
    objectReturnsSkipConversionAndRemainingWork: () => {
        const original = id(0), captured = id(0), output = id(0), returned = id(0), dead = id(0)
        const payload = /** @type {Value} */ (['object', [
            [':', 'marker', 41], [':', 'toString', simpleFunction([], failed('skipped key conversion'))],
        ]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(original) }],
            body: body(['return', target, 9], [
                ['define', output, ['object', [
                    [':', escape(ref(captured)), failed('skipped property value')],
                    [':', failed('skipped later key'), failed('skipped later value')],
                ]], 'required'], ['define', dead, failed('skipped object suffix'), 'required'],
            ]),
        })
        const value = evaluate(fromFast(result(['array', [['===', ref(returned), ref(original)], ['.', ref(returned), 'marker']]], [
            ['define', original, payload, 'required'], ['define', returned, ['()', ['function', fn], []], 'required'],
        ])))
        assertStructurallySame(value, [true, 41])
        const initializer = /** @type {Value} */ (['object', [
            [':', 'first', escape()], [':', failed('skipped entry key'), failed('skipped entry value')],
        ]])
        const source = requiredFunction(initializer)
        const skipped = /** @type {FastFunction} */ ({ ...source, body: { ...source.body, statements: [
            ...source.body.statements, ['define', dead, failed('skipped value-return suffix'), 'required'],
        ] } })
        assertEq(evaluate(calledFunction(skipped)), 7)
    },
    objectDuplicatesEnumerationAndAliases: () => {
        const stop = id(0), first = id(0), second = id(0), output = id(0)
        const initializer = /** @type {Value} */ (['object', [
            [':', 'a', ref(first)], [':', 'b', ref(first)],
            [':', 'a', returningValue('if', ref(stop), [ref(second)], ref(second))],
            [':', '__proto__', ref(first)], [':', 2, 'two'], [':', 1, 'one'], [':', 'c', ref(second)],
        ]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(first), ref(second), ['()', ['Object.entries'], [ref(output)]]]]], [
                ['define', first, ['array', [4]], 'required'], ['define', second, ['array', [9]], 'required'], ['define', output, initializer, 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [true])), [9])
        const value = evaluate(calledFunction(fn, [false]))
        assert(value instanceof Array && value[0] !== null && typeof value[0] === 'object' && value[4] instanceof Array)
        const object = /** @type {Readonly<Record<string, unknown>>} */ (value[0])
        assertEq(value[0], value[1])
        assertEq(object.a, value[3])
        assertEq(object.b, value[2])
        assertEq(object.c, value[3])
        assert(Object.hasOwn(object, '__proto__'))
        assertEq(object['__proto__'], value[2])
        assertStructurallySame(Object.keys(object), ['1', '2', 'a', 'b', '__proto__', 'c'])
        assertStructurallySame(value[4].map(entry => {
            assert(entry instanceof Array)
            return entry[0]
        }), ['1', '2', 'a', 'b', '__proto__', 'c'])
    },
    objectMemoAndCapturedLifetimes: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), initialized = id(0)
        const witness = collectingMemo(ref(selected), 0)
        const payload = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller), 'returned']])
        const initializers = /** @type {readonly Value[]} */ ([
            ['object', [[':', ref(selected), returningValue('if', ref(stop), [ref(selected)], payload)], [':', 'alias', ref(selected)]]],
            ['object', [[':', 'first', ref(selected)], [':', returningValue('if', ref(stop), ['tail'], payload), ref(selected)]]],
        ])
        for (const [index, initializer] of initializers.entries()) {
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(initialized), ref(selected), ref(caller), 'normal']]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'], ['loop', witness], ['define', initialized, initializer, 'required'],
                ]),
            })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array && normal[0] !== null && typeof normal[0] === 'object'
                && normal[1] instanceof Array && normal[1][0] instanceof Array)
            const object = /** @type {Readonly<Record<string, unknown>>} */ (normal[0])
            assertEq(object[index === 0 ? '4,4' : 'first'], normal[1])
            assertEq(object[index === 0 ? 'alias' : 'tail'], normal[1])
            assertEq(normal[1][0], normal[1][1])
            assertEq(normal[1][0][0], normal[2])
            assertEq(normal[3], 'normal')
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
            assertEq(returned[3], 'returned')
        }
        const local = id(0), captured = id(0), count = id(0), output = id(0), made = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), second = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const inner = collectingMemo(ref(local), 2)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', inner],
                    ['define', made, ['object', [[':', ref(local), returningValue('if', ['===', ref(count), 1], [ref(local)], getter)]]], 'required'],
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
    objectCalleesAndArgumentReturns: () => {
        const callees = /** @type {readonly Value[]} */ ([
            ['object', []], ['object', [[':', 'x', 1]]], ['block', result(['object', []])], [',', [0, ['object', []]]],
        ])
        for (const callee of callees) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
            const graph = calledFunction(requiredFunction(['()', callee, [2]]))
            assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
        }
        const coercion = keyMethods(simpleFunction([], failed('object callee key conversion')), simpleFunction([], 0))
        const graph = calledFunction(requiredFunction(['()', ['object', [[':', coercion, 1]]], [escape()]]))
        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'object callee key conversion')
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['object', [[':', escape(), 1]]], [failed('skipped object-callee argument')]]))), 7)
    },
    objectMetadataAndRoundTrip: () => {
        const count = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), payload = id(0), output = id(0)
        const key = returningValue('block', ['>', ref(count), 0], [7],
            ['()', ref(self), [['-', ref(count), 1], ['+', ref(argument), 1], 99]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(payload), ref(captured), ref(rest)]]], [
                ['define', payload, ['array', [ref(captured), ref(argument), ref(rest)]], 'required'],
                ['define', output, ['object', [[':', key, ref(payload)], [':', 'alias', ref(payload)]]], 'required'],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        const fifth = fromFast(assertOk(toFast(fourth)))
        const before = assertOk(identityAnalysis(fourth)), after = assertOk(identityAnalysis(fifth))
        assertStructurallySame(
            { root: before.root, nodes: before.nodes, scope: before.scope, shared: before.shared },
            { root: after.root, nodes: after.nodes, scope: after.scope, shared: after.shared },
        )
        for (const current of /** @type {readonly Exp[]} */ ([graph, second, third, fourth, fifth])) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            for (const depth of /** @type {const} */ ([0, 1])) {
                const call = /** @type {Exp} */ (['()', current, depth === 0 ? [0, 5, 7, 8] : [1, 5]])
                const value = evaluate(call)
                assert(value instanceof Array && value[0] !== null && typeof value[0] === 'object' && value[2] instanceof Array)
                const object = /** @type {Readonly<Record<string, unknown>>} */ (value[0])
                assertEq(value[0], value[1])
                assertEq(object['7'], value[2])
                assertEq(object.alias, value[2])
                assertEq(value[2][0], value[3])
                assertEq(value[2][2], value[4])
                assertStructurallySame(value[2], depth === 0 ? [[4], 5, [7, 8]] : [[4], 6, [99]])
            }
        }
    },
    sequencePreviouslyRefusedReturns: () => {
        assertEq(evaluate(calledFunction(requiredFunction(['array', [escape()]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction([',', [1, escape()]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['block', body(['yield', [escape(), 0]], [
            ['if', [], false, body(['return', target, 9]), body(['yield', []])],
        ])]))), 7)
    },
    arrayConstructionIdentityAndCallees: () => {
        const stop = id(0), allocation = id(0), output = id(0)
        for (const length of /** @type {const} */ ([0, 1, 3])) {
            const elements = Array.from({ length }, (_, index) => index === length - 1
                ? returningValue('if', ref(stop), [ref(allocation)], ref(allocation)) : ref(allocation))
            const initializer = length === 0 ? returningValue('if', ref(stop), [['array', []]], ref(allocation))
                : /** @type {Value} */ (['array', elements])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(output), ref(output), ref(allocation)]]], [
                    ['define', allocation, ['array', [4]], 'required'], ['define', output, initializer, 'required'],
                ]),
            })
            assertStructurallySame(evaluate(calledFunction(fn, [true])), [4])
            const value = evaluate(calledFunction(fn, [false]))
            assert(value instanceof Array && value[0] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0].length, length)
            for (const element of value[0]) { assertEq(element, value[2]) }
        }
        const callees = /** @type {readonly Value[]} */ ([['array', []], ['array', [1]], [',', [0, ['array', []]]]])
        for (const callee of callees) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7)
            const normal = calledFunction(requiredFunction(['()', callee, [2]]))
            assertError(memo(assertOk(identityAnalysis(normal)))({ args: [] }))
        }
        assertEq(evaluate(calledFunction(requiredFunction(['()', ['array', [escape()]], [failed('skipped array-callee argument')]]))), 7)
    },
    commaFinalIdentityAndCalleeProvenance: () => {
        const stop = id(0), allocation = id(0), output = id(0), callee = id(0)
        const initializer = /** @type {Value} */ ([',', [
            1, returningValue('if', ref(stop), [ref(allocation)], ref(allocation)), ref(allocation),
        ]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(allocation)]]], [
                ['define', allocation, ['array', [4]], 'required'], ['define', output, initializer, 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [true])), [4])
        const value = evaluate(calledFunction(fn, [false]))
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        const referenced = requiredFunction(['()', [',', [0, ref(callee)]], [escape()]])
        const referencedFn = /** @type {FastFunction} */ ({ ...referenced, body: { ...referenced.body, statements: [
            ['define', callee, constantFunction, 'required'], ...referenced.body.statements,
        ] } })
        assertEq(evaluate(calledFunction(referencedFn)), 7)
        const factory = simpleFunction([], constantFunction)
        assertEq(evaluate(calledFunction(requiredFunction(['()', [',', [0, ['()', factory, []]]], [escape()]]))), 7)
    },
    sequenceRequiredFailuresAndSkippedConsumers: () => {
        for (const kind of /** @type {const} */ (['array', ',', 'yield'])) {
            const earlier = sequenceValue(kind, [failed(`${kind} prefix`), escape()])
            const graph = calledFunction(requiredFunction(earlier))
            assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), `${kind} prefix`)
            const skipped = sequenceValue(kind, [escape(), failed(`${kind} skipped tail`)])
            const source = requiredFunction(skipped)
            const dead = id(0)
            const fn = /** @type {FastFunction} */ ({ ...source, body: { ...source.body, statements: [
                ...source.body.statements, ['define', dead, failed('unreachable sequence suffix'), 'required'],
            ] } })
            assertEq(evaluate(calledFunction(fn)), 7)
            const consumer = simpleFunction([], failed('skipped sequence consumer'))
            assertEq(evaluate(calledFunction(requiredFunction(['()', consumer, [skipped]]))), 7)
        }
        const arrayCallee = calledFunction(requiredFunction(['()', ['array', [failed('array callee prefix')]], [escape()]]))
        assertEq(assertError(memo(assertOk(identityAnalysis(arrayCallee)))({ args: [] })), 'array callee prefix')
        const commaCallee = calledFunction(requiredFunction(['()', [',', [failed('comma callee prefix'), constantFunction]], [escape()]]))
        assertEq(assertError(memo(assertOk(identityAnalysis(commaCallee)))({ args: [] })), 'comma callee prefix')
    },
    sequenceNormalYieldPackingAndOwners: () => {
        const stop = id(0), allocation = id(0), initialized = id(0), loopOutput = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [loopOutput], body: body(['break', loopTarget, [ref(allocation)]]),
        })
        for (const length of /** @type {const} */ ([0, 1, 3])) {
            const values = Array.from({ length }, (_, index) => index === length - 1
                ? returningValue('if', ref(stop), [ref(loopOutput)], ref(allocation)) : ref(loopOutput))
            const region = body(['yield', values], [
                ['loop', loop], ['if', [], length === 0 ? ref(stop) : false, body(['return', target, ref(allocation)]), body(['yield', []])],
            ])
            for (const arm of /** @type {const} */ ([false, true])) {
                const initializer = /** @type {Value} */ (arm ? ['if', true, region, result(9)] : ['block', region])
                const fn = /** @type {FastFunction} */ ({
                    target, parameters: [stop], rest: null, self: null, captures: [],
                    body: body(['return', target, ['array', [ref(initialized), ref(initialized), ref(allocation)]]], [
                        ['define', allocation, ['array', [4]], 'required'], ['define', initialized, initializer, 'required'],
                    ]),
                })
                assertStructurallySame(evaluate(calledFunction(fn, [true])), [4])
                const value = evaluate(calledFunction(fn, [false]))
                assert(value instanceof Array)
                assertEq(value[0], value[1])
                if (length === 1) { assertEq(value[0], value[2]) }
                else {
                    assert(value[0] instanceof Array)
                    assertEq(value[0].length, length)
                    for (const item of value[0]) { assertEq(item, value[2]) }
                }
            }
        }
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const nestedOutput = id(0)
        const nested = /** @type {FastFunction} */ ({
            target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', nestedTarget, 12], [['define', nestedOutput, ['array', [
                ['block', body(['return', nestedTarget, 11])], failed('skipped nested function tail'),
            ]], 'required']]),
        })
        assertStructurallySame(evaluate(calledFunction(requiredFunction(sequenceValue('yield', [['()', ['function', nested], []], 9])))), [11, 9])
    },
    sequenceMemoAndCapturedLifetimes: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), initialized = id(0)
        const witness = collectingMemo(ref(selected), 0)
        const partial = returningValue('if', ref(stop), [ref(selected)], ['array', [ref(selected), ref(selected), ref(caller), 'returned']])
        for (const kind of /** @type {const} */ (['array', ',', 'yield'])) {
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(initialized), ref(selected), ref(caller), 'normal']]], [
                    ['define', caller, ['array', [4]], 'lazy'],
                    ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                        ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                    ])], 'lazy'], ['loop', witness], ['define', initialized, sequenceValue(kind, [ref(selected), partial]), 'required'],
                ]),
            })
            const normal = evaluate(calledFunction(fn, [false]))
            assert(normal instanceof Array && normal[0] instanceof Array && normal[1] instanceof Array && normal[1][0] instanceof Array)
            if (kind === ',') { assertEq(normal[0], normal[1]) }
            else { assertEq(normal[0][0], normal[1]); assertEq(normal[0][1], normal[1]) }
            assertEq(normal[1][0], normal[1][1])
            assertEq(normal[1][0][0], normal[2])
            assertEq(normal[3], 'normal')
            const returned = evaluate(calledFunction(fn, [true]))
            assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
            assertEq(returned[0], returned[1])
            assertEq(returned[0][0], returned[0][1])
            assertEq(returned[0][0][0], returned[2])
            assertEq(returned[3], 'returned')
        }
        const local = id(0), captured = id(0), count = id(0), output = id(0), made = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), second = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const inner = collectingMemo(ref(local), 2)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', inner],
                    ['define', made, ['array', [ref(local), returningValue('if', ['===', ref(count), 1], [ref(local)], getter)]], 'required'],
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
    sequenceMetadataAndRoundTrip: () => {
        const count = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0)
        const last = /** @type {Value} */ (['block', body(['yield', [ref(captured), ref(argument), ref(rest)]], [
            ['if', [], ['>', ref(count), 0], body(['return', target, ['()', ref(self), [['-', ref(count), 1], ['+', ref(argument), 1], 99]]]), body(['yield', []])],
        ])])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(captured), ref(rest)]]], [['define', output, [',', [1, last]], 'required']]),
        })
        const graph = fromFast(result(['function', fn]))
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        assertStructurallySame(assertOk(identityAnalysis(fourth)), assertOk(identityAnalysis(third)))
        for (const current of /** @type {readonly Exp[]} */ ([graph, second, third, fourth])) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            for (const depth of /** @type {const} */ ([0, 1])) {
                const call = /** @type {Exp} */ (['()', current, depth === 0 ? [0, 5, 7, 8] : [1, 5]])
                const value = evaluate(call)
                assert(value instanceof Array && value[0] instanceof Array)
                assertEq(value[0], value[1])
                assertEq(value[0][0], value[2])
                assertEq(value[0][2], value[3])
                assertStructurallySame(value[0], depth === 0 ? [[4], 5, [7, 8]] : [[4], 6, [99]])
            }
        }
    },
    boundedSequenceReturnChain: () => {
        /** @type {Value} */
        let value = escape()
        // Unit proofs cover 20,000-level traversal; the full memo pipeline
        // retains its existing nested scope-snapshot resource bound here.
        for (let depth = 0; depth < 512; depth += 1) { value = depth % 2 === 0 ? ['array', [1, value]] : [',', [1, value]] }
        assertEq(evaluate(calledFunction(requiredFunction(value))), 7)
    },
    canonicalLogicalReturns: () => {
        const cases = /** @type {const} */ ([
            ['&&', false, false], ['&&', true, 7], ['||', true, true], ['||', false, 7],
            ['??', 3, 3], ['??', null, 7], ['??', undefined, 7],
        ])
        for (const [tag, left, expected] of cases) {
            assertEq(evaluate(calledFunction(requiredFunction(logicalValue(tag, left, escape())))), expected)
        }
    },
    eagerPreviouslyRefusedReturns: () => {
        assertEq(evaluate(calledFunction(requiredFunction(['if', escape(), body(['return', target, 9]), result(2)]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['()', constantFunction, [escape()]]))), 7)
        assertEq(evaluate(calledFunction(requiredFunction(['+', 1, escape()]))), 7)
    },
    eagerUnaryBinaryNormalAndReturn: () => {
        const choice = id(0)
        const unary = /** @type {readonly (readonly ['-' | '+' | '!' | '~', unknown])[]} */ ([
            ['-', -6], ['+', 6], ['!', false], ['~', -7],
        ])
        for (const [tag, expected] of unary) {
            const value = /** @type {Value} */ ([tag, returningValue('if', ref(choice), [6])])
            const fn = requiredFunction(value, [choice])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            assertStructurallySame(evaluate(calledFunction(fn, [false])), expected)
        }
        const binary = /** @type {readonly (readonly ['+' | '-' | '*' | '===' | '<' | '<<', unknown])[]} */ ([
            ['+', 5], ['-', -1], ['*', 6], ['===', false], ['<', true], ['<<', 16],
        ])
        for (const [tag, expected] of binary) {
            const value = /** @type {Value} */ ([tag, 2, returningValue('block', ref(choice), [3])])
            const fn = requiredFunction(value, [choice])
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            assertStructurallySame(evaluate(calledFunction(fn, [false])), expected)
        }
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['-', escape(['array', [4]])]))), [4])
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['+', escape(['array', [4]]), failed('skipped right operand')]))), [4])
        const graph = calledFunction(requiredFunction(['+', failed('required left operand'), escape()]))
        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'required left operand')
    },
    eagerValueAndStatementConditionalTests: () => {
        const stop = id(0), choice = id(0), output = id(0)
        const test = returningValue('block', ref(stop), [ref(choice)], ['array', ['test return']])
        const values = /** @type {readonly Value[]} */ ([
            ['if', test, result(['array', ['then']]), result(['array', ['else']])],
            ['?:', test, ['array', ['then']], ['array', ['else']]],
        ])
        for (const value of values) {
            const fn = requiredFunction(value, [stop, choice])
            assertStructurallySame(evaluate(calledFunction(fn, [true, false])), ['test return'])
            assertStructurallySame(evaluate(calledFunction(fn, [false, true])), ['then'])
            assertStructurallySame(evaluate(calledFunction(fn, [false, false])), ['else'])
        }
        const statement = /** @type {FastFunction} */ ({
            target, parameters: [stop, choice], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [
                ['if', [output], test, result(['array', ['then']]), result(['array', ['else']])],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(statement, [true, true])), ['test return'])
        assertStructurallySame(evaluate(calledFunction(statement, [false, true])), ['then'])
        assertStructurallySame(evaluate(calledFunction(statement, [false, false])), ['else'])
        const skipped = /** @type {FastFunction} */ ({ ...statement, body: body(['return', target, 9], [
            ['if', [], escape(), body(['throw', 'skipped then arm']), body(['throw', 'skipped else arm'])],
        ]) })
        assertEq(evaluate(calledFunction(skipped, [false, false])), 7)
        const graph = calledFunction(requiredFunction(['if', ['+', failed('condition prefix'), escape()], result(1), result(2)]))
        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 'condition prefix')
    },
    eagerCallOrderAndCallableValidation: () => {
        const observed = id(0)
        const callee = /** @type {Value} */ (['block', result(constantFunction, [['define', observed, failed('callee prefix'), 'required']])])
        const calleeGraph = calledFunction(requiredFunction(['()', callee, [escape()]]))
        assertEq(assertError(memo(assertOk(identityAnalysis(calleeGraph)))({ args: [] })), 'callee prefix')
        const argumentGraph = calledFunction(requiredFunction(['()', constantFunction, [failed('earlier argument'), escape()]]))
        assertEq(assertError(memo(assertOk(identityAnalysis(argumentGraph)))({ args: [] })), 'earlier argument')
        for (const notCallable of /** @type {const} */ ([null, 1])) {
            assertEq(evaluate(calledFunction(requiredFunction(['()', notCallable, [escape()]]))), 7)
            const normal = calledFunction(requiredFunction(['()', notCallable, [2]]))
            assertError(memo(assertOk(identityAnalysis(normal)))({ args: [] }))
        }
    },
    eagerSkippedCallWorkAndNormalArities: () => {
        assertEq(evaluate(calledFunction(requiredFunction(['()', escape(), [failed('skipped argument')]]))), 7)
        const throwing = simpleFunction([], failed('skipped call body'))
        assertEq(evaluate(calledFunction(requiredFunction(['()', throwing, [escape(), failed('later argument')]]))), 7)
        const calleeValues = /** @type {readonly Value[]} */ ([
            constantFunction, 3, ['+', 1, 2], ['()', simpleFunction([], constantFunction), []],
        ])
        for (const callee of calleeValues) { assertEq(evaluate(calledFunction(requiredFunction(['()', callee, [escape()]]))), 7) }
        const binding = id(0), dead = id(0)
        const referenced = requiredFunction(['()', ref(binding), [escape()]])
        const referencedFn = /** @type {FastFunction} */ ({ ...referenced, body: { ...referenced.body, statements: [
            ['define', binding, constantFunction, 'required'], ...referenced.body.statements,
            ['define', dead, failed('unreachable call suffix'), 'required'],
        ] } })
        assertEq(evaluate(calledFunction(referencedFn)), 7)
        const stop = id(0), output = id(0), rest = id(0)
        const variadic = simpleFunction([], ref(rest), rest)
        const cases = /** @type {readonly (readonly [readonly Value[], unknown])[]} */ ([
            [[], []], [[['array', [4]]], [[4]]], [[1, 2, 3], [1, 2, 3]],
        ])
        for (const [args, expected] of cases) {
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(output), ref(output)]]], [
                    ['define', output, ['()', returningValue('block', ref(stop), [variadic]), args], 'required'],
                ]),
            })
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            const value = evaluate(calledFunction(fn, [false]))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assertStructurallySame(value[0], expected)
        }
    },
    eagerMemoIdentityAndIterationLifetimes: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), initialized = id(0), left = id(0), right = id(0)
        const operation = simpleFunction([left, right], ['array', [ref(left), ref(right)]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(initialized), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                    ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'],
                ['define', initialized, ['()', operation, [ref(selected), returningValue('if', ref(stop), [ref(selected)], ['array', [ref(selected), ref(selected), ref(caller)]])]], 'required'],
            ]),
        })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[1] instanceof Array && normal[1][0] instanceof Array)
        assertEq(normal[0][0], normal[1])
        assertEq(normal[0][1], normal[1])
        assertEq(normal[1][0], normal[1][1])
        assertEq(normal[1][0][0], normal[2])
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
        assertEq(returned[0], returned[1])
        assertEq(returned[0][0], returned[0][1])
        assertEq(returned[0][0][0], returned[2])
        const local = id(0), captured = id(0), count = id(0), output = id(0), made = id(0)
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), first = id(0), second = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const inner = collectingMemo(ref(local), 2)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', outerTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', outerTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', inner],
                    ['define', made, ['()', operation, [ref(local), returningValue('if', ['===', ref(count), 1], [ref(local)], getter)]], 'required'],
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
    eagerRecursiveMetadataAndRoundTrip: () => {
        const count = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0), passed = id(0)
        const identity = simpleFunction([passed], ref(passed))
        const argumentValue = returningValue('block', ['>', ref(count), 0], [['array', [ref(captured), ref(argument), ref(rest)]]],
            ['()', ref(self), [['-', ref(count), 1], ['+', ref(argument), 1], 99]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(captured), ref(rest)]]], [
                ['define', output, ['()', identity, [argumentValue]], 'required'],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        const fourth = fromFast(assertOk(toFast(third)))
        // Required callee snapshots can take an extra pass to normalize anchors.
        assertStructurallySame(assertOk(identityAnalysis(fourth)), assertOk(identityAnalysis(third)))
        for (const current of /** @type {readonly Exp[]} */ ([graph, second, third, fourth])) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            assert(assertOk(identityAnalysis(current)).nodes.some(node => node[0] === 'self'))
            const normalCall = /** @type {Exp} */ (['()', current, [0, 5, 7, 8]])
            const value = evaluate(normalCall)
            assert(value instanceof Array && value[0] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0][0], value[2])
            assertEq(value[0][2], value[3])
            assertStructurallySame(value[0], [[4], 5, [7, 8]])
            const recursiveCall = /** @type {Exp} */ (['()', current, [1, 5]])
            const recurred = evaluate(recursiveCall)
            assert(recurred instanceof Array && recurred[0] instanceof Array)
            assertEq(recurred[0], recurred[1])
            assertEq(recurred[0][0], recurred[2])
            assertEq(recurred[0][2], recurred[3])
            assertStructurallySame(recurred[0], [[4], 6, [99]])
        }
    },
    deepEagerReturnChain: () => {
        /** @type {Value} */
        let value = escape()
        // The unit proof covers 20,000-level operand traversal. This full path
        // bounds the memo planner's existing nested scope-snapshot cost.
        for (let depth = 0; depth < 512; depth += 1) { value = depth % 2 === 0 ? ['+', 1, value] : ['-', value] }
        assertEq(evaluate(calledFunction(requiredFunction(value))), 7)
    },
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
        rawLogicalAndSkippedReturn: () => calledFunction(requiredFunction(rawLogical('&&', false))),
        rawLogicalAndSelectedReturn: () => calledFunction(requiredFunction(rawLogical('&&', true))),
        rawLogicalOrSkippedReturn: () => calledFunction(requiredFunction(rawLogical('||', true))),
        rawLogicalOrSelectedReturn: () => calledFunction(requiredFunction(rawLogical('||', false))),
        rawNullishSkippedReturn: () => calledFunction(requiredFunction(rawLogical('??', 3))),
        rawNullishNullReturn: () => calledFunction(requiredFunction(rawLogical('??', null))),
        rawNullishUndefinedReturn: () => calledFunction(requiredFunction(rawLogical('??', undefined))),
        standaloneReturn: () => {
            const output = id(0)
            fromFast(result(ref(output), [['define', output, escape(), 'required']]))
        },
        foreignOwner: () => {
            const foreign = /** @type {const} */ ({ ...target })
            calledFunction(requiredFunction(['block', body(['return', foreign, 7])]))
        },
        statementYieldBlockArityMismatch: () => {
            const stop = id(0), output = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [
                    ['block', [output], body(['yield', [returningValue('if', ref(stop), [1]), 2]])],
                ]),
            })
            calledFunction(fn, [false])
        },
        statementYieldIfArityMismatch: () => {
            const stop = id(0), first = id(0), second = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(first), ref(second)]]], [
                    ['if', [first, second], true, body(['yield', [returningValue('if', ref(stop), [1])]]), body(['yield', [1, 2]])],
                ]),
            })
            calledFunction(fn, [false])
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
