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

import { conditional } from '../testlib.f.js'
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis, identityAnalysis } from '../analysis/module.f.mjs'
import { fromFast } from '../from_fast/module.f.mjs'
import { fromAnalysis, functionFromAnalysis, toFast } from './module.f.mjs'
import { toArray } from '../../types/list/alt/module.f.js'
import { memo } from '../memo/module.f.mjs'
import { vm } from '../amnesia/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'
import { sourceReason } from './source/module.f.mjs'

/** Compare semantic graph tables without merging allocation identities. @type {(graph: Exp) => void} */
const roundTrip = graph => assertStructurallySame(assertOk(analysis(fromFast(assertOk(toFast(graph))))), assertOk(analysis(graph)))

/** Earlier lazy owners must keep the dependencies used by their first demand. @type {() => readonly Exp[]} */
export const _snapshotCases = () => {
    /** @type {Exp} */
    const computed = ['+', 1, 2]
    /** @type {readonly Exp[]} */
    const owners = [
        ['[]', [computed]],
        ['()', ['=>', 1, [], ['[]', [['arg', 0]]]], [computed]],
        ['()', ['=>', 0, [computed], ['[]', [['frame', 0]]]], []],
    ]
    return owners.flatMap(owner => {
        /** @type {readonly Exp[]} */
        const earlier = [
            ['[]', [['...', 'x'], owner]],
            ['()', ['=>', 0, [], ['rest']], [['...', 'x'], owner]],
            ['()', ['=>', 0, [['[]', [['...', 'x'], owner]]], ['frame', 0]], []],
            ['[]', [['()', ['=>', 0, [], 'x'], []], owner]],
        ]
        return earlier.map(first => {
            /** @type {Exp} */
            const later = ['+', first, 1]
            /** @type {Exp} */
            const graph = ['[]', [first, owner, later, later]]
            return graph
        })
    })
}

export const proof = {
    snapshotsKeepEarlierLazyDependencies: () => {
        for (const initial of _snapshotCases()) {
            const expected = assertOk(toData(assertOk(vm({ frame: [], args: [] })(initial))))
            assertStructurallySame(expected, [['x', [3]], [3], 'x,31', 'x,31'])
            let graph = initial
            for (let round = 0; round < 4; round += 1) {
                const values = assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
                assertStructurallySame(values, expected)
                assert(values instanceof Array && values[0] instanceof Array)
                assertEq(values[0][1], values[1])
                graph = fromFast(assertOk(toFast(graph)))
            }
        }
    },
    operations: () => {
        /** @type {readonly Exp[]} */
        const graphs = [
            1, undefined === null, null, 'value', 3n, ['undefined'],
            ['[]', [1, ['...', 'ab']]], ['{}', [[':', 'x', 1], ['...', ['{}', []]]]],
            ['entry'], ['hasEntry'], ['slice'], ['Object.is'],
            ['!', 1], ['~', 2], ['-', ['[]', []]], ['+', ['[]', []]], ['typeof', 1], ['Number', '3'], ['BigInt', '3'], ['BigInt', 1.5], ['String', 2],
            ['+', 1, 2], ['-', 2, 1], ['*', 2, 3], ['instanceof', ['[]', []], 'Array'], ['in', 'x', ['{}', []]],
            ['.', ['{}', [[':', 'x', 1]]], 'x'], ['.', ['[]', [8]], ['Number', '0']],
            ['memberPresent', ['[]', [8]], 'length'], ['memberPresent', ['[]', [8]], 0],
            ['memberPresent', ['[]', [8]], ['Number', '0']],
            ['()', ['=>', 0, [], 2], []], ['?.()', ['undefined'], []],
            ['?.', null, ['Number', 1]], ['?.', null, 'x', ['|.', 'y']],
            ['.', ['rest'], 'at', ['|()', [1]]],
            conditional('&&', true, 2), conditional('||', false, 2), conditional('??', null, 2), ['?:', true, 1, 2],
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
    memberPresentSharing: () => {
        const receiver = /** @type {const} */ (['[]', [9]])
        const key = /** @type {const} */ (['Number', ['+', 0, 0]])
        const query = /** @type {const} */ (['memberPresent', receiver, key])
        const graph = /** @type {Exp} */ (['[]', [receiver, query, query, ['.', receiver, key]]])
        const flat = (/** @type {Exp} */ value) => {
            const { root, nodes, scope, shared } = assertOk(identityAnalysis(value))
            return { root, nodes, scope, shared }
        }
        let restored = fromFast(assertOk(toFast(graph)))
        const stable = flat(restored)
        for (let i = 0; i < 4; ++i) {
            restored = fromFast(assertOk(toFast(restored)))
            assertStructurallySame(flat(restored), stable)
        }
        const table = assertOk(identityAnalysis(restored))
        const queries = table.nodes.flatMap((node, index) => node[0] === 'memberPresent' ? [index] : [])
        assertEq(queries.length, 1)
        assert(table.shared.includes(queries[0]))
        assertEq(table.nodes.filter(node => node[0] === '.').length, 1)
        roundTrip(['=>', 1, [receiver], ['memberPresent', ['frame', 0], ['Number', ['arg', 0]]]])
    },
    computedKeyOperandPreservesSharing: () => {
        const shared = /** @type {const} */ (['[]', []])
        const key = /** @type {const} */ (['Number', ['?:', ['===', shared, shared], 1, 0]])
        let graph = /** @type {Exp} */ (['.', ['[]', [10, 20]], key])
        for (let i = 0; i < 4; i += 1) {
            assertEq(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] })), 20)
            roundTrip(graph)
            graph = fromFast(assertOk(toFast(graph)))
        }
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
        const graph = /** @type {const} */ (['[]', [conditional('&&', true, shared), conditional('||', false, shared)]])
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
        roundTrip([',', [shared, conditional('&&', false, shared)]])
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
        assertEq(functionFromAnalysis(recursion, /** @type {readonly ['#', number]} */ (recursion.root)[1]).body.statements[0][0], 'loop')
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
        const graph = /** @type {Exp} */ ([',', [before, second, ['[]', [conditional('&&', 1, ['[]', [second, second]]), conditional('&&', 2, ['[]', [2]])]]]])
        roundTrip(graph)
    },
    sharedOwnersRetainDemandOrder: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const failure = /** @type {const} */ (['throw', 2])
        const containing = /** @type {const} */ (['[]', [forever, failure]])
        // An inner owner can be demanded after work in another owner's
        // initializer, even when the outer owner itself is reached first.
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [forever, failure, failure]],
            ['[]', [['?:', true, forever, 0], failure, failure]],
            ['[]', [forever, ['[]', [failure, failure]]]],
            ['[]', [containing, containing, failure]],
        ])
        for (const graph of graphs) { roundTrip(graph) }
    },
    implicitBarriersRetainLaterSharedOwners: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const another = /** @type {const} */ (['()', forever[1], []])
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [['...', null], ['+', 1, 2], ['+', 3, 4], forever, forever]],
            ['[]', [['...', null], forever, another, forever, another]],
        ])
        for (const graph of graphs) { roundTrip(graph) }
    },
    totalSharedOwnerPrecedesItsSelectedDemand: () => {
        const shared = /** @type {const} */ (['[]', []])
        const graph = /** @type {Exp} */ ([',', [['[]', [['?:', 1, shared, 1]]], ['[]', [shared, 2]]]])
        const table = assertOk(identityAnalysis(graph))
        assertEq(sourceReason(table, fromAnalysis(table)), null)
        roundTrip(graph)
    },
    computedOwnerRetainsItsFirstSelectedDemand: () => {
        const shared = /** @type {const} */ (['()', ['=>', 0, [], ['[]', []]], []])
        for (const selected of [false, true]) {
            const graph = /** @type {Exp} */ ([',', [['[]', [['?:', selected, shared, 1]]], ['[]', [shared, 2]]]])
            roundTrip(graph)
            assertStructurallySame(assertOk(memo(assertOk(identityAnalysis(fromFast(assertOk(toFast(graph))))))({ args: [] })), ['[]', [['[]', []], 2]])
        }
    },
    sharedOwnersPreserveSelectedIdentity: () => {
        const shared = /** @type {const} */ (['[]', [7]])
        for (const selected of [false, true]) {
            const graph = /** @type {Exp} */ (['===', ['?:', selected, shared, ['[]', []]], shared])
            let restored = graph
            for (let i = 0; i < 4; i += 1) {
                assertEq(assertOk(memo(assertOk(identityAnalysis(restored)))({ args: [] })), selected)
                roundTrip(restored)
                restored = fromFast(assertOk(toFast(restored)))
            }
        }
        const skipped = /** @type {const} */ (['throw', 1])
        const graph = /** @type {Exp} */ (['[]', [['?:', false, skipped, 0], ['?:', false, skipped, 1]]])
        for (const value of [graph, fromFast(assertOk(toFast(graph)))]) {
            assertStructurallySame(assertOk(memo(assertOk(identityAnalysis(value)))({ args: [] })), ['[]', [0, 1]])
        }
    },
    sharedOwnerCapturesRemainInvocationLocal: () => {
        const shared = /** @type {const} */ (['[]', [7]])
        const closure = /** @type {const} */ (['=>', 0, [shared], ['frame', 0]])
        const fn = /** @type {const} */ (['=>', 0, [], ['[]', [['()', ['=>', 0, [], 0], []], shared, shared, closure]]])
        const first = /** @type {const} */ (['()', fn, []])
        const second = /** @type {const} */ (['()', fn, []])
        const graph = /** @type {Exp} */ (['[]', [
            ['===', ['.', first, 1], ['.', first, 2]],
            ['===', ['()', ['.', first, 3], []], ['.', first, 1]],
            ['!==', ['.', first, 1], ['.', second, 1]],
        ]])
        let restored = graph
        for (let i = 0; i < 4; i += 1) {
            assertStructurallySame(assertOk(memo(assertOk(identityAnalysis(restored)))({ args: [] })), ['[]', [true, true, true]])
            restored = fromFast(assertOk(toFast(restored)))
        }
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
