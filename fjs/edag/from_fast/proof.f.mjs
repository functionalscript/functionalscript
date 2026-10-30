/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Environment, Transfer } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { anchored, fromFast, lowerBlock, lowerValue } from './module.f.mjs'
import { completeTransfers } from './loop/completions/module.f.mjs'
import { directInvocationRoot, invocationRootOf } from './loop/root/module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toFast } from '../to_fast/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const result = (value, statements = []) => ({ statements, exit: ['yield', [value]] })

const target = /** @type {const} */ ({ kind: 'function', index: 0 })

/** @type {(loop: Loop, value: Value) => Block} */
const afterLoop = (loop, value) => result(value, [['loop', loop]])

/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })

/** @type {(initial?: Value, limit?: Value) => Loop} */
const summing = (initial = 0, limit = 3) => {
    // Resolved identities, rather than their presentation indices, order state.
    const count = id(0), total = id(0), sum = id(0), rounds = id(0)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target, parameters: [count, total], initial: [initial, 10], results: [sum, rounds],
        body: body(['continue', target, [ref(count), ref(total)]], [
            ['if', [], ['<', ref(count), limit],
                body(['continue', target, [['+', ref(count), 1], ['+', ref(total), ref(count)]]]),
                body(['break', target, [ref(total), ref(count)]]),
            ],
        ]),
    }
}

/** @type {(depth: number) => Loop} */
const nestedCounting = depth => {
    const count = id(0), total = id(0), output = id(0)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const inner = depth === 1 ? null : nestedCounting(depth - 1)
    const amount = inner === null ? 1 : ref(inner.results[0])
    return {
        target, parameters: [count, total], initial: [0, 0], results: [output],
        body: body(['continue', target, [ref(count), ref(total)]], [
            ['if', [], ['<', ref(count), 2],
                body(['continue', target, [['+', ref(count), 1], ['+', ref(total), amount]]], inner === null ? [] : [['loop', inner]]),
                body(['break', target, [ref(total)]]),
            ],
        ]),
    }
}

/** @type {(condition: Value, value: Value, normal?: readonly Value[], owner?: FastFunction['target']) => Loop} */
const returningLoop = (condition, value, normal = [], owner = target) => {
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target: loopTarget, parameters: [], initial: [], results: normal.map(() => id(0)),
        body: body(['break', loopTarget, normal], [
            ['if', [], condition, body(['return', owner, value]), body(['break', loopTarget, normal])],
        ]),
    }
}

/** @type {(fn: FastFunction, args?: readonly Value[]) => Exp} */
const calledFunction = (fn, args = []) => fromFast(result(['()', ['function', fn], args]))

/** @type {(length: number) => FastFunction} */
const mixedJoinFunction = length => {
    const selected = id(0), stopA = id(0), stopB = id(0), operation = id(0), early = id(0)
    const made = id(0), allocation = id(0)
    const loop = returningLoop(ref(early), 77)
    const repeated = Array.from({ length }, () => /** @type {Statement} */ (['if', [], ref(selected),
        body(['yield', []], [['if', [], ref(stopA), body(['return', target, 50]), body(['yield', []])]]),
        body(['yield', []], [['if', [], ref(stopB), body(['return', target, 60]), body(['yield', []])]]),
    ]))
    return {
        target, parameters: [selected, stopA, stopB, operation, early], rest: null, self: null, captures: [],
        body: body(['return', target, ['array', [ref(allocation), ref(allocation), ref(made)]]], [
            ['loop', loop], ...repeated,
            ['define', made, ['()', ref(operation), []], 'required'],
            ['define', allocation, ['array', [ref(made)]], 'required'],
        ]),
    }
}

/** @type {(length: number) => FastFunction} */
const rootJoinFunction = length => {
    const parameters = Array.from({ length: 7 }, () => id(0))
    const count = id(0), selected = id(0), stopA = id(0), stopB = id(0), operation = id(0), left = id(0), right = id(0)
    const captured = id(0), self = id(0), output = id(0), made = id(0), allocation = id(0)
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const repeated = Array.from({ length }, () => /** @type {Statement} */ (['if', [], ref(selected),
        body(['yield', []], [['if', [], ref(stopA), body(['return', target, 50]), body(['yield', []])]]),
        body(['yield', []], [['if', [], ref(stopB), body(['return', target, 60]), body(['yield', []])]]),
    ]))
    const loop = /** @type {Loop} */ ({
        target: loopTarget, parameters: [count, selected, stopA, stopB, operation, left, right], initial: parameters.map(ref), results: [output],
        body: body(['break', loopTarget, [['array', [ref(allocation), ref(allocation), ref(made), ref(captured)]]]], [
            ['if', [], ['>', ref(count), 0], body(['continue', loopTarget, [
                ['-', ref(count), 1], ref(selected), ref(stopA), ref(stopB), ref(operation), ref(right), ['+', ref(left), ref(right)],
            ]]), body(['yield', []])],
            ...repeated,
            ['define', made, ['()', ref(operation), [ref(captured), ref(left), ref(right)]], 'required'],
            ['define', allocation, ['array', [ref(made), ref(captured)]], 'required'],
        ]),
    })
    return {
        target, parameters, rest: null, self, captures: [{ binding: captured, value: ['array', ['capture']] }],
        body: body(['return', target, ref(output)], [['loop', loop]]),
    }
}

/** @type {(value: Value, limit?: Value, selected?: Value) => Loop} */
const collectingMemo = (value, limit = 3, selected = true) => {
    const count = id(0), saved = id(0), output = id(0)
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target: loopTarget, parameters: [count, saved], initial: [0, null], results: [output],
        body: body(['continue', loopTarget, [ref(count), ref(saved)]], [
            ['if', [], ['<', ref(count), limit],
                body(['continue', loopTarget, [['+', ref(count), 1], ['array', [ref(saved), ['?:', selected, value, null]]]]]),
                body(['break', loopTarget, [ref(saved)]]),
            ],
        ]),
    }
}

/** @type {(value: Value, ago?: number) => Value} */
const collectedMemo = (value, ago = 0) => {
    let previous = value
    for (let index = 0; index < ago; ++index) { previous = ['.', previous, 0] }
    return ['.', previous, 1]
}

/** @type {(initial?: Value, limit?: Value) => Loop} */
const counting = (initial = 0, limit = 3) => {
    const state = id(10)
    const output = id(11)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return {
        target, parameters: [state], initial: [initial], results: [output],
        body: {
            statements: [['if', [], ['<', ref(state), limit],
                { statements: [], exit: ['continue', target, [['+', ref(state), 1]]] },
                { statements: [], exit: ['break', target, [ref(state)]] }]],
            exit: ['continue', target, [ref(state)]],
        },
    }
}

/** @type {(graph: Exp) => unknown} */
const evaluate = graph => assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))

/** @type {Transfer} */
const returned = (exit, environment) => {
    assert(exit[0] === 'return')
    return lowerValue(exit[2], environment)
}

export const _id = id
export const _ref = ref
export const _result = result
export const _target = target
export const _afterLoop = afterLoop
export const _body = body
export const _summing = summing
export const _calledFunction = calledFunction
export const _counting = counting
export const _evaluate = evaluate
export const _collectingMemo = collectingMemo
export const _collectedMemo = collectedMemo

export const proof = {
    distinctThrownValuesRetainInitializationOrder: () => {
        const first = id(0), second = id(0)
        const initial = /** @type {Value} */ (['block', { statements: [], exit: ['throw', 1] }])
        for (const later of /** @type {readonly Value[]} */ ([['block', { statements: [], exit: ['throw', 2] }], ['.', null, 'x']])) {
            for (const before of [false, true]) {
                const loop = counting(0, 0)
                const definitions = /** @type {readonly Statement[]} */ ([['define', first, initial, 'required'], ['define', second, later, 'required']])
                const graph = fromFast(result(['array', [ref(second), ref(first)]], before
                    ? [['loop', loop], ...definitions] : [...definitions, ['loop', loop]]))
                assertStructurallySame(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 1)
            }
        }
        const graph = fromFast(result(['array', [ref(second), ref(first)]], [
            ['define', first, ['.', null, 'x'], 'required'], ['define', second, ['block', { statements: [], exit: ['throw', 2] }], 'required'],
        ]))
        assertStructurallySame(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), ['undefined'])
    },
    wholeAnchorListDemands: () => {
        const first = /** @type {Exp} */ (['.', null, 'first'])
        const second = /** @type {Exp} */ (['.', null, 'second'])
        const fn = /** @type {Exp} */ (['=>', 0, [], 0])
        for (const [exp, anchors, natural] of /** @type {readonly (readonly [Exp, readonly Exp[], boolean])[]} */ ([
            [['[]', [first, second]], [first, second], true],
            [['[]', [second, first]], [first, second], false],
            [['[]', [first, first, second]], [first, second, first], true],
            [[',', [first, second]], [first, second], true],
            [['=>', 0, [first, second], 0], [first, second], true],
            [['=>', 0, [], first], [first], false],
            [['{}', [[':', 'a', first], [':', 'b', second]]], [first, second], true],
            [['{}', [[':', ['String', second], first]]], [first], false],
            [['{}', [['...', second], [':', 'a', first]]], [first], false],
            [['[]', [['...', second], first]], [first], false],
            [['()', fn, [first, second]], [first, second], true],
            [['()', fn, [['...', second], first]], [first], false],
            [['[]', [['()', fn, []], first]], [first], false],
            [['?.()', first, [second]], [first], true],
            [['?.', first, 'x'], [first], true],
            [['.', first, 'x'], [first], true],
            [['?:', first, second, 0], [first], true],
            [['instanceof', first, 'Array'], [first], true],
            [['in', 'x', first], [first], true],
            [['!', first], [first], true],
            [['typeof', first], [first], true],
            [['===', first, second], [first, second], true],
            [['!==', first, second], [first, second], true],
            [['[]', [['undefined'], ['arg', 0], ['frame', 0], first]], [first], true],
            [0, [first], false],
            [1, [1], false],
            [null, [null], false],
            [1n, [1n], false],
        ])) {
            const value = anchored({ exp, anchors })
            assertEq(value === exp, natural)
        }
    },
    demandedAnchorSuffixRetainsEarlierFailures: () => {
        /** @type {Exp} */
        const first = ['throw', 17]
        /** @type {Exp} */
        const second = ['throw', 99]
        const graph = anchored({ exp: second, anchors: [first, second] })
        assertStructurallySame(graph, [',', [first, second]])
        assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 17)
        /** @type {Exp} */
        const prefix = ['[]', []]
        /** @type {readonly Exp[]} */
        const primitives = [0, null, 1n]
        for (const primitive of primitives) {
            assertStructurallySame(anchored({ exp: second, anchors: [prefix, primitive, second] }), [',', [prefix, primitive, second]])
        }
    },
    demandedAnchorSuffixKeepsLazyAndUnownedWork: () => {
        /** @type {Exp} */
        const first = ['[]', []]
        /** @type {Exp} */
        const second = ['throw', 17]
        /** @type {readonly Exp[]} */
        const expressions = [
            ['?:', false, second, first],
            ['[]', [['throw', 99], second]],
        ]
        for (const exp of expressions) {
            const graph = anchored({ exp, anchors: [first, second] })
            assertStructurallySame(graph, [',', [first, second, exp]])
            assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 17)
        }
    },
    demandedAnchorSuffixRetainsSharedIdentity: () => {
        /** @type {Exp} */
        const shared = ['[]', []]
        /** @type {Exp} */
        const same = ['===', shared, shared]
        /** @type {Exp} */
        const exp = ['?:', same, shared, null]
        const graph = anchored({ exp, anchors: [shared, same] })
        assertEq(graph, exp)
        assert(graph instanceof Array && graph[0] === '?:')
        assertEq(graph[1], same)
        assertEq(graph[2], shared)
        assertStructurallySame(evaluate(graph), [])
    },
    manyUnusedInitializersRetainOrderedAnchors: () => {
        const count = 3_000
        const bindings = Array.from({ length: count }, (_, index) => id(index))
        const block = result(0, bindings.map(binding => ['define', binding, ['array', []], 'required']))
        const lowered = lowerBlock(block)
        const graph = anchored(lowered)
        assertEq(lowered.anchors.length, count)
        assertEq(new Set(lowered.anchors).size, count)
        assert(graph instanceof Array && graph[0] === ',')
        assertEq(graph[1].length, count + 1)
        for (let index = 0; index < count; ++index) {
            assertEq(graph[1][index], lowered.anchors[index])
            assertStructurallySame(graph[1][index], ['[]', []])
        }
        assertEq(graph[1][count], 0)
    },
    selectedControlArmsReuseCompletedTests: () => {
        const parameters = [id(0), id(1), id(2)]
        const advanced = id(3), left = id(4), right = id(5)
        /** @type {FastFunction} */
        const fn = {
            target, parameters, rest: null, self: null, captures: [],
            body: body(['return', target, 0], [
                ['define', advanced, ['+', ref(parameters[0]), 1], 'required'],
                ['if', [], ['>', ref(advanced), 0],
                    body(['return', target, ['array', [ref(advanced), ref(left), ref(right)]]], [
                        ['define', left, ['+', ref(parameters[1]), 1], 'required'],
                        ['define', right, ['+', ref(parameters[2]), 1], 'required'],
                    ]),
                    body(['return', target, 0]),
                ],
            ]),
        }
        /** @type {Exp} */
        const next = ['+', ['arg', 0], 1]
        const graph = fromFast(result(['function', fn]))
        assertStructurallySame(graph, ['=>', 3, [], ['?:', ['>', next, 0], ['[]', [next, ['+', ['arg', 1], 1], ['+', ['arg', 2], 1]]], 0]])
        assertStructurallySame(evaluate(calledFunction(fn, [0, 1, 2])), [1, 2, 3])
        assertEq(evaluate(calledFunction(fn, [-2, 1, 2])), 0)
    },
    completedControlTestsDoNotEstablishDeferredDefinitions: () => {
        const selected = id(0), deferred = id(1)
        /** @type {FastFunction} */
        const fn = {
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, 7], [
                ['define', deferred, ['.', null, 'x'], 'lazy'],
                ['if', [], ref(selected), body(['yield', []]), body(['throw', ref(deferred)])],
            ]),
        }
        assertEq(evaluate(calledFunction(fn, [true])), 7)
        assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [false]))))({ args: [] }))
        const supplied = id(0)
        const block = result(7, [['if', [], true, body(['throw', ref(supplied)]), body(['yield', []])]])
        assertError(memo(assertOk(identityAnalysis(fromFast(block, [[supplied, ['.', null, 'x']]]))))({ args: [] }))
        const required = id(0)
        /** @type {Value} */
        const condition = ['block', result(true, [['define', required, ['block', body(['throw', 17])], 'required']])]
        const tested = result(7, [['if', [], condition, body(['throw', 99]), body(['yield', []])]])
        assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(tested))))({ args: [] })), 17)
    },
    wideRequiredUpdatesNormalizeTogether: () => {
        const parameters = Array.from({ length: 18 }, (_, index) => id(index))
        const next = parameters.map((_, index) => id(index))
        const results = parameters.map((_, index) => id(index))
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target, parameters, initial: parameters.map((_, index) => index), results,
            body: body(['continue', target, parameters.map(ref)], [
                ['if', [], ['<', ref(parameters[0]), 3], body(['continue', target, next.map(ref)],
                    parameters.map((parameter, index) => ['define', next[index], ['+', ref(parameter), 1], 'required'])),
                body(['break', target, parameters.map(ref)])],
            ]),
        })
        const graph = fromFast(afterLoop(loop, ['array', [ref(results[0]), ref(results[17])]]))
        assertStructurallySame(evaluate(graph), [3, 20])
        const second = fromFast(assertOk(toFast(graph)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(second)), assertOk(identityAnalysis(graph)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
    },
    fieldOnlyContinuation: () => {
        assertEq(evaluate(fromFast(result(['?.', null, 'x', ['|.', 'y', ['|.', 'z']]]))), undefined)
    },
    requiredInitializationOrder: () => {
        const failed = id(0), loop = counting()
        const value = lowerBlock(result(ref(failed), [
            ['define', failed, ['.', null, 'x'], 'required'], ['loop', loop],
        ]))
        assertStructurallySame(value.anchors[0], ['.', null, 'x'])
        assertEq(value.anchors.length, 2)
        assertEq(value.exp, value.anchors[0])
        const initial = id(0), dependent = counting(ref(initial))
        const naturallyOrdered = lowerBlock(result(ref(dependent.results[0]), [
            ['define', initial, ['.', null, 'x'], 'required'], ['loop', dependent],
        ]))
        assertEq(naturallyOrdered.anchors.length, 0)
    },
    orderedLoopResults: () => {
        const first = counting(), second = counting(0, ['.', null, 'x'])
        const value = lowerBlock(result(['array', [ref(second.results[0]), ref(first.results[0])]], [
            ['loop', first], ['loop', second],
        ]))
        assertEq(value.anchors.length, 1)
        assert(value.exp instanceof Array && value.exp[0] === '[]')
        assertEq(value.anchors[0], value.exp[1][1])
        const naturallyOrdered = lowerBlock(result(ref(first.results[0]), [['loop', first]]))
        assertEq(naturallyOrdered.anchors.length, 0)
    },
    memberPresent: () => {
        const receiver = id(0), key = id(0)
        const graph = /** @type {Exp} */ (['[]', [4]])
        assertStructurallySame(lowerValue(['memberPresent', ref(receiver), 'length'], [[receiver, graph]]), {
            exp: ['memberPresent', graph, 'length'], anchors: [],
        })
        assertStructurallySame(lowerValue(['memberPresent', ref(receiver), ['Number', ref(key)]], [[receiver, graph], [key, '0']]), {
            exp: ['memberPresent', graph, ['Number', '0']], anchors: [],
        })
        const local = id(1)
        const region = /** @type {Value} */ (['block', result(ref(local), [['define', local, 0, 'required']])])
        assertStructurallySame(fromFast(result(['memberPresent', ['array', [4]], ['Number', region]])),
            ['memberPresent', graph, ['Number', 0]])
    },
    deepRegions: () => {
        /** @type {Value} */
        let left = 1
        /** @type {Value} */
        let right = 1
        for (let depth = 0; depth < 20_000; ++depth) {
            const a = id(depth)
            const b = id(depth)
            left = ['block', result(['if', ref(a), result(1), result(ref(a))], [['define', a, left, 'required']])]
            right = ['block', result(['if', ref(b), result(right), result(ref(b))], [['define', b, 1, 'required']])]
        }
        let a = fromFast(result(left))
        let b = fromFast(result(right))
        for (let depth = 0; depth < 20_000; ++depth) {
            assert(a instanceof Array && a[0] === '?:')
            assert(b instanceof Array && b[0] === '?:')
            assert(a[1] === a[3])
            assertEq(a[2], 1)
            assertEq(b[1], 1)
            assertEq(b[3], 1)
            a = a[1]
            b = b[2]
        }
        assertEq(a, 1)
        assertEq(b, 1)
    },
    standaloneValuesAndLazyInitializersPlanTheirOwnMemoRegions: () => {
        const shared = id(0), outer = id(0)
        const loop = collectingMemo(ref(shared), 2)
        const region = result(['array', [['block', afterLoop(loop, collectedMemo(ref(loop.results[0])))], ref(shared)]], [
            ['define', shared, ['array', [4]], 'lazy'],
        ])
        const standalone = anchored(lowerValue(['block', region], []))
        const deferred = fromFast(result(ref(outer), [['define', outer, ['block', region], 'lazy']]))
        for (const graph of [standalone, deferred]) {
            const value = evaluate(graph)
            assert(value instanceof Array)
            assertStructurallySame(value, [[4], [4]])
            assertEq(value[0], value[1])
        }
    },
    customTransfers: () => {
        const external = id(0)
        const local = id(1)
        const block = result(ref(local), [['define', local, ref(external), 'required']])
        const transfer = /** @type {import('./types.ts').Transfer} */ ((exit, environment) => {
            assertEq(exit[0], 'yield')
            assertStructurallySame(environment, [[external, 4], [local, 4]])
            return { exp: 7, anchors: [8] }
        })
        assertStructurallySame(lowerBlock(block, [[external, 4]], transfer), { exp: 7, anchors: [8] })
        assertStructurallySame(lowerValue(['block', block], [[external, 4]], transfer), { exp: 7, anchors: [8] })
        const capture = id(2)
        assertStructurallySame(lowerValue(['function', {
            target, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ['block', result(ref(external))] }],
            body: result(ref(capture)),
        }], [[external, 4]], transfer), { exp: ['=>', 0, [], 4], anchors: [] })
    },
    bindingIdentityAndOrder: () => {
        const first = id(0), second = id(0), local = id(0)
        const a = /** @type {Exp} */ (['[]', [1]])
        const b = /** @type {Exp} */ (['[]', [2]])
        const ignored = /** @type {Exp} */ (['[]', [3]])
        /** @type {Environment} */
        const environment = [[first, a], [second, b], [first, ignored]]
        const values = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [ref(first), ref(second), ref(local)]], [['define', local, ref(first), 'lazy']]), environment))
        assertEq(values[1][0], a)
        assertEq(values[1][1], b)
        assertEq(values[1][2], a)
        assertEq(lowerValue(ref(first), [[first, null]]).exp, null)
        /** @type {Transfer} */
        const transferred = (exit, entries) => {
            assertStructurallySame(entries, [...environment, [local, a]])
            assertEq(entries[0][1], a)
            assertEq(entries[2][1], ignored)
            return returned(exit, entries)
        }
        const block = /** @type {Block} */ ({ statements: [['define', local, ref(first), 'lazy']], exit: ['return', target, ref(local)] })
        assertEq(lowerBlock(block, environment, transferred).exp, a)
        assertEq(lowerValue(['block', result(ref(local), block.statements)], environment, (exit, entries) => {
            assertStructurallySame(entries, [...environment, [local, a]])
            assert(exit[0] === 'yield')
            return lowerValue(exit[1][0], entries)
        }).exp, a)
        const shadow = result(ref(first), [['define', first, ['array', [4]], 'lazy']])
        const scoped = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [ref(first), ['block', shadow], ref(first)]]), environment))
        assertEq(scoped[1][0], a)
        assertStructurallySame(scoped[1][1], ['[]', [4]])
        assertEq(scoped[1][2], a)
        const normal = result(ref(first), shadow.statements)
        assertStructurallySame(lowerBlock(normal, environment, (exit, entries) => {
            assert(exit[0] === 'yield')
            assertStructurallySame(entries, [...environment, [first, ['[]', [4]], 'lazy']])
            assertEq(entries[0][1], a)
            assertEq(entries[2][1], ignored)
            return { exp: 5, anchors: [] }
        }), { exp: 5, anchors: [] })
    },
    lexicalBindingScopes: () => {
        const outer = id(0), inner = id(0), parameter = id(0), capture = id(0)
        const established = /** @type {Exp} */ (['[]', [1]])
        const graph = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [
            ['block', result(ref(inner), [['define', inner, ['array', [2]], 'lazy']])],
            ref(outer),
        ]]), [[outer, established]]))
        assertStructurallySame(graph[1][0], ['[]', [2]])
        assertEq(graph[1][1], established)
        /** @type {FastFunction} */
        const fn = { target, parameters: [parameter], rest: null, self: null, captures: [{ binding: capture, value: ref(outer) }], body: result(['array', [ref(parameter), ref(capture), ref(capture)]]) }
        const closure = /** @type {readonly ['=>', number, readonly Exp[], readonly ['[]', readonly Exp[]]]} */ (fromFast(result(['function', fn]), [[outer, established], [parameter, 9]]))
        assertEq(closure[2][0], established)
        assertStructurallySame(closure[3][1][0], ['arg', 0])
        assertEq(closure[3][1][1], closure[3][1][2])
        assertStructurallySame(closure[3][1][1], ['frame', 0])
    },
    manySequentialBindings: () => {
        const count = 3_000
        // Every diagnostic index collides; each object is a distinct binding.
        const bindings = Array.from({ length: count }, () => id(0))
        const aliases = Array.from({ length: count }, () => id(0))
        const external = id(0)
        const supplied = /** @type {Exp} */ (['{}', []])
        const latest = bindings[count - 1]
        /** @type {readonly Statement[]} */
        const statements = [
            ...bindings.map((binding, index) => /** @type {Statement} */ (['define', binding, ['array', [index]], 'lazy'])),
            ...aliases.map(binding => /** @type {Statement} */ (['define', binding, ref(latest), 'lazy'])),
        ]
        const graph = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [ref(external), ref(bindings[0]), ref(latest), ref(aliases[count - 1])]], statements), [[external, supplied]]))
        assertEq(graph[1][0], supplied)
        assertStructurallySame(graph[1][1], ['[]', [0]])
        assertStructurallySame(graph[1][2], ['[]', [count - 1]])
        assertEq(graph[1][2], graph[1][3])
        assert(graph[1][1] !== graph[1][2])
    },
    values: () => {
        assertStructurallySame(fromFast(result(['array', [NaN, undefined, undefined, -0]])), ['[]', [NaN, ['undefined'], ['undefined'], -0]])
        const graph = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [undefined, undefined]])))
        assert(graph[1][0] !== graph[1][1])
        assertStructurallySame(fromFast(result(['object', [[':', 'x', 1]]])), ['{}', [[':', 'x', 1]]])
        assertStructurallySame(fromFast(result(['-', 2n])), -2n)
        assertStructurallySame(fromFast(result(['-', ['array', []]])), ['-', ['[]', []]])
        assertStructurallySame(anchored(lowerValue(['+', 1, 2], [])), ['+', 1, 2])
    },
    required: () => {
        const a = id(0)
        const b = id(1)
        const failure = /** @type {const} */ (['.', null, 'x'])
        assertStructurallySame(fromFast(result(2, [['define', a, 1, 'required']])), [',', [1, 2]])
        assertStructurallySame(fromFast(result(['array', [ref(a), ref(a)]], [['define', a, ['array', [1]], 'required']])), ['[]', [['[]', [1]], ['[]', [1]]]])
        assertStructurallySame(fromFast(result(ref(b), [['define', a, failure, 'required'], ['define', b, ['array', [ref(a)]], 'required']])), ['[]', [['.', null, 'x']]])
        assertStructurallySame(fromFast(result(['?:', false, ref(a), 0], [['define', a, failure, 'required']])), [',', [['.', null, 'x'], ['?:', false, ['.', null, 'x'], 0]]])
        assertStructurallySame(fromFast(result(['if', ref(a), result(1), result(2)], [['define', a, true, 'required']])), ['?:', true, 1, 2])
        assertEq(fromFast(result(['block', result(ref(b), [['define', b, ref(a), 'required']])], [['define', a, 4, 'required']])), 4)
        const shared = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(result(['array', [ref(a), ref(a)]], [['define', a, ['array', []], 'required']])))
        assert(shared[1][0] === shared[1][1])
    },
    lazy: () => {
        const a = id(0)
        const b = id(1)
        const init = /** @type {Value} */ (['block', result(3, [['define', b, ['.', null, 'x'], 'required']])])
        const definitions = /** @type {readonly Statement[]} */ ([['define', a, init, 'lazy']])
        assertEq(fromFast(result(2, definitions)), 2)
        assertStructurallySame(fromFast(result(['?:', false, ref(a), 0], definitions)), ['?:', false, [',', [['.', null, 'x'], 3]], 0])
        assertStructurallySame(fromFast(result(['if', false, result(init), result(false)])), ['?:', false, [',', [['.', null, 'x'], 3]], false])
        // Equal values in eager and lazy positions are separate occurrences.
        assertStructurallySame(fromFast(result(['?:', init, init, init])), [',', [['.', null, 'x'], ['?:', 3, [',', [['.', null, 'x'], 3]], [',', [['.', null, 'x'], 3]]]]])
    },
    resultBlocks: () => {
        const a = id(0)
        const b = id(1)
        const pair = /** @type {Block} */ ({ statements: [], exit: ['yield', [1, 2]] })
        assertStructurallySame(fromFast(result(['array', [ref(a), ref(b)]], [['block', [a, b], pair]])), ['[]', [['.', ['[]', [1, 2]], 0], ['.', ['[]', [1, 2]], 1]]])
        assertStructurallySame(fromFast(result(ref(a), [['if', [a], true, result(1), result(2)]])), ['?:', true, 1, 2])
        assertStructurallySame(fromFast(result(1, [['block', [], { statements: [], exit: ['yield', []] }]])), [',', [['[]', []], 1]])
        assertStructurallySame(fromFast(result(['block', result(2)])), 2)
        assertStructurallySame(lowerBlock({ statements: [], exit: ['return', target, 5] }), { exp: 5, anchors: [] })
        assertStructurallySame(fromFast({ statements: [], exit: ['throw', 7] }), ['throw', 7])
    },
    functions: () => {
        const a = id(0)
        const b = id(1)
        const c = id(2)
        const body = result(['array', [ref(a), ref(b), ref(c)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [a], rest: b, self: c, captures: [], body })
        assertStructurallySame(fromFast(result(['function', fn])), ['=>', 1, [], ['[]', [['arg', 0], ['rest'], ['self']]]])
        assertStructurallySame(fromFast(result(['function', { ...fn, parameters: [], rest: null, self: null, body: result(1) }])), ['=>', 0, [], 1])
        const outer = id(3)
        const left = id(4)
        const right = id(5)
        const closure = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [{ binding: left, value: ref(outer) }, { binding: right, value: ref(outer) }], body: result(['array', [ref(left), ref(right)]]) })
        assertStructurallySame(fromFast(result(['function', closure]), [[outer, 4]]), ['=>', 0, [], ['[]', [4, 4]]])
        const graph = /** @type {readonly ['=>', number, readonly Exp[], readonly ['[]', readonly Exp[]]]} */ (fromFast(result(['function', closure]), [[outer, ['[]', []]]]))
        assertEq(graph[2].length, 1)
        assert(graph[3][1][0] === graph[3][1][1])
        const extra = id(6)
        const distinct = /** @type {FastFunction} */ ({ ...closure, captures: [...closure.captures, { binding: extra, value: ref(extra) }], body: result(['array', [ref(left), ref(right), ref(extra)]]) })
        const aliases = /** @type {readonly ['=>', number, readonly Exp[], Exp]} */ (fromFast(result(['function', distinct]), [[outer, ['arg', 0]], [extra, ['arg', 1]]]))
        assertEq(aliases[2].length, 2)
        const sameReads = /** @type {FastFunction} */ ({ ...closure, captures: [{ binding: left, value: ref(outer) }, { binding: right, value: ref(extra) }] })
        assertEq(/** @type {readonly ['=>', number, readonly Exp[], Exp]} */ (fromFast(result(['function', sameReads]), [[outer, ['arg', 0]], [extra, ['arg', 0]]]))[2].length, 1)
    },
    unusedCapture: () => {
        const capture = id(0)
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [{ binding: capture, value: ['.', null, 'x'] }], body: result(0) })
        const graph = fromFast(result(['function', fn]))
        assertStructurallySame(graph, ['=>', 0, [['.', null, 'x']], 0])
        assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
    },
    operations: () => {
        const value = /** @type {Value} */ (['block', result(1, [['define', id(0), ['.', null, 'x'], 'required']])])
        assertStructurallySame(fromFast(result(['.', 1, ['Number', value], ['|()', [value]]])), [',', [['.', null, 'x'], ['.', 1, ['Number', 1], ['|()', [[',', [['.', null, 'x'], 1]]]]]]])
        assertStructurallySame(fromFast(result(['?.', null, ['Number', value]])), ['?.', null, ['Number', [',', [['.', null, 'x'], 1]]]])
        assertStructurallySame(fromFast(result(['?.()', null, [value]])), ['?.()', null, [[',', [['.', null, 'x'], 1]]]])
        assertStructurallySame(fromFast(result(['()', ['.', ['object', []], 'f'], []])), ['.', ['{}', []], 'f', ['|()', []]])
        assertStructurallySame(fromFast(result(['()', ['block', result(['.', ['object', []], 'f'])], []])), ['()', ['.', ['{}', []], 'f'], []])
        assertStructurallySame(fromFast(result([',', [1, ['.', null, 'x'], 2]])), [',', [['.', null, 'x'], 2]])
    },
    scalarLoops: () => {
        const loop = counting()
        const graph = fromFast(afterLoop(loop, ref(loop.results[0])))
        assertStructurallySame(graph, ['()', ['=>', 1, [], ['?:', ['<', ['arg', 0], 3], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]], [0]])
        assertEq(evaluate(graph), 3)
        const next = counting(ref(loop.results[0]), 5)
        assertStructurallySame(evaluate(fromFast(result(['array', [ref(loop.results[0]), ref(next.results[0])]], [['loop', loop], ['loop', next]]))), [3, 5])
        assertStructurallySame(fromFast(afterLoop(loop, 7)), [',', [graph, 7]])
        assertEq(evaluate(fromFast(result(['if', false, afterLoop(counting(['.', null, 'x']), 1), result(8)]))), 8)
    },
    scalarCaptures: () => {
        const limit = id(12)
        const alias = id(13)
        const loop = counting(0, ['.', ref(alias), 0])
        const graph = fromFast(result(ref(loop.results[0]), [
            ['define', limit, ['array', [3]], 'required'],
            ['define', alias, ref(limit), 'lazy'],
            ['loop', loop],
        ]))
        assertEq(evaluate(graph), 3)
        assertStructurallySame(graph, ['()', ['=>', 1, [['[]', [3]]], ['?:', ['<', ['arg', 0], ['.', ['frame', 0], 0]], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]], [0]])
        const constant = counting(0, ref(alias))
        assertEq(evaluate(fromFast(result(ref(constant.results[0]), [['define', alias, 2, 'lazy'], ['loop', constant]]))), 2)
    },
    scalarStepRegions: () => {
        const loop = counting()
        const statement = /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (loop.body.statements[0])
        const inspected = id(12)
        const step = { ...statement[3], statements: /** @type {readonly Statement[]} */ ([['define', inspected, ['array', [ref(loop.parameters[0])]], 'required']]), exit: /** @type {Block['exit']} */ (['continue', loop.target, [['block', result(['+', ref(loop.parameters[0]), 1])]]]) }
        const asserted = { ...loop, body: { ...loop.body, statements: /** @type {readonly Statement[]} */ ([['if', [], statement[2], step, statement[4]]]) } }
        const graph = fromFast(afterLoop(asserted, ref(loop.results[0])))
        assertEq(evaluate(graph), 3)
        assertStructurallySame(graph, ['()', ['=>', 1, [], ['?:', ['<', ['arg', 0], 3], [',', [['[]', [['arg', 0]]], ['()', ['self'], [['+', ['arg', 0], 1]]]]], ['arg', 0]]], [0]])
        const inner = counting(0, 2)
        const nestedStep = { ...step, statements: /** @type {readonly Statement[]} */ ([['define', inspected, ['block', afterLoop(inner, ref(inner.results[0]))], 'required']]) }
        const nested = { ...loop, body: { ...loop.body, statements: /** @type {readonly Statement[]} */ ([['if', [], statement[2], nestedStep, statement[4]]]) } }
        assertEq(evaluate(fromFast(afterLoop(nested, ref(loop.results[0])))), 3)
    },
    generalLoopState: () => {
        const count = id(0), left = id(0), right = id(0), first = id(0), second = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target, parameters: [count, left, right], initial: [0, 1, 2], results: [first, second],
            body: body(['continue', target, [ref(count), ref(left), ref(right)]], [
                ['if', [], ['<', ref(count), 3],
                    body(['continue', target, [['+', ref(count), 1], ref(right), ref(left)]]),
                    body(['break', target, [ref(left), ref(right)]]),
                ],
            ]),
        })
        assertStructurallySame(evaluate(fromFast(afterLoop(loop, ['array', [ref(first), ref(second)]]))), [2, 1])
        const sum = summing()
        assertStructurallySame(evaluate(fromFast(afterLoop(sum, ['array', sum.results.map(ref)]))), [13, 3])
    },
    generalLoopGraph: () => {
        const left = id(0), right = id(0), output = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target, parameters: [left, right], initial: [1, 2], results: [output],
            body: body(['break', target, [['+', ref(left), ref(right)]]]),
        })
        const argument = /** @type {Exp} */ (['arg', 0])
        const expected = /** @type {Exp} */ (['.', ['()', ['=>', 1, [], ['[]', [['+', ['.', argument, 0], ['.', argument, 1]]]]], [['[]', [1, 2]]]], 0])
        const graph = fromFast(afterLoop(loop, ref(output)))
        assertStructurallySame(assertOk(identityAnalysis(graph)), assertOk(identityAnalysis(expected)))
        assertEq(evaluate(graph), 3)
        const unused = /** @type {Loop} */ ({ ...loop, body: body(['break', target, [ref(left)]]) })
        const withAnchor = /** @type {Exp} */ (['.', ['()', ['=>', 1, [], [',', [
            ['.', argument, 1], ['[]', [['.', argument, 0]]],
        ]]], [['[]', [1, 2]]]], 0])
        const unusedGraph = fromFast(afterLoop(unused, ref(output)))
        assertStructurallySame(assertOk(identityAnalysis(unusedGraph)), assertOk(identityAnalysis(withAnchor)))
        assertEq(evaluate(unusedGraph), 1)
    },
    generalLoopRoundTrips: () => {
        const loop = summing()
        const first = fromFast(afterLoop(loop, ['array', loop.results.map(ref)]))
        const second = fromFast(assertOk(toFast(first)))
        const third = fromFast(assertOk(toFast(second)))
        // Established state-slot reads retain their sharing across conversions.
        assertStructurallySame(assertOk(identityAnalysis(second)), assertOk(identityAnalysis(first)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        assertStructurallySame(evaluate(first), [13, 3])
        assertStructurallySame(evaluate(second), [13, 3])
        assertStructurallySame(evaluate(third), [13, 3])
    },
    generalLoopSignatures: () => {
        for (const length of [0, 1, 3]) {
            const parameter = id(0)
            const results = Array.from({ length }, () => id(0))
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const values = results.map((_, index) => /** @type {Value} */ (['+', ref(parameter), index]))
            const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [4], results, body: body(['break', target, values]) })
            assertStructurallySame(evaluate(fromFast(afterLoop(loop, ['array', results.map(ref)]))), results.map((_, index) => 4 + index))
        }
        const output = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target, parameters: [], initial: [], results: [output], body: body(['break', target, [['array', ['normal', 4]]]]) })
        assertStructurallySame(evaluate(fromFast(afterLoop(loop, ref(output)))), ['normal', 4])
        const parameters = Array.from({ length: 20 }, () => id(0))
        const many = /** @type {Loop} */ ({
            target, parameters, initial: parameters.map((_, index) => index), results: [output],
            body: body(['break', target, [['array', parameters.map(ref)]]]),
        })
        assertStructurallySame(evaluate(fromFast(afterLoop(many, ref(output)))), parameters.map((_, index) => index))
    },
    generalLoopPlacement: () => {
        const first = summing()
        const second = summing(ref(first.results[1]), 5)
        assertStructurallySame(evaluate(fromFast(result(['array', [...first.results.map(ref), ...second.results.map(ref)]], [
            ['loop', first], ['loop', second],
        ]))), [13, 3, 17, 5])
        const failedInitial = summing(['.', null, 'x'])
        const skipped = afterLoop(failedInitial, ref(failedInitial.results[0]))
        assertEq(evaluate(fromFast(result(['if', false, skipped, result(8)]))), 8)
        assertEq(evaluate(fromFast(result(['if', true, result(9), skipped]))), 9)
        assertError(memo(assertOk(identityAnalysis(fromFast(skipped))))({ args: [] }))
        const limit = id(0)
        const failedCapture = summing(0, ['.', ref(limit), 0])
        const captureBranch = result(ref(failedCapture.results[0]), [
            ['define', limit, ['.', null, 'x'], 'required'], ['loop', failedCapture],
        ])
        assertEq(evaluate(fromFast(result(['if', false, captureBranch, result(10)]))), 10)
        assertError(memo(assertOk(identityAnalysis(fromFast(captureBranch))))({ args: [] }))
        const branchResult = id(0)
        assertStructurallySame(evaluate(fromFast(result(['array', [ref(branchResult), 11]], [
            ['if', [branchResult], true, afterLoop(first, ref(first.results[0])), result(12)],
        ]))), [13, 11])
    },
    generalLoopRequiredEvaluations: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const unused = id(0)
        for (const results of [[], [id(0)], [id(0), id(0)]]) {
            const loop = /** @type {Loop} */ ({
                target, parameters: [], initial: [], results,
                body: body(['break', target, results.map(() => 1)], [['define', unused, ['.', null, 'x'], 'required']]),
            })
            assertError(memo(assertOk(identityAnalysis(fromFast(afterLoop(loop, 7)))))({ args: [] }))
        }
        const output = id(0), selected = id(0)
        const loop = /** @type {Loop} */ ({
            target, parameters: [], initial: [], results: [output],
            body: body(['break', target, [ref(selected)]], [
                ['if', [selected], false, result(['.', null, 'x']), result(6)],
                ['define', unused, ['.', null, 'x'], 'lazy'],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(loop, ref(output)))), 6)
        const thrown = /** @type {Loop} */ ({ ...loop, body: body(['throw', 'loop failure']) })
        assertEq(assertError(memo(assertOk(identityAnalysis(fromFast(afterLoop(thrown, 7)))))({ args: [] })), 'loop failure')
    },
    generalLoopCapturesAndIdentity: () => {
        const captured = id(0), established = id(0), output = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target, parameters: [], initial: [], results: [output],
            body: body(['break', target, [ref(captured)]]),
        })
        const graph = fromFast(result(['array', [ref(output), ref(output), ref(established)]], [
            ['define', established, ['array', [4]], 'required'],
            ['define', captured, ref(established), 'lazy'], ['loop', loop],
        ]))
        const value = evaluate(graph)
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertStructurallySame(value[0], [4])
        const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
        const parameter = id(0)
        const own = /** @type {Value} */ (['function', {
            target: nested, parameters: [parameter], rest: null, self: null, captures: [],
            body: body(['return', nested, ref(parameter)]),
        }])
        const called = /** @type {Loop} */ ({ ...loop, body: body(['break', target, [['()', own, [9]]]]) })
        assertEq(evaluate(fromFast(afterLoop(called, ref(output)))), 9)
    },
    generalLoopIterationCaptures: () => {
        const count = id(0), saved = id(0), capture = id(0), output = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', {
            target: nested, parameters: [], rest: null, self: null,
            captures: [{ binding: capture, value: ref(count) }],
            body: body(['return', nested, ref(capture)]),
        }])
        const loop = /** @type {Loop} */ ({
            target, parameters: [count, saved], initial: [0, null], results: [output],
            body: body(['continue', target, [ref(count), ref(saved)]], [
                ['if', [], ['<', ref(count), 3],
                    body(['continue', target, [['+', ref(count), 1], closure]]),
                    body(['break', target, [ref(saved)]]),
                ],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(loop, ['()', ref(output), []]))), 2)
    },
    generalLoopNormalRegions: () => {
        const count = id(0), output = id(0), value = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target, parameters: [count], initial: [0], results: [output],
            body: body(['continue', target, [['+', ref(count), 1]]], [
                ['block', [], body(['yield', []], [
                    ['if', [value], ['<', ref(count), 2], result(ref(count)), body(['break', target, [7]])],
                    ['if', [], ['===', ref(value), 1], body(['break', target, [ref(value)]]), body(['yield', []])],
                ])],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(loop, ref(output)))), 1)
        assertEq(evaluate(fromFast(afterLoop({ ...loop, initial: [2] }, ref(output)))), 7)
    },
    nestedLoopEntryAndCaptures: () => {
        const outerCount = id(0), outerTotal = id(0), output = id(0)
        const innerCount = id(0), innerTotal = id(0), innerResult = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [innerCount, innerTotal], initial: [0, 0], results: [innerResult],
            body: body(['continue', innerTarget, [ref(innerCount), ref(innerTotal)]], [
                ['if', [], ['<', ref(innerCount), ['+', ref(outerCount), 1]],
                    body(['continue', innerTarget, [['+', ref(innerCount), 1], ['+', ref(innerTotal), ref(outerCount)]]]),
                    body(['break', innerTarget, [ref(innerTotal)]]),
                ],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [outerCount, outerTotal], initial: [0, 0], results: [output],
            body: body(['continue', outerTarget, [ref(outerCount), ref(outerTotal)]], [
                ['if', [], ['<', ref(outerCount), 3],
                    body(['continue', outerTarget, [['+', ref(outerCount), 1], ['+', ref(outerTotal), ref(innerResult)]]], [['loop', inner]]),
                    body(['break', outerTarget, [ref(outerTotal)]]),
                ],
            ]),
        })
        // Inner entries are (0, 0) for each outer iteration: 0 + 2 + 6.
        assertEq(evaluate(fromFast(afterLoop(outer, ref(output)))), 8)
    },
    nestedLoopDepthAndRoundTrips: () => {
        for (const depth of [2, 3]) {
            const loop = nestedCounting(depth)
            const first = fromFast(afterLoop(loop, ref(loop.results[0])))
            const second = fromFast(assertOk(toFast(first)))
            const third = fromFast(assertOk(toFast(second)))
            assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
            assertEq(evaluate(first), 2 ** depth)
            assertEq(evaluate(second), 2 ** depth)
            assertEq(evaluate(third), 2 ** depth)
        }
    },
    nestedLoopSequentialResults: () => {
        const count = id(0), total = id(0), output = id(0)
        const first = summing(0, 2)
        const second = summing(ref(first.results[1]), 4)
        const followed = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({
            target, parameters: [count, total], initial: [0, 0], results: [output],
            body: body(['continue', target, [ref(count), ref(total)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', target, [
                    ['+', ref(count), 1], ['+', ref(total), ref(followed)],
                ]], [
                    ['loop', first], ['loop', second],
                    ['define', followed, ['+', ['+', ref(first.results[0]), ref(second.results[0])], 100], 'required'],
                ]), body(['break', target, [ref(total)]])],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(outer, ref(output)))), 378)
        const shared = id(0), completed = id(0)
        const joined = /** @type {Loop} */ ({
            target, parameters: [], initial: [], results: [completed],
            body: body(['break', target, [['array', [ref(shared), ref(shared)]]]], [
                ['loop', first], ['loop', second],
                ['define', shared, ['array', [ref(first.results[0]), ref(second.results[0])]], 'required'],
            ]),
        })
        const value = evaluate(fromFast(afterLoop(joined, ref(completed))))
        assert(value instanceof Array)
        assertEq(value[0], value[1])
        assertStructurallySame(value[0], [11, 15])
    },
    nestedLoopConditionalSetup: () => {
        const limit = id(0), output = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const initialFailure = summing(['.', null, 'x'])
        const captureFailure = summing(0, ['.', ref(limit), 0])
        const outer = /** @type {Loop} */ ({
            target, parameters: [], initial: [], results: [output],
            body: body(['break', target, [7]], [
                ['if', [], false, body(['yield', []], [['loop', initialFailure]]), body(['yield', []])],
                ['if', [], true, body(['yield', []]), body(['yield', []], [
                    ['define', limit, ['.', null, 'x'], 'required'], ['loop', captureFailure],
                ])],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(outer, ref(output)))), 7)
    },
    nestedLoopZeroResultEvaluation: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const output = id(0), failure = id(0)
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['break', innerTarget, []], [['define', failure, ['.', null, 'x'], 'required']]),
        })
        const outer = /** @type {Loop} */ ({
            target, parameters: [], initial: [], results: [output],
            body: body(['break', target, [7]], [['loop', inner]]),
        })
        assertError(memo(assertOk(identityAnalysis(fromFast(afterLoop(outer, ref(output))))))({ args: [] }))
        const normal = /** @type {Loop} */ ({ ...inner, body: body(['break', innerTarget, []]) })
        assertEq(evaluate(fromFast(afterLoop({ ...outer, body: body(['break', target, [7]], [['loop', normal]]) }, ref(output)))), 7)
    },
    nestedLoopIterationLifetimes: () => {
        const count = id(0), saved = id(0), output = id(0)
        const innerCount = id(0), savedFunction = id(0), savedObject = id(0)
        const fnResult = id(0), objectResult = id(0), objectAlias = id(0)
        const capturedOuter = id(0), capturedInner = id(0)
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const fnTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', {
            target: fnTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: capturedOuter, value: ref(count) }, { binding: capturedInner, value: ref(innerCount) }],
            body: body(['return', fnTarget, ['array', [ref(capturedOuter), ref(capturedInner)]]]),
        }])
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [innerCount, savedFunction, savedObject], initial: [0, null, null], results: [fnResult, objectResult, objectAlias],
            body: body(['continue', innerTarget, [ref(innerCount), ref(savedFunction), ref(savedObject)]], [
                ['if', [], ['<', ref(innerCount), 2],
                    body(['continue', innerTarget, [['+', ref(innerCount), 1], closure, ['array', [ref(count), ref(innerCount)]]]]),
                    body(['break', innerTarget, [ref(savedFunction), ref(savedObject), ref(savedObject)]]),
                ],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target, parameters: [count, saved], initial: [0, ['array', []]], results: [output],
            body: body(['continue', target, [ref(count), ref(saved)]], [
                ['if', [], ['<', ref(count), 3],
                    body(['continue', target, [['+', ref(count), 1], ['array', [
                        ['...', ref(saved)], ['array', [ref(fnResult), ref(objectResult), ref(objectAlias)]],
                    ]]]], [['loop', inner]]), body(['break', target, [ref(saved)]])],
            ]),
        })
        /** @type {(iteration: number, slot: number) => Value} */
        const entry = (iteration, slot) => ['.', ['.', ref(output), iteration], slot]
        const value = evaluate(fromFast(afterLoop(outer, ['array', [
            ['()', entry(0, 0), []], ['()', entry(1, 0), []], ['()', entry(2, 0), []],
            entry(0, 1), entry(0, 2), entry(1, 1), entry(1, 2), entry(2, 1),
        ]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[0, 1], [1, 1], [2, 1], [0, 1], [0, 1], [1, 1], [1, 1], [2, 1]])
        assertEq(value[3], value[4])
        assertEq(value[5], value[6])
        assert(value[3] !== value[5])
        assert(value[5] !== value[7])
    },
    loopReturnsFromIterations: () => {
        const count = id(0), output = id(0), failed = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const stop of [0, 3]) {
            const loop = /** @type {Loop} */ ({
                target: loopTarget, parameters: [count], initial: [0], results: [output],
                body: body(['break', loopTarget, [ref(count)]], [
                    ['if', [], ['===', ref(count), stop], body(['return', target, ['+', ref(count), 100]]), body(['yield', []])],
                    ['if', [], ['<', ref(count), 3], body(['continue', loopTarget, [['+', ref(count), 1]]]), body(['yield', []])],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', loop], ['define', failed, ['.', null, 'x'], 'required']]),
            })
            assertEq(evaluate(calledFunction(fn)), stop + 100)
        }
    },
    loopReturnsSequentially: () => {
        const choice = id(0), failed = id(0)
        const first = returningLoop(ref(choice), 11)
        const second = returningLoop(true, 22)
        const neverEntered = summing(['.', null, 'x'])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, 99], [
                ['loop', first], ['loop', second], ['loop', neverEntered], ['define', failed, ['.', null, 'x'], 'required'],
            ]),
        })
        assertEq(evaluate(calledFunction(fn, [true])), 11)
        assertEq(evaluate(calledFunction(fn, [false])), 22)
    },
    loopReturnNormalSignatures: () => {
        const choice = id(0), followed = id(0)
        for (const length of [0, 1, 3]) {
            const values = Array.from({ length }, (_, index) => index + 4)
            const loop = returningLoop(ref(choice), 7, values)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [choice], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(followed), ref(followed)]]], [
                    ['loop', loop], ['define', followed, ['array', loop.results.map(ref)], 'required'],
                ]),
            })
            assertEq(evaluate(calledFunction(fn, [true])), 7)
            const value = evaluate(calledFunction(fn, [false]))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assertStructurallySame(value[0], values)
        }
    },
    loopReturnsThroughStatementRegions: () => {
        const choice = id(0), selected = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [ref(selected)]], [
                ['block', [selected], body(['yield', [5]], [
                    ['if', [], ['block', result(ref(choice))], body(['yield', []]), body(['return', target, 7])],
                ])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, ['+', ref(output), 10]], [['loop', loop]]),
        })
        assertEq(evaluate(calledFunction(fn, [false])), 7)
        assertEq(evaluate(calledFunction(fn, [true])), 15)
    },
    loopReturnsThroughNestedHelpers: () => {
        const count = id(0), outerResult = id(0), failed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const depth of [2, 3]) {
            let inner = returningLoop(['===', ref(count), 1], ['array', [ref(count), 5]])
            for (let level = 2; level < depth; ++level) {
                const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
                inner = /** @type {Loop} */ ({
                    target: loopTarget, parameters: [], initial: [], results: [],
                    body: body(['break', loopTarget, []], [['loop', inner]]),
                })
            }
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [count], initial: [0], results: [outerResult],
                body: body(['continue', outerTarget, [['+', ref(count), 1]]], [['loop', inner]]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', outer], ['define', failed, ['.', null, 'x'], 'required']]),
            })
            assertStructurallySame(evaluate(calledFunction(fn)), [1, 5])
        }
    },
    loopReturnsKeepSourceFunctionOwnership: () => {
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const failed = id(0)
        const nestedLoop = returningLoop(true, 8, [], nestedTarget)
        const nested = /** @type {FastFunction} */ ({
            target: nestedTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', nestedTarget, 99], [['loop', nestedLoop], ['define', failed, ['.', null, 'x'], 'required']]),
        })
        const loop = returningLoop(false, 7, [['()', ['function', nested], []]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ['+', ref(loop.results[0]), 1]], [['loop', loop]]),
        })
        assertEq(evaluate(calledFunction(fn)), 9)
    },
    loopReturnTagShapedPayloads: () => {
        const choice = id(0)
        for (const tag of ['normal', 'return']) {
            const payload = /** @type {Value} */ (['array', [tag, ['array', [4]]]])
            const loop = returningLoop(ref(choice), payload, [payload])
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [choice], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(loop.results[0])]]], [['loop', loop]]),
            })
            assertStructurallySame(evaluate(calledFunction(fn, [true])), [tag, [4]])
            assertStructurallySame(evaluate(calledFunction(fn, [false])), [[tag, [4]]])
        }
    },
    loopReturnFailures: () => {
        const choice = id(0), failed = id(0)
        const loop = returningLoop(ref(choice), ['.', null, 'x'])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [['loop', loop]]),
        })
        assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [true]))))({ args: [] }))
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        const throwing = /** @type {Loop} */ ({
            ...loop, body: body(['break', loop.target, []], [
                ['if', [], ref(choice), body(['return', target, 7]), body(['throw', 'loop failure'])],
            ]),
        })
        const throws = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, 9], [['loop', throwing]]) })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(throws, [false]))))({ args: [] })), 'loop failure')
        assertEq(evaluate(calledFunction(throws, [true])), 7)
        const required = /** @type {Loop} */ ({
            ...loop, body: body(['return', target, 7], [['define', failed, ['.', null, 'x'], 'required']]),
        })
        const established = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, 9], [['loop', required]]) })
        assertError(memo(assertOk(identityAnalysis(calledFunction(established, [true]))))({ args: [] }))
    },
    loopReturnGraph: () => {
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [], initial: [], results: [],
            body: body(['return', target, 7]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [['loop', loop]]),
        })
        // The private completion occupies the helper's one result slot.
        // Only its caller unwraps it into the public function result.
        const call = /** @type {Exp} */ (['()', ['=>', 1, [], ['[]', [['[]', ['return', 7]]]]], [['[]', []]]])
        const completion = /** @type {Exp} */ (['.', call, 0])
        // The eager completion test already establishes the required call.
        const expected = /** @type {Exp} */ (['=>', 0, [], ['?:',
            ['===', ['.', completion, 0], 'return'], ['.', completion, 1], 9,
        ]])
        const graph = fromFast(result(['function', fn]))
        assertStructurallySame(assertOk(identityAnalysis(graph)), assertOk(identityAnalysis(expected)))
        assertEq(evaluate(calledFunction(fn)), 7)
    },
    loopReturnRoundTrips: () => {
        const choice = id(0)
        const loop = returningLoop(ref(choice), ['array', ['return', 7]], [3, 4])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [choice], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', loop.results.map(ref)]], [['loop', loop]]),
        })
        for (const selected of [false, true]) {
            const first = calledFunction(fn, [selected])
            const second = fromFast(assertOk(toFast(first)))
            const third = fromFast(assertOk(toFast(second)))
            assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
            const expected = selected ? /** @type {const} */ (['return', 7]) : /** @type {const} */ ([3, 4])
            assertStructurallySame(evaluate(first), expected)
            assertStructurallySame(evaluate(second), expected)
            assertStructurallySame(evaluate(third), expected)
        }
    },
    loopReturnCanonicalRootIdentity: () => {
        const argument = id(0), state = id(0), output = id(0), self = id(0), capture = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = returningLoop(['===', ref(state), 1], ref(self))
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [state], initial: [ref(argument)], results: [output],
            body: body(['continue', loopTarget, [ref(state)]], [
                ['if', [], ['<', ref(state), 2],
                    body(['continue', loopTarget, [['+', ref(state), 1]]], [['loop', inner]]),
                    body(['break', loopTarget, [ref(state)]]),
                ],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [argument], rest: null, self, captures: [{ binding: capture, value: ['array', [4]] }],
            body: body(['return', target, ref(output)], [['loop', loop]]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 1)
        assertEq(graph[2].length, 1)
        const analysis = assertOk(identityAnalysis(graph))
        const root = analysis.root
        assert(root instanceof Array)
        assert(analysis.nodes.some((node, index) => node[0] === '()' && node[1] instanceof Array
            && analysis.nodes[node[1][1]][0] === 'self' && analysis.scope[index] === root[1]))
        const bound = id(0)
        assertEq(evaluate(fromFast(result(['===', ['()', ref(bound), [0]], ref(bound)], [['define', bound, ['function', fn], 'required']]))), true)
        assertEq(evaluate(calledFunction(fn, [3])), 3)
    },
    nestedOuterContinueScalarState: () => {
        const state = id(0), output = id(0), failed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['continue', outerTarget, [['+', ref(state), 1]]]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [state], initial: [0], results: [output],
            body: body(['continue', outerTarget, [ref(state)]], [
                ['if', [], ['<', ref(state), 4], body(['continue', outerTarget, [ref(state)]], [
                    ['loop', inner], ['define', failed, ['.', null, 'x'], 'required'],
                ]), body(['break', outerTarget, [ref(state)]])],
            ]),
        })
        assertEq(evaluate(fromFast(afterLoop(outer, ref(output)))), 4)
        const region = afterLoop(outer, ref(output))
        assertEq(evaluate(anchored(lowerValue(['block', region], []))), 4)
        assertEq(evaluate(anchored(lowerValue(['if', true, region, result(7)], []))), 4)
        assertEq(evaluate(anchored(lowerValue(['if', false, result(8), region], []))), 4)
        const next = counting(ref(output), 6)
        assertStructurallySame(evaluate(fromFast(result(['array', [ref(output), ref(next.results[0])]], [
            ['loop', outer], ['loop', next],
        ]))), [4, 6])
    },
    nestedOuterContinueSimultaneousState: () => {
        const count = id(0), left = id(0), right = id(0), total = id(0)
        const first = id(0), second = id(0), sum = id(0), failed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['continue', outerTarget, [['+', ref(count), 1], ref(right), ref(left), ['+', ref(total), ref(count)]]]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, left, right, total], initial: [0, 1, 2, 10], results: [first, second, sum],
            body: body(['continue', outerTarget, [ref(count), ref(left), ref(right), ref(total)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', outerTarget, [ref(count), ref(left), ref(right), ref(total)]], [
                    ['loop', inner], ['define', failed, ['.', null, 'x'], 'required'],
                ]), body(['break', outerTarget, [ref(left), ref(right), ref(total)]])],
            ]),
        })
        assertStructurallySame(evaluate(fromFast(afterLoop(outer, ['array', outer.results.map(ref)]))), [2, 1, 13])
    },
    nestedOuterBreakResultSignatures: () => {
        const state = id(0), failed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const length of [0, 1, 3]) {
            const outputs = Array.from({ length }, () => id(0))
            const values = outputs.map((_, index) => /** @type {Value} */ (['array', [index === 0 ? 'continue' : 'break', index]]))
            const inner = /** @type {Loop} */ ({
                target: innerTarget, parameters: [], initial: [], results: [],
                body: body(['break', outerTarget, values]),
            })
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [state], initial: [5], results: outputs,
                body: body(['continue', outerTarget, [ref(state)]], [['loop', inner], ['define', failed, ['.', null, 'x'], 'required']]),
            })
            const expected = outputs.map((_, index) => /** @type {const} */ ([index === 0 ? 'continue' : 'break', index]))
            assertStructurallySame(evaluate(fromFast(afterLoop(outer, ['array', outputs.map(ref)]))), expected)
            assertStructurallySame(evaluate(anchored(lowerValue(['block', afterLoop(outer, ['array', outputs.map(ref)])], []))), expected)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', outputs.map(ref)]], [['loop', outer]]),
            })
            assertStructurallySame(evaluate(calledFunction(fn)), expected)
        }
    },
    nestedOuterTransferTargetIdentity: () => {
        const count = id(0), total = id(0), middleState = id(0), middleResult = id(0), output = id(0), failed = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const middleTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['break', innerTarget, []], [
                ['if', [], ['===', ref(middleState), ref(count)], body(['continue', middleTarget, [['+', ref(middleState), 1]]]), body(['yield', []])],
                ['if', [], ['===', ref(count), 0], body(['continue', outerTarget, [['+', ref(count), 1], ['+', ref(total), 10]]]), body(['yield', []])],
                ['if', [], ['===', ref(count), 1], body(['break', middleTarget, [['+', ref(middleState), 5]]]), body(['break', outerTarget, [['+', ref(total), 100]]])],
            ]),
        })
        const middle = /** @type {Loop} */ ({
            target: middleTarget, parameters: [middleState], initial: [ref(count)], results: [middleResult],
            body: body(['continue', middleTarget, [ref(middleState)]], [
                ['if', [], ['<', ref(middleState), ['+', ref(count), 2]], body(['continue', middleTarget, [ref(middleState)]], [
                    ['loop', inner], ['define', failed, ['.', null, 'x'], 'required'],
                ]), body(['break', middleTarget, [99]])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, total], initial: [0, 0], results: [output],
            body: body(['continue', outerTarget, [ref(count), ref(total)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', outerTarget, [['+', ref(count), 1], ['+', ref(total), ref(middleResult)]]], [
                    ['loop', middle],
                ]), body(['break', outerTarget, [ref(total)]])],
            ]),
        })
        const first = fromFast(afterLoop(outer, ref(output)))
        const second = fromFast(assertOk(toFast(first)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        assertEq(evaluate(first), 117)
        assertEq(evaluate(second), 117)
        assertEq(evaluate(third), 117)
    },
    nestedOuterMixedCompletions: () => {
        const mode = id(0), state = id(0), innerResult = id(0), output = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerResult],
            body: body(['break', innerTarget, [['+', ref(state), 10]]], [
                ['if', [], ['===', ref(mode), 0], body(['return', target, ['array', ['return', 7]]]), body(['yield', []])],
                ['if', [], ['===', ref(mode), 1], body(['break', outerTarget, [['array', ['normal', 8]]]]), body(['yield', []])],
                ['if', [], ['===', ref(mode), 2], body(['continue', outerTarget, [['+', ref(state), 1]]]), body(['yield', []])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [state], initial: [0], results: [output],
            body: body(['continue', outerTarget, [ref(state)]], [
                ['if', [], ['<', ref(state), 2], body(['break', outerTarget, [ref(innerResult)]], [['loop', inner]]), body(['break', outerTarget, [99]])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [mode], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(output)]]], [['loop', outer]]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [0])), ['return', 7])
        const broken = evaluate(calledFunction(fn, [1]))
        assert(broken instanceof Array)
        assertEq(broken[0], broken[1])
        assertStructurallySame(broken[0], ['normal', 8])
        assertStructurallySame(evaluate(calledFunction(fn, [2])), [99, 99])
        assertStructurallySame(evaluate(calledFunction(fn, [3])), [10, 10])
    },
    nestedOuterUnselectedTransfers: () => {
        const state = id(0), output = id(0), innerResult = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [innerResult],
            body: body(['break', innerTarget, [3]], [
                ['if', [], false, body(['break', outerTarget, [['.', null, 'x']]]), body(['yield', []])],
                ['if', [], true, body(['break', innerTarget, [3]]), body(['continue', outerTarget, [['.', null, 'x']]])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [state], initial: [0], results: [output],
            body: body(['break', outerTarget, [['+', ref(innerResult), 1]]], [['loop', inner]]),
        })
        assertEq(evaluate(fromFast(afterLoop(outer, ref(output)))), 4)
    },
    nestedOuterIterationLifetimes: () => {
        const count = id(0), saved = id(0), output = id(0), object = id(0), captured = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const fnTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', {
            target: fnTarget, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(object) }], body: body(['return', fnTarget, ref(captured)]),
        }])
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['continue', outerTarget, [['+', ref(count), 1], ['array', [
                ['...', ref(saved)], ['array', [closure, ref(object), ref(object)]],
            ]]]], [['define', object, ['array', [ref(count)]], 'required']]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [count, saved], initial: [0, ['array', []]], results: [output],
            body: body(['continue', outerTarget, [ref(count), ref(saved)]], [
                ['if', [], ['<', ref(count), 3], body(['continue', outerTarget, [ref(count), ref(saved)]], [['loop', inner]]), body(['break', outerTarget, [ref(saved)]])],
            ]),
        })
        /** @type {(iteration: number, slot: number) => Value} */
        const entry = (iteration, slot) => ['.', ['.', ref(output), iteration], slot]
        const value = evaluate(fromFast(afterLoop(outer, ['array', [
            ['()', entry(0, 0), []], ['()', entry(1, 0), []], entry(0, 1), entry(0, 2), entry(1, 1), entry(2, 1),
        ]])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[0], [1], [0], [0], [1], [2]])
        assertEq(value[0], value[2])
        assertEq(value[0], value[3])
        assertEq(value[1], value[4])
        assert(value[2] !== value[4])
        assert(value[4] !== value[5])
    },
    nestedOuterCanonicalRoot: () => {
        const argument = id(0), state = id(0), output = id(0), self = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['break', outerTarget, [ref(self)]], [
                ['if', [], ['<', ref(state), 3], body(['continue', outerTarget, [['+', ref(state), 1]]]), body(['yield', []])],
            ]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [state], initial: [ref(argument)], results: [output],
            body: body(['continue', outerTarget, [ref(state)]], [
                ['if', [], ['<', ref(state), 4], body(['continue', outerTarget, [ref(state)]], [['loop', inner]]), body(['break', outerTarget, [ref(state)]])],
            ]),
        })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [argument], rest: null, self, captures: [],
            body: body(['return', target, ref(output)], [['loop', outer]]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 1)
        const analysis = assertOk(identityAnalysis(graph))
        const root = analysis.root
        assert(root instanceof Array)
        assert(analysis.nodes.some((node, index) => node[0] === '()' && node[1] instanceof Array
            && analysis.nodes[node[1][1]][0] === 'self' && analysis.scope[index] === root[1]))
        const bound = id(0)
        assertEq(evaluate(fromFast(result(['===', ['()', ref(bound), [0]], ref(bound)], [['define', bound, ['function', fn], 'required']]))), true)
        assertEq(evaluate(calledFunction(fn, [7])), 7)
    },
    sharedFunctionJoinGrowth: () => {
        const factoryTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const factory = /** @type {Value} */ (['function', {
            target: factoryTarget, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', factoryTarget, ['array', [4]]]),
        }])
        const sizes = [4, 8, 12].map(length => {
            const fn = mixedJoinFunction(length)
            const normalized = completeTransfers(fn, null)
            assert(normalized !== fn)
            const graph = fromFast(result(['function', fn]))
            const analysis = assertOk(identityAnalysis(graph))
            const root = analysis.root
            assert(root instanceof Array)
            const calls = analysis.nodes.flatMap((node, index) => node[0] === '()' && node[1] instanceof Array
                && analysis.nodes[node[1][1]][0] === 'arg' && analysis.nodes[node[1][1]][1] === 3
                && analysis.scope[index] === root[1] ? [index] : [])
            assertEq(calls.length, 1)
            const allocations = analysis.nodes.flatMap((node, index) => node[0] === '[]' && node[1].length === 1
                && node[1][0] instanceof Array && node[1][0][0] === '#' && node[1][0][1] === calls[0] ? [index] : [])
            assertEq(allocations.length, 1)
            assertEq(analysis.scope[allocations[0]], root[1])
            assert(analysis.shared.includes(allocations[0]))
            // The original function and its real loop helper are the only functions.
            assertEq(analysis.nodes.filter(node => node[0] === '=>').length, 2)
            assert(analysis.nodes.length < length * 40 + 40)
            const value = evaluate(calledFunction(fn, [true, false, false, factory, false]))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            assert(value[0] instanceof Array)
            assertEq(value[0][0], value[2])
            assertStructurallySame(value, [[[4]], [[4]], [4]])
            return { nodes: analysis.nodes.length, fast: JSON.stringify(normalized).length }
        })
        assert(sizes[2].nodes - sizes[1].nodes <= sizes[1].nodes - sizes[0].nodes)
        assert(sizes[2].fast - sizes[1].fast <= sizes[1].fast - sizes[0].fast)
    },
    sharedFunctionJoinSelectedReturns: () => {
        const fn = mixedJoinFunction(8)
        const failedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const failed = /** @type {Value} */ (['function', {
            target: failedTarget, parameters: [], rest: null, self: null, captures: [], body: body(['throw', 'suffix reached']),
        }])
        assertEq(evaluate(calledFunction(fn, [true, true, false, failed, false])), 50)
        assertEq(evaluate(calledFunction(fn, [false, false, true, failed, false])), 60)
        assertEq(evaluate(calledFunction(fn, [true, false, false, failed, true])), 77)
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [false, false, false, failed, false]))))({ args: [] })), 'suffix reached')
        const selected = id(0), unreachable = id(0)
        const terminal = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, 0], [
                ['if', [], ref(selected), body(['return', target, 3]), body(['return', target, 4])],
                ['define', unreachable, ['.', null, 'x'], 'required'],
            ]),
        })
        assertEq(evaluate(calledFunction(terminal, [true])), 3)
        assertEq(evaluate(calledFunction(terminal, [false])), 4)
    },
    sharedFunctionJoinNormalSignatures: () => {
        const selected = id(0), stop = id(0), followed = id(0)
        for (const length of [0, 1, 3]) {
            const bindings = Array.from({ length }, () => id(0))
            const left = bindings.map((_, index) => index + 4)
            const right = bindings.map((_, index) => index + 8)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected, stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(followed), ref(followed)]]], [
                    ['if', bindings, ref(selected),
                        body(['yield', left], [['if', [], ref(stop), body(['return', target, 77]), body(['yield', []])]]),
                        body(['yield', right], [['if', [], ref(stop), body(['return', target, 88]), body(['yield', []])]]),
                    ],
                    ['define', followed, ['array', bindings.map(ref)], 'required'],
                ]),
            })
            for (const branch of [false, true]) {
                assertEq(evaluate(calledFunction(fn, [branch, true])), branch ? 77 : 88)
                const value = evaluate(calledFunction(fn, [branch, false]))
                assert(value instanceof Array)
                assertEq(value[0], value[1])
                assertStructurallySame(value[0], branch ? left : right)
            }
            const yielded = /** @type {FastFunction} */ ({ ...fn, body: body(['yield', left], [
                ['if', [], ref(stop), body(['return', target, 99]), body(['yield', []])],
            ]) })
            assertStructurallySame(evaluate(calledFunction(yielded, [false, false])), length === 1 ? left[0] : left)
            assertEq(evaluate(calledFunction(yielded, [false, true])), 99)
        }
        const thrown = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [], body: body(['throw', 'failure']),
        })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(thrown))))({ args: [] })), 'failure')
    },
    sharedFunctionJoinEvaluationRegions: () => {
        const selected = id(0), stop = id(0), lazy = id(0), failed = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected, stop], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [
                ['if', [], ref(selected), body(['yield', []], [
                    ['define', lazy, ['block', body(['throw', 'lazy'])], 'lazy'],
                    ['if', [], ref(stop), body(['return', target, 7]), body(['yield', []])],
                ]), body(['return', target, 8], [['define', failed, ['block', body(['throw', 'prefix'])], 'required']])],
            ]),
        })
        assertEq(evaluate(calledFunction(fn, [true, true])), 7)
        assertEq(evaluate(calledFunction(fn, [true, false])), 9)
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [false, true]))))({ args: [] })), 'prefix')
        const condition = /** @type {Value} */ (['block', result(true, [['define', failed, ['block', body(['throw', 'condition'])], 'required']])])
        const tested = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, 9], [
            ['if', [], condition, body(['return', target, 7]), body(['yield', []])],
        ]) })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(tested, [true, true]))))({ args: [] })), 'condition')
        const prefixed = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, 9], [
            ['define', failed, ['block', body(['throw', 'entry'])], 'required'],
            ['if', [], true, body(['return', target, 7]), body(['yield', []])],
        ]) })
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(prefixed, [true, true]))))({ args: [] })), 'entry')
    },
    sharedFunctionJoinOrdinaryRegions: () => {
        const selected = id(0), stop = id(0), first = id(0), second = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected, stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second)]]], [
                ['block', [first], body(['yield', [3]])],
                ['if', [second], ref(selected), body(['yield', [['+', ref(first), 1]]]), body(['yield', [['+', ref(first), 2]]])],
                ['if', [], ref(stop), body(['return', target, 7]), body(['yield', []])],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [true, false])), [3, 4])
        assertStructurallySame(evaluate(calledFunction(fn, [false, false])), [3, 5])
        assertEq(evaluate(calledFunction(fn, [true, true])), 7)
    },
    sharedFunctionJoinGuardDependencies: () => {
        const state = id(0), first = id(0), second = id(0), alias = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [state], rest: null, self: null, captures: [],
            body: body(['return', target, 9], [
                ['define', first, ['.', ref(state), 0], 'required'],
                ['define', second, ['.', ref(state), 1], 'required'],
                ['define', alias, ref(first), 'lazy'],
                ['if', [], ['<', ref(alias), 3], body(['return', target, ref(first)]), body(['return', target, ref(second)])],
            ]),
        })
        const argument = /** @type {Exp} */ (['arg', 0])
        const left = /** @type {Exp} */ (['.', argument, 0])
        const right = /** @type {Exp} */ (['.', argument, 1])
        const expected = /** @type {Exp} */ (['=>', 1, [], [',', [right, ['?:', ['<', left, 3], left, right]]]])
        const graph = fromFast(result(['function', fn]))
        assertStructurallySame(assertOk(identityAnalysis(graph)), assertOk(identityAnalysis(expected)))
        assertStructurallySame(assertOk(identityAnalysis(fromFast(assertOk(toFast(graph))))), assertOk(identityAnalysis(graph)))
        assertEq(evaluate(calledFunction(fn, [['array', [1, 2]]])), 1)
        assertEq(evaluate(calledFunction(fn, [['array', [5, 6]]])), 6)
    },
    sharedFunctionJoinRequiredPrefixes: () => {
        const selected = id(0), operation = id(0), established = id(0), dead = id(0)
        const failed = /** @type {Value} */ (['function', {
            target, parameters: [], rest: null, self: null, captures: [], body: body(['throw', 'required prefix']),
        }])
        const succeeded = /** @type {Value} */ (['function', {
            target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, ['array', [5]]]),
        }])
        for (const partial of [false, true]) {
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected, operation], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', [ref(established), ref(established)]]], [
                    ['define', established, ['()', ref(operation), []], 'required'],
                    ['if', [], ref(selected), body(['return', target, 3]), body(partial ? ['yield', []] : ['return', target, 4])],
                ]),
            })
            for (const choice of [false, true]) {
                assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [choice, failed]))))({ args: [] })), 'required prefix')
                const evaluated = evaluate(calledFunction(fn, [choice, succeeded]))
                if (choice || !partial) { assertEq(evaluated, choice ? 3 : 4) }
                else {
                    assert(evaluated instanceof Array)
                    assertEq(evaluated[0], evaluated[1])
                    assertStructurallySame(evaluated[0], [5])
                }
            }
            const skipped = /** @type {FastFunction} */ ({ ...fn, body: body(['return', target, 9], [
                ...fn.body.statements,
                ['define', dead, ['array', [ref(established)]], 'required'],
            ]) })
            assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(skipped, [true, failed]))))({ args: [] })), 'required prefix')
            assertEq(evaluate(calledFunction(skipped, [true, succeeded])), 3)
        }
    },
    sharedFunctionJoinRequiredLoopPrefix: () => {
        const selected = id(0)
        const loop = summing(['block', body(['throw', 'required loop'])])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ref(loop.results[0])], [
                ['loop', loop],
                ['if', [], ref(selected), body(['return', target, 3]), body(['yield', []])],
            ]),
        })
        for (const choice of [false, true]) {
            assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [choice]))))({ args: [] })), 'required loop')
        }
    },
    sharedFunctionJoinTerminalThrows: () => {
        const selected = id(0), missing = id(0)
        const thrown = /** @type {Block} */ (body(['throw', 'selected throw']))
        const region = /** @type {Block} */ (body(['return', target, ref(missing)], [
            ['block', [], thrown],
            ['define', missing, ref(id(0)), 'required'],
        ]))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ref(missing)], [
                ['if', [], ref(selected), region, body(['throw', 'other throw'])],
            ]),
        })
        for (const choice of [false, true]) {
            assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [choice]))))({ args: [] })), choice ? 'selected throw' : 'other throw')
        }
    },
    sharedFunctionJoinTerminalSelfCall: () => {
        const count = id(0), value = id(0), rest = id(0), self = id(0), captured = id(0), normal = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [count, value], rest, self,
            captures: [{ binding: captured, value: ['array', ['capture']] }],
            body: body(['return', target, ['array', [ref(normal), ref(captured), ref(rest)]]], [
                ['block', [normal], body(['yield', [ref(value)]], [
                    ['if', [], ['>', ref(count), 0], body(['return', target, ['()', ref(self), [
                        ['-', ref(count), 1], ['+', ref(value), 1], ref(captured), 42,
                    ]]]), body(['yield', []])],
                ])],
            ]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        assertEq(graph[1], 2)
        assertEq(graph[2].length, 1)
        const analysis = assertOk(identityAnalysis(graph))
        const root = analysis.root
        assert(root instanceof Array)
        const calls = analysis.nodes.flatMap((node, index) => node[0] === '()' && node[1] instanceof Array
            && analysis.nodes[node[1][1]][0] === 'self' && analysis.scope[index] === root[1] ? [index] : [])
        assertEq(calls.length, 1)
        const call = analysis.nodes[calls[0]]
        assert(call[0] === '()')
        assertEq(call[2].length, 4)
        assert(analysis.nodes.some(node => node[0] === '?:' && ((node[2] instanceof Array && node[2][1] === calls[0])
            || (node[3] instanceof Array && node[3][1] === calls[0]))))
        assert(!analysis.nodes.some(node => node[0] === '[]' && node[1].some(item => item instanceof Array && item[0] === '#' && item[1] === calls[0])))
        assertEq(analysis.nodes.filter(node => node[0] === '=>').length, 1)
        const evaluated = evaluate(calledFunction(fn, [1, 5, 99]))
        assert(evaluated instanceof Array && evaluated[2] instanceof Array)
        assertStructurallySame(evaluated, [6, ['capture'], [['capture'], 42]])
        assertEq(evaluated[1], evaluated[2][0])
    },
    sharedFunctionJoinNestedFunction: () => {
        const selected = id(0), nestedValue = id(0)
        const nestedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const nested = /** @type {Value} */ (['function', {
            target: nestedTarget, parameters: [], rest: null, self: null, captures: [], body: body(['return', nestedTarget, 9]),
        }])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [selected], rest: null, self: null, captures: [],
            body: body(['return', target, ['()', ref(nestedValue), []]], [
                ['if', [], ref(selected), body(['return', target, 11]), body(['yield', []])],
                ['define', nestedValue, nested, 'required'],
            ]),
        })
        assertEq(evaluate(calledFunction(fn, [true])), 11)
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        const first = calledFunction(fn, [false])
        const second = fromFast(assertOk(toFast(first)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        assertEq(evaluate(third), 9)
    },
    sharedFunctionJoinDeepStatements: () => {
        /** @type {Block} */
        let nested = body(['yield', []])
        for (let depth = 0; depth < 20_000; ++depth) {
            nested = body(['yield', []], [['if', [], false, body(['return', target, 9]), nested]])
        }
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, 7], [['block', [], nested]]),
        })
        const graph = fromFast(result(['function', fn]))
        assert(graph instanceof Array && graph[0] === '=>')
        let exp = graph[3]
        for (let depth = 0; depth < 20_000; ++depth) {
            assert(exp instanceof Array && exp[0] === '?:')
            assertEq(exp[1], false)
            assertEq(exp[2], 9)
            exp = exp[3]
        }
        assertEq(exp, 7)
    },
    sharedRootJoinGrowth: () => {
        const factoryTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const args = Array.from({ length: 3 }, () => id(0))
        const factory = /** @type {Value} */ (['function', {
            target: factoryTarget, parameters: args, rest: null, self: null, captures: [],
            body: body(['return', factoryTarget, ['array', args.map(ref)]]),
        }])
        const sizes = [4, 8, 12].map(length => {
            const fn = rootJoinFunction(length)
            const loop = invocationRootOf(fn)
            assert(loop !== null)
            const normalized = directInvocationRoot(fn, loop)
            const graph = fromFast(result(['function', fn]))
            assert(graph instanceof Array && graph[0] === '=>')
            assertEq(graph[1], 7)
            assertEq(graph[2].length, 1)
            const analysis = assertOk(identityAnalysis(graph))
            const root = analysis.root
            assert(root instanceof Array)
            const calls = analysis.nodes.flatMap((node, index) => node[0] === '()' && node[1] instanceof Array
                && analysis.nodes[node[1][1]][0] === 'arg' && analysis.nodes[node[1][1]][1] === 4
                && analysis.scope[index] === root[1] ? [index] : [])
            assertEq(calls.length, 1)
            const allocations = analysis.nodes.flatMap((node, index) => node[0] === '[]' && node[1].length === 2
                && node[1][0] instanceof Array && node[1][0][0] === '#' && node[1][0][1] === calls[0] ? [index] : [])
            assertEq(allocations.length, 1)
            assertEq(analysis.scope[allocations[0]], root[1])
            assert(analysis.shared.includes(allocations[0]))
            const results = analysis.nodes.flatMap((node, index) => node[0] === '[]' && node[1].length === 4
                && node[1][0] instanceof Array && node[1][0][0] === '#' && node[1][0][1] === allocations[0]
                && node[1][1] instanceof Array && node[1][1][0] === '#' && node[1][1][1] === allocations[0] ? [index] : [])
            assertEq(results.length, 1)
            const requiredResults = analysis.nodes.flatMap((node, index) => {
                if (node[0] !== ',') { return [] }
                const last = node[1].at(-1)
                return last instanceof Array && last[0] === '#' && last[1] === results[0] ? [index] : []
            })
            assert(analysis.nodes.some(node => node[0] === '?:' && ((node[2] instanceof Array && (node[2][1] === results[0] || requiredResults.includes(node[2][1])))
                || (node[3] instanceof Array && (node[3][1] === results[0] || requiredResults.includes(node[3][1]))))))
            assert(!analysis.nodes.some(node => node[0] === '[]' && node[1].some(item => item instanceof Array && item[0] === '#' && item[1] === results[0])))
            const selfCalls = analysis.nodes.flatMap((node, index) => node[0] === '()' && node[1] instanceof Array
                && analysis.nodes[node[1][1]][0] === 'self' && analysis.scope[index] === root[1] ? [index] : [])
            assertEq(selfCalls.length, 1)
            const call = analysis.nodes[selfCalls[0]]
            assert(call[0] === '()')
            assertEq(call[2].length, 7)
            assert(analysis.nodes.some(node => node[0] === '?:' && ((node[2] instanceof Array && node[2][1] === selfCalls[0])
                || (node[3] instanceof Array && node[3][1] === selfCalls[0]))))
            assert(!analysis.nodes.some(node => node[0] === '[]' && node[1].some(item => item instanceof Array && item[0] === '#' && item[1] === selfCalls[0])))
            assertEq(analysis.nodes.filter(node => node[0] === '=>').length, 1)
            assert(analysis.nodes.length < length * 40 + 80)
            const value = evaluate(calledFunction(fn, [1, true, false, false, factory, 1, 2]))
            assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array)
            assertEq(value[0], value[1])
            assertEq(value[0][0], value[2])
            assertEq(value[0][1], value[3])
            assertEq(value[2][0], value[3])
            assertStructurallySame(value[2], [['capture'], 2, 3])
            return { nodes: analysis.nodes.length, fast: JSON.stringify(normalized).length }
        })
        assert(sizes[2].nodes - sizes[1].nodes <= sizes[1].nodes - sizes[0].nodes)
        assert(sizes[2].fast - sizes[1].fast <= sizes[1].fast - sizes[0].fast)
    },
    sharedRootJoinSelectedReturns: () => {
        const fn = rootJoinFunction(8)
        const failedTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const failed = /** @type {Value} */ (['function', {
            target: failedTarget, parameters: [], rest: null, self: null, captures: [], body: body(['throw', 'suffix reached']),
        }])
        assertEq(evaluate(calledFunction(fn, [0, true, true, false, failed, 1, 2])), 50)
        assertEq(evaluate(calledFunction(fn, [1, false, false, true, failed, 1, 2])), 60)
        assertEq(assertError(memo(assertOk(identityAnalysis(calledFunction(fn, [0, false, true, false, failed, 1, 2]))))({ args: [] })), 'suffix reached')
        const captureFailure = /** @type {FastFunction} */ ({
            ...fn, captures: fn.captures.map(capture => ({ binding: capture.binding, value: /** @type {Value} */ (['.', null, 'x']) })),
        })
        assertError(memo(assertOk(identityAnalysis(calledFunction(captureFailure, [0, true, true, false, failed, 1, 2]))))({ args: [] }))
        const factoryTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const args = Array.from({ length: 3 }, () => id(0))
        const factory = /** @type {Value} */ (['function', {
            target: factoryTarget, parameters: args, rest: null, self: null, captures: [], body: body(['return', factoryTarget, ['array', args.map(ref)]]),
        }])
        const value = evaluate(calledFunction(fn, [2, false, true, false, factory, 1, 2]))
        assert(value instanceof Array)
        assertStructurallySame(value[2], [['capture'], 3, 5])
        const first = calledFunction(fn, [1, true, false, true, factory, 1, 2])
        const second = fromFast(assertOk(toFast(first)))
        const third = fromFast(assertOk(toFast(second)))
        assertStructurallySame(assertOk(identityAnalysis(third)), assertOk(identityAnalysis(second)))
        const repeated = evaluate(third)
        assert(repeated instanceof Array)
        assertStructurallySame(repeated[2], [['capture'], 2, 3])
    },
    sharedRootJoinNormalSignatures: () => {
        const argument = id(0), stop = id(0), selected = id(0), state = id(0), stopState = id(0), selectedState = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        for (const length of [0, 1, 3]) {
            const bindings = Array.from({ length }, () => id(0))
            const left = bindings.map((_, index) => /** @type {Value} */ (['+', ref(state), index]))
            const right = bindings.map((_, index) => /** @type {Value} */ (['+', ref(state), index + 10]))
            const loop = /** @type {Loop} */ ({
                target: loopTarget, parameters: [state, stopState, selectedState], initial: [ref(argument), ref(stop), ref(selected)], results: [output],
                body: body(['break', loopTarget, [['array', bindings.map(ref)]]], [
                    ['if', bindings, ref(selectedState),
                        body(['yield', left], [['if', [], ref(stopState), body(['return', target, 77]), body(['yield', []])]]),
                        body(['yield', right], [['if', [], ref(stopState), body(['return', target, 88]), body(['yield', []])]]),
                    ],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [argument, stop, selected], rest: null, self: null, captures: [],
                body: body(['return', target, ref(output)], [['loop', loop]]),
            })
            assert(invocationRootOf(fn) !== null)
            for (const branch of [false, true]) {
                assertEq(evaluate(calledFunction(fn, [4, true, branch])), branch ? 77 : 88)
                assertStructurallySame(evaluate(calledFunction(fn, [4, false, branch])), bindings.map((_, index) => 4 + index + (branch ? 0 : 10)))
            }
        }
    },
    directRootResult: () => {
        const parameter = id(0)
        const loop = counting(ref(parameter))
        const fn = /** @type {FastFunction} */ ({ target, parameters: [parameter], rest: null, self: null, captures: [], body: { statements: [['loop', { ...loop, body: { statements: [], exit: ['break', loop.target, [ref(loop.parameters[0])]] } }]], exit: ['return', target, ref(loop.results[0])] } })
        assertStructurallySame(fromFast(result(['function', fn])), ['=>', 1, [], ['arg', 0]])
    },
    canonicalRootLoops: () => {
        const parameter = id(20)
        const alias = id(21)
        const loop = counting(ref(alias))
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [parameter], rest: null, self: null, captures: [],
            body: { statements: [['define', alias, ref(parameter), 'lazy'], ['loop', loop]], exit: ['return', target, ref(loop.results[0])] },
        })
        const graph = fromFast(result(['function', fn]))
        const argument = /** @type {const} */ (['arg', 0])
        const expected = /** @type {Exp} */ (['=>', 1, [], ['?:', ['<', argument, 3], ['()', ['self'], [['+', argument, 1]]], argument]])
        assertStructurallySame(assertOk(identityAnalysis(graph)), assertOk(identityAnalysis(expected)))
        const ownSelf = id(23)
        assertStructurallySame(fromFast(result(['function', { ...fn, self: ownSelf }])), expected)
        const setup = id(22)
        const wrapped = fromFast(result(['function', { ...fn, body: { ...fn.body, statements: [['define', setup, ['array', []], 'required'], ...fn.body.statements] } }]))
        assertStructurallySame(wrapped, ['=>', 1, [], [',', [['[]', []], ['()', ['=>', 1, [], ['?:', ['<', ['arg', 0], 3], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]], [['arg', 0]]]]]])
    },
    loopMemoMemberArgumentDemand: () => {
        const lazy = id(0)
        const loop = collectingMemo(['.', null, 'x', ['|()', [ref(lazy)]]])
        const graph = fromFast(result(7, [['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]]))
        assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] }))
    },
    loopMemoOptionalArgumentDemand: () => {
        for (const initializer of /** @type {readonly Value[]} */ ([['array', [4]], ['.', null, 'x']])) {
            const lazy = id(0)
            const loop = collectingMemo(['?.()', null, [ref(lazy)]])
            assertEq(evaluate(fromFast(result(7, [['define', lazy, initializer, 'lazy'], ['loop', loop]]))), 7)
        }
    },
    loopMemoSpreadDemand: () => {
        const lazy = id(0)
        const loop = collectingMemo(['array', [['...', ref(lazy)]]])
        const statements = /** @type {readonly Statement[]} */ ([['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]])
        assertEq(evaluate(fromFast(result(7, statements))), 7)
        const value = evaluate(fromFast(result(['array', [collectedMemo(ref(loop.results[0])), ref(lazy)]], statements)))
        assert(value instanceof Array)
        assertStructurallySame(value, [[4], [4]])
        assert(value[0] !== value[1])
    },
    loopMemoOperandLazyPrerequisite: () => {
        const external = id(0), dependent = id(0)
        const loop = collectingMemo(ref(dependent), 2)
        const statements = /** @type {readonly Statement[]} */ ([['define', dependent, ['array', [ref(external)]], 'lazy'], ['loop', loop]])
        assertEq(evaluate(fromFast(result(['block', result(7, statements)], [['define', external, ['array', [4]], 'lazy']]))), 7)
        const local = result(['array', [collectedMemo(ref(loop.results[0]), 1), collectedMemo(ref(loop.results[0])), ref(dependent)]], statements)
        const value = evaluate(fromFast(result(['array', [['block', local], ref(external)]], [['define', external, ['array', [4]], 'lazy']])))
        assert(value instanceof Array && value[0] instanceof Array && value[0][0] instanceof Array)
        assertStructurallySame(value, [[[[4]], [[4]], [[4]]], [4]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[0][0], value[0][2])
        assertEq(value[0][0][0], value[1])
    },
    loopMemoOperandOwnerCrossing: () => {
        const lazy = id(0)
        const loop = collectingMemo(ref(lazy), 3, false)
        assertEq(evaluate(fromFast(result(['if', false, afterLoop(loop, 1), result(8)], [['define', lazy, ['.', null, 'x'], 'lazy']]))), 8)
    },
    throw: {
        unbound: () => { fromFast(result(ref(id(0)))) },
        distinctBindingIdentity: () => { fromFast(result(ref(id(0))), [[id(0), 1]]) },
        uncapturedOuterBinding: () => {
            const outer = id(0)
            fromFast(result(['function', { target, parameters: [], rest: null, self: null, captures: [], body: result(ref(outer)) }]), [[outer, 1]])
        },
        transfer: () => { fromFast({ statements: [], exit: ['continue', { kind: 'loop', index: 0 }, []] }) },
        valueReturn: () => { fromFast(result(['block', { statements: [], exit: ['return', target, 1] }])) },
        valueReturnWithTransfer: () => {
            const first = id(0), second = id(0), local = id(0)
            const a = /** @type {Exp} */ (['[]', [1]])
            const b = /** @type {Exp} */ (['[]', [2]])
            const ignored = /** @type {Exp} */ (['[]', [3]])
            lowerValue(['block', { statements: [['define', local, ref(first), 'lazy']], exit: ['return', target, ref(local)] }], [[first, a], [second, b], [first, ignored]], returned)
        },
        statementReturn: () => { fromFast(result(1, [['if', [], true, { statements: [], exit: ['return', target, 1] }, result(2)]])) },
        loop: () => { fromFast(result(1, [['loop', { target: { kind: 'loop', index: 0 }, parameters: [], initial: [], results: [], body: result(1) }]])) },
        generalLoopReturn: () => {
            const loop = summing()
            fromFast(afterLoop({ ...loop, body: body(['return', target, 1]) }, 7))
        },
        generalLoopOuterTransfer: () => {
            const loop = summing()
            fromFast(afterLoop({ ...loop, body: body(['continue', { ...loop.target }, [1, 2]]) }, 7))
        },
        nestedLoopOuterReturn: () => {
            const outer = summing()
            const inner = summing()
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['return', target, 1]) })
            fromFast(afterLoop({ ...outer, body: { ...outer.body, statements: [['loop', escaped], ...outer.body.statements] } }, 7))
        },
        loopMemoExternalLazyEnvironment: () => {
            const lazy = id(0)
            const loop = collectingMemo(ref(lazy))
            fromFast(afterLoop(loop, ref(loop.results[0])), [[lazy, ['[]', [4]], 'lazy']])
        },
        loopMemoExternalLazyPrerequisite: () => {
            const external = id(0), prerequisite = id(0), dependent = id(0)
            const loop = collectingMemo(ref(dependent), 2)
            const block = result(7, [
                ['define', prerequisite, ['array', [ref(external)]], 'lazy'],
                ['define', dependent, ['array', [ref(prerequisite)]], 'lazy'], ['loop', loop],
            ])
            fromFast(block, [[external, ['[]', [4]], 'lazy']])
        },
        loopMemoLazyEnvironmentPrecedence: () => {
            const external = id(0), dependent = id(0)
            const loop = collectingMemo(ref(dependent), 2)
            const block = result(7, [['define', dependent, ['array', [ref(external)]], 'lazy'], ['loop', loop]])
            fromFast(block, [[external, ['[]', [4]], 'lazy'], [external, ['[]', [9]]]])
        },
        loopMemoCustomBlockTransfer: () => {
            const lazy = id(0)
            const loop = collectingMemo(ref(lazy), 2)
            const block = result(7, [['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]])
            lowerBlock(block, [], () => ({ exp: 7, anchors: [] }))
        },
        loopMemoCustomValueTransfer: () => {
            const lazy = id(0)
            const loop = collectingMemo(ref(lazy), 2)
            const block = result(7, [['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]])
            lowerValue(['block', block], [], () => ({ exp: 7, anchors: [] }))
        },
        lazyInitializerMemoRewriteKeepsCustomTransferRefusal: () => {
            const shared = id(0), outer = id(0)
            const loop = collectingMemo(ref(shared), 2)
            const initializer = /** @type {Value} */ (['block', result(ref(loop.results[0]), [['define', shared, ['array', [4]], 'lazy'], ['loop', loop]])])
            lowerBlock(result(7, [['define', outer, initializer, 'lazy']]), [], () => ({ exp: 7, anchors: [] }))
        },
        loopMemoForeignReturn: () => {
            const lazy = id(0)
            const loop = returningLoop(false, ref(lazy), [7], { ...target })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['define', lazy, ['array', [4]], 'lazy'], ['loop', loop]]),
            })
            calledFunction(fn)
        },
        loopReturnForeignOwner: () => {
            const loop = returningLoop(true, 7, [], { ...target })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', loop]]),
            })
            calledFunction(fn)
        },
        loopReturnValueForeignOwner: () => {
            const value = id(0)
            const loop = returningLoop(false, 7)
            const operand = /** @type {Loop} */ ({
                ...loop, body: body(['break', loop.target, []], [
                    ['define', value, ['block', body(['return', { ...target }, 7])], 'required'],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', operand]]),
            })
            calledFunction(fn)
        },
        loopReturnLazyInnerForeignOwner: () => {
            const lazy = id(0)
            const inner = returningLoop(true, ref(lazy), [], { ...target })
            const outer = returningLoop(false, 7)
            const nested = /** @type {Loop} */ ({
                ...outer, body: body(['break', outer.target, []], [
                    ['define', lazy, ['array', [3]], 'lazy'], ['loop', inner],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', nested]]),
            })
            calledFunction(fn)
        },
        nestedOuterSiblingTarget: () => {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const firstTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const secondTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const first = /** @type {Loop} */ ({
                target: firstTarget, parameters: [], initial: [], results: [], body: body(['continue', secondTarget, []]),
            })
            const second = /** @type {Loop} */ ({
                target: secondTarget, parameters: [], initial: [], results: [], body: body(['break', secondTarget, []]),
            })
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [], body: body(['break', outerTarget, []], [['loop', first], ['loop', second]]),
            })
            fromFast(afterLoop(outer, 7))
        },
        nestedOuterCrossFunction: () => {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const fnTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
            const inner = /** @type {Loop} */ ({
                target: innerTarget, parameters: [], initial: [], results: [], body: body(['break', outerTarget, []]),
            })
            const fn = /** @type {FastFunction} */ ({
                target: fnTarget, parameters: [], rest: null, self: null, captures: [], body: body(['return', fnTarget, 9], [['loop', inner]]),
            })
            const value = id(0)
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [], initial: [], results: [],
                body: body(['break', outerTarget, []], [['define', value, ['()', ['function', fn], []], 'required']]),
            })
            fromFast(afterLoop(outer, 7))
        },
        nestedOuterOperandBoundary: () => {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const state = id(0), output = id(0), value = id(0)
            const outer = /** @type {Loop} */ ({
                target: outerTarget, parameters: [state], initial: [0], results: [output],
                body: body(['break', outerTarget, [ref(state)]], [
                    ['define', value, ['block', body(['continue', outerTarget, [1]])], 'required'],
                ]),
            })
            fromFast(afterLoop(outer, ref(output)))
        },
        sharedFunctionJoinForeignReturn: () => {
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 7], [['if', [], true, body(['return', { ...target }, 9]), body(['yield', []])]]),
            })
            calledFunction(fn)
        },
        sharedFunctionJoinForeignExit: () => {
            const selected = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [selected], rest: null, self: null, captures: [],
                body: body(['return', { ...target }, 9], [
                    ['if', [], ref(selected), body(['return', target, 7]), body(['yield', []])],
                ]),
            })
            calledFunction(fn, [false])
        },
        sharedFunctionJoinRawLoopTransfer: () => {
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['continue', loopTarget, []]),
            })
            calledFunction(fn)
        },
        sharedFunctionJoinNestedOperandForeignReturn: () => {
            const value = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 7], [['define', value, ['block', body(['yield', [1]], [
                    ['if', [], true, body(['return', { ...target }, 9]), body(['yield', []])],
                ])], 'required']]),
            })
            calledFunction(fn)
        },
        sharedFunctionJoinResultArity: () => {
            const output = id(0)
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 7], [['block', [output], body(['yield', []], [
                    ['if', [], false, body(['return', target, 9]), body(['yield', []])],
                ])]]),
            })
            calledFunction(fn)
        },
        unboundLoopCapture: () => {
            const loop = counting(0, ref(id(0)))
            fromFast(afterLoop(loop, ref(loop.results[0])))
        },
    },
}
