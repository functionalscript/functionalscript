/**
 * @import { Block, BindingId, LoopTarget } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { _tailCalls } from './module.f.mjs'
import { proof as semantic, _tailFunction } from '../tail_calls/proof.f.mjs'
import { toFast } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { evaluate } from '../../from_fast/member_returns/proof.f.mjs'

export const proof = /** @type {const} */ ({
    semantic,
    nestedFinalSequencesRetainTheirTailEvaluation: () => {
        const graph = /** @type {Exp} */ (['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            [',', [['[]', [1]], [',', [['{}', []], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]], 'done']])
        assertEq(_tailFunction(graph).body.statements[0][0], 'loop')
        assertEq(evaluate(['()', fromFast(assertOk(toFast(graph))), [3]]), 'done')
    },
    deepTerminalRegions: () => {
        const self = /** @type {BindingId} */ ({ index: 0 })
        const parameter = /** @type {BindingId} */ ({ index: 1 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        /** @type {Block} */
        let source = { statements: [], exit: ['yield', [['()', ['ref', self], [['ref', parameter]]]]] }
        const count = /** @type {const} */ (20_000)
        for (let depth = 0; depth < count; ++depth) {
            source = { statements: [], exit: ['yield', [['if', true, source, { statements: [], exit: ['yield', [depth]] }]]] }
        }
        let converted = _tailCalls(source, [parameter], self, target)
        assert(converted !== null)
        for (let depth = 0; depth < count; ++depth) {
            assert(converted.statements[0][0] === 'if')
            converted = converted.statements[0][3]
        }
        assertEq(converted.exit[0], 'continue')
        assertEq(converted.exit[1], target)
    },
})
