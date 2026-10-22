/**
 * Graph conversion preserves identity and execution regions before physical
 * preparation. Pure cross-lazy reads have the explicitly documented source
 * normalization; allocations, calls and required work retain their owner.
 *
 * @import { Block, BindingId, Function as FastFunction, Value } from '../../js/ast/types.ts'
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { Analysis, Node } from '../analysis/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis, identityAnalysis } from '../analysis/module.f.mjs'
import { fromFast } from '../from_fast/module.f.mjs'
import { fromAnalysis, functionFromAnalysis, toFast } from './module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/** Compare semantic graph tables without merging allocation identities. @type {(graph: Exp) => void} */
const roundTrip = graph => assertStructurallySame(assertOk(analysis(fromFast(assertOk(toFast(graph))))), assertOk(analysis(graph)))

export const proof = {
    operations: () => {
        /** @type {readonly Exp[]} */
        const graphs = [
            1, undefined === null, null, 'value', 3n, ['undefined'],
            ['[]', [1, ['...', 'ab']]], ['{}', [[':', 'x', 1], ['...', ['{}', []]]]],
            ['entry'], ['hasEntry'], ['slice'], ['Object.is'],
            ['!', 1], ['~', 2], ['-', ['[]', []]], ['+', ['[]', []]], ['typeof', 1], ['Number', '3'], ['String', 2],
            ['+', 1, 2], ['-', 2, 1], ['*', 2, 3], ['instanceof', ['[]', []], 'Array'],
            ['.', ['{}', [[':', 'x', 1]]], 'x'], ['.', ['[]', [8]], ['Number', '0']],
            ['()', ['=>', 0, [], 2], []], ['?.()', ['undefined'], []],
            ['?.', null, ['Number', 1]], ['?.', null, 'x', ['|.', 'y']],
            ['.', ['rest'], 'at', ['|()', [1]]],
            ['&&', true, 2], ['||', false, 2], ['??', null, 2], ['?:', true, 1, 2],
            [',', [['[]', []], 2]], ['throw', 'failure'], ['[]', [['throw', 1]]],
        ]
        for (const graph of graphs) {
            // A rest read is invocation-local, not a module operation.
            const body = graph instanceof Array && graph[0] === '.' && graph[1] instanceof Array && graph[1][0] === 'rest'
                ? /** @type {Exp} */ (['=>', 0, [], graph]) : graph
            roundTrip(body)
        }
        roundTrip(['?.', null, 'x', ['|.', ['Number', 0], ['|!()', [2]]]])
        roundTrip(['?.', null, 'x', ['|?.()', [1]]])
        roundTrip(['?.()', ['undefined'], [1], ['|.', 'x', ['|()', [2]]]])
        roundTrip(['.', ['{}', []], 'x', ['|?.()', [1]]])
    },
    identities: () => {
        const shared = /** @type {const} */ (['[]', []])
        const graph = /** @type {const} */ (['[]', [shared, shared, ['[]', []]]])
        const restored = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(assertOk(toFast(graph))))
        assert(restored[1][0] === restored[1][1])
        assert(restored[1][0] !== restored[1][2])
        const other = /** @type {const} */ (['[]', [1]])
        roundTrip(['[]', [shared, shared, other, other]])
        const allocation = /** @type {const} */ (['=>', 0, [], 1])
        roundTrip(['[]', [allocation, allocation]])
        const normalized = fromFast(assertOk(toFast([',', [shared, ['[]', [shared, shared]]]])))
        assertEq(normalized instanceof Array && normalized[0], '[]')
        roundTrip(normalized)
        const primitive = /** @type {const} */ (['undefined'])
        const first = /** @type {readonly ['[]', readonly Exp[]]} */ (fromFast(assertOk(toFast(['[]', [primitive, primitive]]))))
        assert(first[1][0] !== first[1][1])
        const second = fromFast(assertOk(toFast(first)))
        assertStructurallySame(assertOk(identityAnalysis(first)), assertOk(identityAnalysis(second)))
    },
    regions: () => {
        const shared = /** @type {const} */ (['[]', []])
        const graph = /** @type {const} */ (['[]', [['&&', true, shared], ['||', false, shared]]])
        const fast = assertOk(toFast(graph))
        assert(fast.statements.some(statement => statement[0] === 'define' && statement[3] === 'lazy'))
        roundTrip(graph)
        const local = assertOk(toFast(['?:', true, ['[]', [shared, shared]], 0]))
        assertEq(local.statements.length, 0)
        roundTrip(['?:', true, ['[]', [shared, shared]], 0])
        const read = /** @type {const} */ (['.', ['arg', 0], 'length'])
        const pure = assertOk(toFast(['=>', 1, [], ['?:', true, read, read]]))
        assertEq(pure.statements.length, 0)
        const anchored = /** @type {const} */ (['[]', []])
        const field = /** @type {const} */ (['.', anchored, 'length'])
        roundTrip([',', [anchored, ['?:', true, field, field]]])
        roundTrip([',', [shared, ['&&', false, shared]]])
        roundTrip([',', [shared, 2]])
        const call = /** @type {const} */ (['()', ['=>', 0, [], ['throw', 'failure']], []])
        roundTrip(['=>', 1, [], ['?:', ['arg', 0], [',', [call, 0]], call]])
    },
    functions: () => {
        const captured = /** @type {const} */ (['[]', [1]])
        roundTrip(['=>', 1, [captured], ['[]', [['arg', 0], ['rest'], ['frame', 0]]]])
        roundTrip(['=>', 1, [], ['()', ['self'], [['arg', 0]]]])
        roundTrip(['=>', 0, [], [',', [['[]', []], ['throw', 1]]]])
        const direct = assertOk(identityAnalysis(['=>', 0, [], 1]))
        assertEq(functionFromAnalysis(direct, /** @type {readonly ['#', number]} */ (direct.root)[1]).parameters.length, 0)
        const fn = /** @type {const} */ (['=>', 0, [], 1])
        const table = assertOk(identityAnalysis(['[]', [fn, fn]]))
        assertEq(functionFromAnalysis(table, table.nodes.findIndex(node => node[0] === '=>')).parameters.length, 0)
        const recursion = assertOk(identityAnalysis(['=>', 1, [], ['()', ['self'], [['arg', 0]]]]))
        assert(functionFromAnalysis(recursion, /** @type {readonly ['#', number]} */ (recursion.root)[1]).self !== null)
    },
    loops: () => {
        /** @type {(next: Exp) => Exp} */
        const call = next => ['()', ['self'], [next]]
        const graph = /** @type {Exp} */ (['=>', 1, [], ['?:', ['<', ['arg', 0], 3], call(['+', ['arg', 0], 1]), ['arg', 0]]])
        const fast = assertOk(toFast(graph))
        const fn = /** @type {readonly ['function', FastFunction]} */ (/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (fast.exit)[1][0])[1]
        assertEq(fn.self, null)
        assertEq(fn.body.statements[0][0], 'loop')
        roundTrip(graph)
        roundTrip(['=>', 1, [], ['?:', true, [',', [['[]', []], call(0)]], ['arg', 0]]])
        roundTrip(['=>', 1, [], ['?:', ['.', ['rest'], 'length'], call(0), ['arg', 0]]])
        roundTrip(['=>', 1, [], [',', [['[]', []], ['?:', true, call(0), ['arg', 0]]]]])
        roundTrip(['=>', 1, [], ['?:', true, call(['throw', 1]), ['arg', 0]]])
    },
    externalFragments: () => {
        const binding = { index: 0 }
        const a = assertOk(identityAnalysis(['[]', []]))
        const index = /** @type {readonly ['#', number]} */ (a.root)[1]
        const fast = fromAnalysis(a, [[index, binding]])
        assertEq(/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (fast.exit)[1][0] instanceof Array, true)
        assertStructurallySame(fromFast(fast, [[binding, 7]]), 7)
        const parameters = [{ index: 1 }]
        const rest = { index: 2 }
        const self = { index: 3 }
        const captures = [{ index: 4 }]
        const args = { index: 5 }
        for (const [graph, expected] of /** @type {readonly (readonly [Exp, BindingId])[]} */ ([
            [['arg', 0], parameters[0]], [['rest'], rest], [['self'], self], [['frame', 0], captures[0]], [['args'], args],
        ])) {
            const block = fromAnalysis(assertOk(identityAnalysis(graph)), [], { parameters, rest, self, captures, args })
            const value = /** @type {readonly ['ref', BindingId]} */ (/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0])
            assertEq(value[1], expected)
        }
        assertEq(fromAnalysis(assertOk(identityAnalysis(['args']))).exit[0], 'yield')
    },
    enclosingOwners: () => {
        const fn = /** @type {const} */ (['=>', 0, [], 7])
        roundTrip([',', [fn, ['?:', true, ['()', fn, []], 0]]])
        // Nested explicit anchors can normalize once; their output stabilizes.
        const nested = /** @type {Exp} */ ([',', [fn, ['?:', true, [',', [
            ['()', fn, []], [',', [['()', fn, []], ['()', fn, []]]],
        ]], 0]]])
        roundTrip(fromFast(assertOk(toFast(nested))))
        const captured = /** @type {const} */ (['[]', [1]])
        const closure = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        const capture = /** @type {Exp} */ ([',', [captured, ['===', ['?:', true, ['()', closure, []], ['undefined']], captured]]])
        roundTrip(fromFast(assertOk(toFast(capture))))
    },
    chainRegions: () => {
        const optional = assertOk(toFast(['?.', null, 'x']))
        const value = /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (optional.exit)[1][0]
        assertEq(/** @type {readonly ['?.', Value, unknown]} */ (value)[1], null)
        const call = assertOk(toFast(['.', 'abc', 'slice', ['|()', [1]]]))
        const direct = /** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (call.exit)[1][0]
        assertEq(/** @type {readonly ['.', Value, unknown, readonly ['|()', readonly Value[]]]} */ (direct)[3][1][0], 1)
    },
    anchorOrder: () => {
        const second = /** @type {const} */ (['[]', [1]])
        const before = /** @type {const} */ (['[]', [2]])
        const graph = /** @type {Exp} */ ([',', [before, second, ['[]', [['&&', 1, ['[]', [second, second]]], ['&&', 2, ['[]', [2]]]]]]])
        roundTrip(graph)
    },
    deepExpressions: () => {
        /** @type {Exp} */
        let graph = 1
        /** @type {List<ExpOp>} */
        let expressions = null
        const count = 20_000
        const nodes = Array.from({ length: count }, (_, i) => {
            const operand = i === 0 ? 1 : /** @type {const} */ (['#', i - 1])
            return /** @type {Node} */ (i % 3 === 0 ? ['!', operand] : i % 3 === 1 ? ['+', operand, 1] : ['.', operand, 'length'])
        })
        for (let i = 0; i < count; i += 1) {
            graph = i % 3 === 0 ? ['!', graph] : i % 3 === 1 ? ['+', graph, 1] : ['.', graph, 'length']
            expressions = { first: graph, tail: expressions }
        }
        const exps = toArray(expressions).toReversed()
        /** @type {Analysis} */
        const table = { root: ['#', count - 1], nodes, scope: nodes.map(() => -1), shared: [], exps }
        let restored = fromFast(fromAnalysis(table))
        let length = 0
        while (restored instanceof Array) {
            assertEq(restored[0], nodes[count - 1 - length][0])
            restored = /** @type {Exp} */ (restored[1])
            length += 1
        }
        assertEq(length, count)
        assertEq(restored, 1)
    },
    admission: () => {
        assertEq(assertError(toFast(['arg', 0])), 'invalid fixed parameter index or scope')
        const node = /** @type {const} */ (['[]', []])
        assertEq(assertError(toFast(['[]', [node, ['=>', 0, [], node]]])), 'a node shared across a function boundary')
    },
}
