/**
 * Graph conversion preserves identity and execution regions before physical
 * preparation. Pure cross-lazy reads have the explicitly documented source
 * normalization; allocations, calls and required work retain their owner.
 *
 * @import { Block, BindingId, Function as FastFunction, Value } from '../../js/ast/types.ts'
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { Analysis, Node } from '../analysis/types.ts'
 * @import { EdagValue, Values } from '../value/types.ts'
 * @import { List } from '../../types/list/types.ts'
 */

import { conditional } from '../testlib.f.js'
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis, identityAnalysis } from '../analysis/module.f.js'
import { fromFast } from '../from_fast/module.f.js'
import { fromAnalysis, functionFromAnalysis, toFast } from './module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { memo, invoke } from '../memo/module.f.js'
import { vm } from '../amnesia/module.f.js'
import { toData } from '../value/to_unknown/module.f.js'
import { sourceReason } from './source/module.f.js'
import { call } from '../value/call/module.f.js'
import { read } from '../value/property/module.f.js'
import { strictEqual } from '../value/semantics/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { prepare } from '../../js/ast/prepare/module.f.js'
import { stringify } from '../../js/ast/serializer/module.f.js'
import { tryFunctionText, tryStringify } from '../../compiler/serializer/module.f.js'
import { parse } from '../../compiler/source/module.f.js'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.js'
import { generate } from '../../types/array/module.f.js'

/** Compare semantic graph tables without merging allocation identities. @type {(graph: Exp) => void} */
const roundTrip = graph => assertStructurallySame(assertOk(analysis(fromFast(assertOk(toFast(graph))))), assertOk(analysis(graph)))

/** @param {Exp} graph */
const run = graph => memo(assertOk(identityAnalysis(graph)))({ args: [] })

/** @type {(fn: EdagValue, args?: Values) => EdagValue} */
const apply = (fn, args = []) => assertOk(call(ok(fn), args.map(arg => () => ok(arg)), invoke))

/** @type {(value: EdagValue) => Values} */
const elements = value => {
    assert(value instanceof Array && value[0] === '[]')
    return value[1]
}

/** Both writers emit FunctionalScript for these groups. Read each module back
 * through the parser to exercise its declarations, captures, and export.
 * @type {(graph: Exp) => readonly Exp[]} */
const groupRoundTrips = graph => {
    const fast = assertOk(toFast(graph))
    /** @param {string} text */
    const readBack = text => _defaultExport(unresolved(assertOk(parse('/group.f.js')(text))).edag)
    return [graph, fromFast(fast), readBack(assertOk(tryStringify(graph))), readBack(stringify(prepare(fast), 'module', true))]
}

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
    groupMembersRetainPeersAndTheirFrame: () => {
        const group = /** @type {const} */ (['group', [['arg', 0]], [
            [1, ['=>', 0, [['self', 1], ['arg', 0]], ['[]', [['frame', 0], ['frame', 1]]]]],
            [0, ['[]', [['self', 0], ['frame', 0], ['rest']]]],
        ]])
        const graph = /** @type {const} */ (['=>', 1, [], ['[]', [['fn', group, 0], ['fn', group, 1]]]])
        for (const candidate of groupRoundTrips(graph)) {
            const make = assertOk(run(candidate))
            const [first, second] = elements(apply(make, ['outer']))
            const [again, captured, rest] = elements(apply(second, [1, 2]))
            assert(strictEqual(again, first))
            assertEq(captured, 'outer')
            assertStructurallySame(rest, ['[]', [1, 2]])
            const [other, arg] = elements(apply(apply(first, ['inner'])))
            assert(strictEqual(other, second))
            assertEq(arg, 'inner')
            assertEq(assertOk(read(ok(first), 'length')), 1)
            const [, next] = elements(apply(make, ['next']))
            assertEq(elements(apply(next))[1], 'next')
        }
    },
    aProjectionAloneDeclaresEveryMember: () => {
        const group = /** @type {const} */ (['group', [], [[0, ['self', 1]], [0, ['self', 0]]]])
        const graph = /** @type {const} */ (['fn', group, 1])
        assertEq(assertOk(tryFunctionText(graph)), '()=>$0')
        assertEq(assertOk(tryStringify(graph)), 'const $0=()=>$1;const $1=()=>$0;export default $1;')
        for (const candidate of groupRoundTrips(graph)) {
            const selected = assertOk(run(candidate))
            const sibling = apply(selected)
            assertEq(strictEqual(sibling, selected), false)
            assert(strictEqual(apply(sibling), selected))
        }
    },
    selectedGroupEntry: () => {
        const group = /** @type {const} */ (['group', [], [[0, ['throw', ['self', 1]]], [0, ['self', 0]]]])
        const selected = /** @type {const} */ (['fn', group, 0])
        roundTrip(selected)
        const a = assertOk(identityAnalysis(selected))
        const owner = a.nodes.findIndex(node => node[0] === 'group')
        const binding = { index: 10 }
        assertStructurallySame(fromAnalysis(a, [[owner, binding]]).exit, ['yield', [['.', ['ref', binding], 0]]])
        assertEq(functionFromAnalysis(a, /** @type {readonly ['#', number]} */ (a.root)[1]).target.member, 0)
        const shared = /** @type {const} */ (['[]', []])
        const repeated = assertOk(identityAnalysis(['fn', ['group', [['[]', [shared, shared]]], [
            [0, ['self', 1]], [0, ['[]', [['frame', 0], ['self', 0]]]],
        ]], 1]))
        assertEq(functionFromAnalysis(repeated, /** @type {readonly ['#', number]} */ (repeated.root)[1]).target.member, 1)
    },
    sharedGroupFrame: () => {
        const group = /** @type {const} */ (['group', [['arg', 0]], [
            [0, ['[]', [['self', 1], ['frame', 0]]]], [1, ['[]', [['self', 0], ['arg', 0], ['rest']]]],
        ]])
        roundTrip(['=>', 1, [], ['[]', [['fn', group, 0], ['fn', group, 1]]]])
    },
    lazyProjectionsDemandOneFrame: () => {
        const lazy = /** @type {const} */ (['group', [['()', ['arg', 0], []]], [
            [0, ['[]', [['self', 1], ['frame', 0]]]],
            [0, ['[]', [['self', 0], ['frame', 0]]]],
        ]])
        const select = /** @type {const} */ (['=>', 2, [], ['[]', [
            ['?:', ['arg', 1], ['fn', lazy, 0], 0], ['?:', ['arg', 1], ['fn', lazy, 1], 0],
        ]]])
        const block = assertOk(toFast(select))
        const fn = /** @type {readonly ['function', FastFunction]} */ (/** @type {Extract<Block['exit'], readonly ['yield', unknown]>} */ (block.exit)[1][0])[1]
        assert(fn.body.statements.some(statement => statement[0] === 'define' && statement[3] === 'lazy'))

        const make = fromFast(block)
        const failing = /** @type {const} */ (['=>', 0, [], ['throw', 'capture demanded']])
        assertStructurallySame(assertOk(run(['()', make, [failing, false]])), ['[]', [0, 0]])
        assertEq(assertError(run(['()', make, [failing, true]])), 'capture demanded')

        // Each call of the capture function allocates an array. Both
        // members must return the very same array and one another.
        const pair = /** @type {const} */ (['()', make, [['=>', 0, [], ['[]', []]], true]])
        const first = /** @type {const} */ (['.', pair, 0])
        const second = /** @type {const} */ (['.', pair, 1])
        const left = /** @type {const} */ (['()', first, []])
        const right = /** @type {const} */ (['()', second, []])
        const captured = /** @type {const} */ (['.', left, 1])
        assertStructurallySame(assertOk(run(['[]', [
            captured, ['===', captured, ['.', right, 1]],
            ['===', ['.', left, 0], second], ['===', ['.', right, 0], first],
        ]])), ['[]', [['[]', []], true, true, true]])
    },
    // A named import is its module's computations, then the export it
    // selects. Once those are bound, reading them again does nothing, so the
    // selection is the export alone. A computation still deferred is
    // evaluated by that read, and stays.
    establishedAnchorsAreNotReadAgain: () => {
        /** @type {Exp} */
        const made = ['()', ['=>', 0, [], ['[]', [7]]], []]
        /** @type {Exp} */
        const exported = ['{}', [[':', 'a', made]]]
        /** @type {Exp} */
        const selections = ['[]', [exported, [',', [exported, made]], [',', [exported, 2]]]]
        const block = assertOk(toFast(selections))
        const [values] = /** @type {Extract<Block['exit'], readonly ['yield', unknown]>} */ (block.exit)[1]
        const [, first, second] = /** @type {readonly unknown[]} */ (/** @type {Extract<Value, readonly ['array', unknown]>} */ (values)[1])
        // the module's object is bound once, before; neither selection is a block that reads it
        assertEq(/** @type {readonly unknown[]} */ (first)[0], 'ref')
        assertEq(second, 2)
        // the graph read back has no comma left, and evaluates to the same value
        for (const graph of [selections, fromFast(block)]) {
            assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] })))), [{ a: [7] }, [7], 2])
        }
        /** @type {Exp} */
        const deferred = ['=>', 1, [], ['[]', [['?:', ['arg', 0], [',', [made, 1]], 3], ['?:', ['arg', 0], [',', [made, 2]], 4]]]]
        roundTrip(deferred)
        for (const [argument, expected] of /** @type {const} */ ([[true, [1, 2]], [false, [3, 4]]])) {
            assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(['()', fromFast(assertOk(toFast(deferred))), [argument]])))({ args: [] })))), expected)
        }
    },
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
            ['!', 1], ['~', 2], ['-', ['[]', []]], ['+', ['[]', []]], ['typeof', 1], ['Number', '3'], ['BigInt', '3'], ['BigInt', 1.5], ['String', 2], ['Boolean', ['undefined']], ['Boolean', ['{}', []]],
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
        roundTrip(['?.', null, 'x', ['|()', [], ['|.', 'y']]])
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
        for (let i = 0; i < 4; i += 1) {
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
        // Both arms read the call, so the function reads it on every path:
        // it is required before the selection, which the graph reads back as
        // its anchor.
        /** @type {Exp} */
        const selection = ['?:', ['arg', 0], [',', [call, 0]], call]
        assertStructurallySame(assertOk(analysis(fromFast(assertOk(toFast(['=>', 1, [], selection]))))), assertOk(analysis(['=>', 1, [], [',', [call, selection]]])))
    },
    operandClosuresCaptureComputedValues: () => {
        const computed = /** @type {const} */ (['()', ['=>', 0, [], ['[]', [3]]], []])
        const closure = /** @type {const} */ (['=>', 0, [computed], ['frame', 0]])
        const graph = /** @type {Exp} */ (['[]', [0, closure]])
        roundTrip(graph)
        const value = /** @type {Exp} */ (['()', ['.', graph, 1], []])
        assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(fromFast(assertOk(toFast(value))))))({ args: [] })))), [3])
    },
    operandClosuresCaptureObjects: () => {
        /** @type {readonly Exp[]} */
        const objects = [
            ['{}', [[':', 'value', 1]]],
            ['{}', [[':', ['String', 1], 1]]],
            ['{}', [['...', ['{}', []]]]],
            ['{}', [[':', 'value', ['+', 1, 2]]]],
        ]
        for (const object of objects) {
            const graph = /** @type {Exp} */ (['[]', [0, ['=>', 0, [object], ['frame', 0]]]])
            roundTrip(graph)
            const call = /** @type {Exp} */ (['()', ['.', graph, 1], []])
            assertStructurallySame(
                assertOk(toData(assertOk(memo(assertOk(identityAnalysis(fromFast(assertOk(toFast(call))))))({ args: [] })))),
                assertOk(toData(assertOk(memo(assertOk(identityAnalysis(call)))({ args: [] })))),
            )
        }
    },
    emptySequence: () => {
        assertStructurallySame(fromFast(fromAnalysis(assertOk(identityAnalysis([',', []])))), ['undefined'])
    },
    functions: () => {
        const captured = /** @type {const} */ (['[]', [1]])
        roundTrip(['=>', 1, [captured], ['[]', [['arg', 0], ['rest'], ['frame', 0]]]])
        roundTrip(['=>', 1, [], ['()', ['self'], [['arg', 0]]]])
        roundTrip(['=>', 0, [], ['self']])
        assertStructurallySame(fromFast(assertOk(toFast(['=>', 0, [1], ['frame', 0]]))), ['=>', 0, [], 1])
        roundTrip(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]])
        roundTrip(['=>', 1, [], ['?:', ['>', ['arg', 0], 0], ['()', ['self'], [['-', ['arg', 0], 1]]], ['self']]])
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
    // An expansion is no barrier: a shared owner that follows one is
    // established before it, which the graph reads back as the owner's
    // anchor. Either order fails here, on the expansion or on the owner.
    sharedOwnersAreEstablishedBeforeAnExpansion: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const another = /** @type {const} */ (['()', forever[1], []])
        /** @type {Exp} */
        const shared = ['[]', [['...', null], ['+', 1, 2], ['+', 3, 4], forever, forever]]
        assertStructurallySame(assertOk(analysis(fromFast(assertOk(toFast(shared))))), assertOk(analysis([',', [forever, shared]])))
        roundTrip(['[]', [['...', null], forever, another, forever, another]])
    },
    // A selected operand is a barrier no snapshot crosses: an owner first
    // reached inside one, and shared with what follows, keeps its first
    // demand, whatever its own operands or captures are.
    selectedOperandsRetainLaterSharedOwners: () => {
        const forever = /** @type {const} */ (['()', ['=>', 0, [], ['()', ['self'], []]], []])
        const another = /** @type {const} */ (['()', forever[1], []])
        const recursive = /** @type {const} */ (['=>', 1, [], ['()', ['self'], [['arg', 0]]]])
        const first = /** @type {const} */ (['()', recursive, [['+', 1, 2]]])
        const second = /** @type {const} */ (['()', recursive, [['+', 3, 4]]])
        const capturing = /** @type {const} */ (['=>', 0, [['arg', 0]], ['frame', 0]])
        const graphs = /** @type {readonly Exp[]} */ ([
            ['[]', [['?:', 1, forever, 1], ['?:', 1, another, 1], forever, another]],
            ['[]', [['?:', 1, ['[]', [first, second]], 1], second, first]],
            ['=>', 1, [], ['[]', [['?:', 1, capturing, 1], capturing]]],
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
        const nodes = generate(count, i => {
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
            assertEq(restored[0], nodes[Number(count - 1 - length)][0])
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
