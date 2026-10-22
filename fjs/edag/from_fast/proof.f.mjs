/**
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Environment, Transfer } from './types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { anchored, fromFast, lowerBlock, lowerValue } from './module.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
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
        unboundLoopCapture: () => {
            const loop = counting(0, ref(id(0)))
            fromFast(afterLoop(loop, ref(loop.results[0])))
        },
    },
}
