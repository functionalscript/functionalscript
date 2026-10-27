/**
 * @import { Block, BindingId, LoopTarget } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _tailCalls } from './module.f.mjs'
import { proof as semantic, _tailFunction } from '../tail_calls/proof.f.mjs'
import { toFast } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { evaluate } from '../../from_fast/member_returns/proof.f.mjs'

export const proof = /** @type {const} */ ({
    semantic,
    extraArgumentsMaterializeBeforeSimultaneousParameterUpdates: () => {
        const self = /** @type {BindingId} */ ({ index: 1 })
        const first = /** @type {BindingId} */ ({ index: 2 })
        const second = /** @type {BindingId} */ ({ index: 3 })
        const target = /** @type {LoopTarget} */ ({ kind: 'loop', index: 0 })
        const args = /** @type {const} */ ([['ref', second], ['ref', first], ['+', ['ref', first], ['ref', second]]])
        const normalized = _tailCalls({ statements: [], exit: ['yield', [['()', ['ref', self], args]]] }, [first, second], self, target)
        assert(normalized !== null)
        assertEq(normalized.statements.length, 1)
        const definition = normalized.statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[3], 'required')
        assertStructurallySame(definition[2], ['array', args])
        assert(definition[2] instanceof Array && definition[2][0] === 'array')
        assertEq(definition[2][1], args)
        assertStructurallySame(normalized.exit, ['continue', target, [['.', ['ref', definition[1]], 0], ['.', ['ref', definition[1]], 1]]])
        assert(definition[1] !== first && definition[1] !== second && definition[1] !== self)
    },
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
