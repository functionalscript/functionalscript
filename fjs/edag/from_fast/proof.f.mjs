/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Environment, Transfer } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { anchored, fromFast, lowerBlock, lowerValue } from './module.f.mjs'
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

export const proof = {
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
        assertStructurallySame(fromFast(result(['array', [ref(a), ref(b)]], [['block', [a, b], pair]])), [',', [['[]', [1, 2]], ['[]', [['.', ['[]', [1, 2]], 0], ['.', ['[]', [1, 2]], 1]]]]])
        assertStructurallySame(fromFast(result(ref(a), [['if', [a], true, result(1), result(2)]])), [',', [['?:', true, 1, 2], ['?:', true, 1, 2]]])
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
        lazyLoopCapture: () => {
            const limit = id(0)
            const alias = id(1)
            const loop = counting(0, ref(alias))
            fromFast(result(ref(loop.results[0]), [['define', limit, ['.', null, 'x'], 'lazy'], ['define', alias, ref(limit), 'lazy'], ['loop', loop]]))
        },
        lazyGeneralLoopCapture: () => {
            const limit = id(0)
            const loop = summing(0, ref(limit))
            fromFast(result(ref(loop.results[0]), [['define', limit, ['.', null, 'x'], 'lazy'], ['loop', loop]]))
        },
        generalLoopReturn: () => {
            const loop = summing()
            fromFast(afterLoop({ ...loop, body: body(['return', target, 1]) }, 7))
        },
        generalLoopOuterTransfer: () => {
            const loop = summing()
            fromFast(afterLoop({ ...loop, body: body(['continue', { ...loop.target }, [1, 2]]) }, 7))
        },
        nestedLoopOuterBreak: () => {
            const outer = summing()
            const inner = summing()
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['break', outer.target, [1, 2]]) })
            fromFast(afterLoop({ ...outer, body: { ...outer.body, statements: [['loop', escaped], ...outer.body.statements] } }, 7))
        },
        nestedLoopOuterContinue: () => {
            const outer = summing()
            const inner = summing()
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['continue', outer.target, [1, 2]]) })
            fromFast(afterLoop({ ...outer, body: { ...outer.body, statements: [['loop', escaped], ...outer.body.statements] } }, 7))
        },
        nestedLoopOuterReturn: () => {
            const outer = summing()
            const inner = summing()
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['return', target, 1]) })
            fromFast(afterLoop({ ...outer, body: { ...outer.body, statements: [['loop', escaped], ...outer.body.statements] } }, 7))
        },
        nestedLoopLazyCapture: () => {
            const outer = summing()
            const lazy = id(0)
            const inner = summing(0, ref(lazy))
            const statements = /** @type {readonly Statement[]} */ ([
                ['define', lazy, ['array', [3]], 'lazy'], ['loop', inner], ...outer.body.statements,
            ])
            fromFast(afterLoop({ ...outer, body: { ...outer.body, statements } }, 7))
        },
        loopReturnForeignOwner: () => {
            const loop = returningLoop(true, 7, [], { ...target })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', loop]]),
            })
            calledFunction(fn)
        },
        loopReturnValueOperand: () => {
            const value = id(0)
            const loop = returningLoop(false, 7)
            const operand = /** @type {Loop} */ ({
                ...loop, body: body(['break', loop.target, []], [
                    ['define', value, ['block', body(['return', target, 7])], 'required'],
                ]),
            })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', operand]]),
            })
            calledFunction(fn)
        },
        loopReturnLazyInnerCapture: () => {
            const lazy = id(0)
            const inner = returningLoop(true, ref(lazy))
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
        loopReturnOuterBreak: () => {
            const outer = returningLoop(false, 7)
            const inner = returningLoop(true, 8)
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['break', outer.target, []], [
                ['if', [], false, body(['return', target, 8]), body(['yield', []])],
            ]) })
            const nested = /** @type {Loop} */ ({ ...outer, body: body(['break', outer.target, []], [['loop', escaped]]) })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', nested]]),
            })
            calledFunction(fn)
        },
        loopReturnOuterContinue: () => {
            const outer = returningLoop(false, 7)
            const inner = returningLoop(true, 8)
            const escaped = /** @type {Loop} */ ({ ...inner, body: body(['continue', outer.target, []], [
                ['if', [], false, body(['return', target, 8]), body(['yield', []])],
            ]) })
            const nested = /** @type {Loop} */ ({ ...outer, body: body(['break', outer.target, []], [['loop', escaped]]) })
            const fn = /** @type {FastFunction} */ ({
                target, parameters: [], rest: null, self: null, captures: [],
                body: body(['return', target, 9], [['loop', nested]]),
            })
            calledFunction(fn)
        },
        unboundLoopCapture: () => {
            const loop = counting(0, ref(id(0)))
            fromFast(afterLoop(loop, ref(loop.results[0])))
        },
    },
}
