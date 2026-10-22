/**
 * @import { BindingId, Block, Function as FastFunction, Statement, Value } from '../../js/ast/types.ts'
 * @import { Exp } from '../types.ts'
 * @import { Environment, Transfer } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { anchored, fromFast, lowerBlock, lowerValue } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(value: Value, statements?: readonly Statement[]) => Block} */
const result = (value, statements = []) => ({ statements, exit: ['yield', [value]] })

const target = /** @type {const} */ ({ kind: 'function', index: 0 })

export const proof = {
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
            assert(exit[0] === 'return')
            return lowerValue(exit[2], entries)
        }
        const block = /** @type {Block} */ ({ statements: [['define', local, ref(first), 'lazy']], exit: ['return', target, ref(local)] })
        assertEq(lowerBlock(block, environment, transferred).exp, a)
        assertEq(lowerValue(['block', block], environment, transferred).exp, a)
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
        assertStructurallySame(fromFast(result(['&&', false, init])), ['&&', false, [',', [['.', null, 'x'], 3]]])
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
    operations: () => {
        const value = /** @type {Value} */ (['block', result(1, [['define', id(0), ['.', null, 'x'], 'required']])])
        assertStructurallySame(fromFast(result(['.', 1, ['Number', value], ['|()', [value]]])), [',', [['.', null, 'x'], ['.', 1, ['Number', 1], ['|()', [[',', [['.', null, 'x'], 1]]]]]]])
        assertStructurallySame(fromFast(result(['?.', null, ['Number', value]])), ['?.', null, ['Number', [',', [['.', null, 'x'], 1]]]])
        assertStructurallySame(fromFast(result(['?.()', null, [value]])), ['?.()', null, [[',', [['.', null, 'x'], 1]]]])
        assertStructurallySame(fromFast(result(['()', ['.', ['object', []], 'f'], []])), ['.', ['{}', []], 'f', ['|()', []]])
        assertStructurallySame(fromFast(result(['()', ['block', result(['.', ['object', []], 'f'])], []])), ['()', ['.', ['{}', []], 'f'], []])
        assertStructurallySame(fromFast(result([',', [1, ['.', null, 'x'], 2]])), [',', [['.', null, 'x'], 2]])
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
        statementReturn: () => { fromFast(result(1, [['if', [], true, { statements: [], exit: ['return', target, 1] }, result(2)]])) },
        loop: () => { fromFast(result(1, [['loop', { target: { kind: 'loop', index: 0 }, parameters: [], initial: [], results: [], body: result(1) }]])) },
    },
}
