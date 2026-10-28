/** Required roots retain their evaluation order through anchor normalization.
 * @import { Exp } from '../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse } from '../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../compiler/edag/module.f.mjs'
import { tryModuleStringify } from '../../compiler/serializer/module.f.mjs'
import { analysis, identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'
import { toFast } from '../to_fast/module.f.mjs'
import { anchored, fromFast } from './module.f.mjs'

/** @type {(source: string) => Exp} */
const moduleGraph = source => unresolved(assertOk(parse('/anchors.f.js')(source))).edag

export const proof = {
    aFollowingRequiredRootOwnsItsContiguousDemandedPrefix: () => {
        const array = /** @type {Exp} */ (['[]', [4]])
        const member = /** @type {Exp} */ (['.', array, 0])
        const result = /** @type {Exp} */ (['+', member, 1])
        assertEq(anchored({ exp: result, anchors: [array, member] }), result)
        assertStructurallySame(anchored({ exp: 9, anchors: [array, member] }), [',', [member, 9]])
        const packed = /** @type {Exp} */ (['[]', [array, member]])
        const read = /** @type {Exp} */ (['.', packed, 0])
        assertEq(anchored({ exp: read, anchors: [array, member, packed] }), read)
        const distinct = /** @type {Exp} */ (['[]', [4]])
        assertStructurallySame(anchored({ exp: result, anchors: [distinct, member] }), [',', [distinct, result]])
    },
    requiredRootsDoNotMovePastFailuresOrLazyBarriers: () => {
        const earlier = /** @type {Exp} */ (['throw', 17])
        const second = /** @type {Exp} */ (['throw', 18])
        const condition = /** @type {Exp} */ (['arg', 0])
        const operation = /** @type {Exp} */ (['=>', 0, [], second])
        for (const later of /** @type {readonly Exp[]} */ ([
            ['+', second, earlier],
            ['+', ['.', null, 'x'], earlier],
            [',', [['()', operation, []], earlier]],
            ['?:', condition, earlier, 9],
            ['[]', [['...', ['arg', 1]], earlier]],
        ])) {
            const graph = anchored({ exp: 7, anchors: [earlier, later] })
            assertStructurallySame(graph, [',', [earlier, later, 7]])
            const invoked = /** @type {Exp} */ (['()', ['=>', 2, [], graph], [false, ['[]', []]]])
            assertEq(assertError(memo(assertOk(identityAnalysis(invoked)))({ args: [] })), 17)
        }
        const separate = anchored({ exp: 7, anchors: [earlier, second, earlier] })
        assertStructurallySame(separate, [',', [earlier, second, 7]])
        assertEq(assertError(memo(assertOk(identityAnalysis(separate)))({ args: [] })), 17)
    },
    selectedFactsDoNotPretendAnAnchorHasAlreadyExecuted: () => {
        const condition = /** @type {Exp} */ (['arg', 0])
        const array = /** @type {Exp} */ (['[]', [4]])
        const member = /** @type {Exp} */ (['.', array, 0])
        const selected = /** @type {Exp} */ (['?:', condition, member, 9])
        assertStructurallySame(anchored({ exp: 7, anchors: [array, selected] }), [',', [array, selected, 7]])
        assertStructurallySame(anchored({ exp: 7, anchors: [array, selected] }, [], [[condition, true]]), [',', [selected, 7]])
        assertStructurallySame(anchored({ exp: 7, anchors: [array, selected] }, [], [[['arg', 0], true]]), [',', [array, selected, 7]])
    },
    joinedIdentityPackingStabilizesAcrossGraphAndSourceGenerations: () => {
        const source = /** @type {const} */ ('export default (()=>{let i=0;let value=[0];let same=false;while(i<4){i=i+1;if(i>1){switch(i%2){case 0:{const item=[i];value=item;same=item===value;break;}default:{continue;}}value=[value,value];}else{value=[1];}}return [value[0]===value[1],value[0],same];})();')
        let current = moduleGraph(source)
        let previous = assertOk(identityAnalysis(current))
        for (let round = 0; round < 7; round = round + 1) {
            current = fromFast(assertOk(toFast(current)))
            const next = assertOk(identityAnalysis(current))
            if (round !== 0) { assertStructurallySame(next, previous) }
            assertStructurallySame(assertOk(toData(assertOk(memo(next)({ args: [] })))), { default: [true, [4], true] })
            previous = next
        }
        current = moduleGraph(source)
        let text = assertOk(tryModuleStringify(current))
        previous = assertOk(identityAnalysis(current))
        for (let round = 0; round < 7; round = round + 1) {
            current = moduleGraph(text)
            const next = assertOk(tryModuleStringify(current))
            const normalized = assertOk(identityAnalysis(current))
            if (round !== 0) {
                assertEq(next, text)
                assertStructurallySame(normalized, previous)
            }
            assertStructurallySame(assertOk(toData(assertOk(memo(normalized)({ args: [] })))), { default: [true, [4], true] })
            text = next
            previous = normalized
        }
    },
    discardedUndefinedAnchorsLeaveUsedLiteralPositionsIntact: () => {
        const first = /** @type {Exp} */ (['undefined'])
        const second = /** @type {Exp} */ (['undefined'])
        assertEq(anchored({ exp: 7, anchors: [first, second] }), 7)
        assertEq(anchored({ exp: first, anchors: [first, second] }), first)
        const used = /** @type {Exp} */ (['[]', [first, second]])
        assertEq(anchored({ exp: used, anchors: [first, second] }), used)
        assertStructurallySame(moduleGraph('const first=undefined;const second=undefined;export default 7;'), ['{}', [[':', 'default', 7]]])
    },
    removingUndefinedKeepsRequiredWorkIdentityAndFailureOrder: () => {
        const empty = /** @type {Exp} */ (['undefined'])
        const array = /** @type {Exp} */ (['[]', []])
        const object = /** @type {Exp} */ (['{}', []])
        const call = /** @type {Exp} */ (['()', ['=>', 0, [], 7], []])
        const failure = /** @type {Exp} */ (['throw', 17])
        for (const selected of [false, true]) {
            const conditional = /** @type {Exp} */ (['?:', selected, ['throw', 18], empty])
            const graph = anchored({ exp: 9, anchors: [empty, array, empty, object, call, conditional, empty, failure, empty] })
            assertStructurallySame(graph, [',', [array, object, call, conditional, failure, 9]])
            assert(graph instanceof Array && graph[0] === ',')
            assertEq(graph[1][0], array)
            assertEq(graph[1][1], object)
            assertEq(graph[1][2], call)
            assertEq(graph[1][3], conditional)
            assertEq(graph[1][4], failure)
            assertEq(assertError(memo(assertOk(identityAnalysis(graph)))({ args: [] })), selected ? 18 : 17)
        }
        const wrapped = /** @type {Exp} */ ([',', [['throw', 23], empty]])
        assertStructurallySame(anchored({ exp: 9, anchors: [wrapped] }), [',', [wrapped, 9]])
        assertEq(assertError(memo(assertOk(identityAnalysis(anchored({ exp: 9, anchors: [wrapped] }))))({ args: [] })), 23)
    },
    branchResultSlotInitializersDoNotGrowAcrossSourceGenerations: () => {
        const source = /** @type {const} */ ('export default n=>{let i=0;let sum=0;while(i<n){i=i+1;if(i>1){switch(i%2){case 0:{sum=sum+i;break;}default:{continue;}}sum=sum+10;}else{sum=1;}}return [i,sum];};')
        let current = moduleGraph(source)
        let text = assertOk(tryModuleStringify(current))
        let previous = assertOk(analysis(current))
        for (let round = 0; round < 4; round = round + 1) {
            current = moduleGraph(text)
            const next = assertOk(tryModuleStringify(current))
            const normalized = assertOk(analysis(current))
            for (const [input, expected] of /** @type {readonly (readonly [number, readonly number[]])[]} */ ([[0, [0, 0]], [1, [1, 1]], [4, [4, 27]]])) {
                const invoked = /** @type {Exp} */ (['()', _defaultExport(current), [input]])
                assertStructurallySame(assertOk(toData(assertOk(memo(assertOk(identityAnalysis(invoked)))({ args: [] })))), expected)
            }
            if (round !== 0) {
                assertEq(next, text)
                assertStructurallySame(normalized, previous)
            }
            text = next
            previous = normalized
        }
    },
}
