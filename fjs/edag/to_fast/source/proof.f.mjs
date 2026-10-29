/**
 * Source admission retains the supported graph domain before target rendering.
 *
 * @import { Exp, ExpOp } from '../../types.ts'
 * @import { Analysis, Node } from '../../analysis/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Block, Value } from '../../../js/ast/types.ts'
 */

import { conditional } from '../../testlib.f.js'
import { assertEq, assertOk } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { fromAnalysis } from '../module.f.mjs'
import { fromFast } from '../../from_fast/module.f.mjs'
import { sourceReason } from './module.f.mjs'
import { reverse } from '../../../types/list/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.mjs'

/** @type {(value: Exp, module?: boolean) => string | null} */
const reason = (value, module = false) => {
    const table = assertOk(identityAnalysis(value))
    return sourceReason(table, fromAnalysis(table), module)
}

/** @type {(value: Exp) => Exp} */
const shared = value => ['?:', true, value, value]

export const proof = {
    captures: () => {
        /** @type {Exp} */
        const array = ['[]', []]
        assertEq(reason(['=>', 0, [1], ['frame', 0]]), 'a frame slot holding a primitive')
        const missing = /** @type {const} */ (['undefined'])
        assertEq(reason(['[]', [missing, ['=>', 0, [missing], ['frame', 0]]]]), 'a frame slot holding a primitive')
        assertEq(reason(['=>', 0, [array, array], ['[]', [['frame', 0], ['frame', 1]]]]), 'a frame slot that repeats another')
        assertEq(reason(['=>', 1, [], ['=>', 0, [['arg', 0], ['arg', 0]], ['[]', [['frame', 0], ['frame', 1]]]]]), 'a frame slot that repeats another')
        assertEq(reason(['=>', 0, [array], 1]), 'a frame slot the body never reads')
        assertEq(reason(['=>', 0, [array], ['frame', 0]]), null)
        assertEq(reason(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]]), null)
        assertEq(reason(['=>', 0, [], ['=>', 0, [['rest']], ['frame', 0]]]), null)
        assertEq(reason(['=>', 0, [array], ['=>', 0, [['frame', 0]], ['frame', 0]]]), null)
        assertEq(reason(['[]', [['=>', 0, [], 1], ['=>', 0, [], 1]]]), null)
    },
    sourceShapes: () => {
        assertEq(reason(1), null)
        assertEq(reason(['args']), 'a args node')
        assertEq(reason(['memberPresent', null, 'x']), 'an internal member-presence query')
        assertEq(reason(['memberPresent', ['[]', []], ['Number', 0]], true), 'an internal member-presence query')
        assertEq(reason(['()', ['=>', 0, [], 1], [['args']]]), 'a args node')
        assertEq(reason(['+', 1, 2]), null)
        assertEq(reason(['+', 1]), 'a unary + node')
        assertEq(reason([',', []]), 'a comma with fewer than two operands')
        assertEq(reason([',', [1]]), 'a comma with fewer than two operands')
        assertEq(reason([',', [1, 2]]), null)
        assertEq(reason(['[]', [[',', [1, 2]]]]), null)
        const operand = /** @type {const} */ ([',', [1, 2]])
        assertEq(reason(['[]', [operand, operand]]), 'a shared comma outside a scope')
        assertEq(reason(['[]', [[',', [1, 2]]]], true), null)
        assertEq(reason(['=>', 0, [], [',', [['rest'], 1]]]), 'an anchor that is a name')
        assertEq(reason(['?:', true, [',', [1, 2]], 3]), null)
        assertEq(reason(conditional('&&', false, [',', [1, 2]])), null)
        assertEq(reason(conditional('&&', false, 1), true), null)
        assertEq(reason(['throw', 1]), null)
        /** @type {Exp} */
        const scalar = ['+', 1, 2]
        assertEq(reason(shared(scalar)), null)
        assertEq(reason(shared(['+', scalar, scalar])), null)
        assertEq(reason(shared(['Object.is'])), null)
        assertEq(reason(shared([',', [1, 2]])), 'a shared node reached from outside the lazy operand that establishes it')
    },
    keys: () => {
        assertEq(reason(['.', null, 'length']), null)
        assertEq(reason(['.', null, 'constructor']), 'a prohibited property name')
        assertEq(reason(['.', null, 'push', ['|()', [0]]]), 'a prohibited member function')
        assertEq(reason(['.', null, 0]), null)
        for (const key of [NaN, Infinity, -0]) { assertEq(reason(['.', null, key]), 'a number key no literal reads back') }
        assertEq(reason(['.', null, ['Number', 0]]), null)
        assertEq(reason(/** @type {Exp} */ (/** @type {unknown} */ (['.', null, true]))), 'an access key that is no literal')
        assertEq(reason(/** @type {Exp} */ (/** @type {unknown} */ (['=>', 0, [], ['.', ['rest'], ['rest']]]))), 'an access key that is no literal')
        const key = /** @type {const} */ (['Number', 0])
        assertEq(reason(['[]', [['.', null, key], ['.', null, key]]]), 'a shared computed key')
        assertEq(reason(['?.', null, 'length', ['|.', 'at']]), 'a prohibited property name')
        assertEq(reason(['?.', null, 'x', ['|.', 'push', ['|()', []]]]), 'a prohibited member function')
        assertEq(reason(['?.', null, ['Number', [',', [1, 2]]], ['|.', ['Number', [',', [3, 4]]]]]), null)
        assertEq(reason(['?.()', null, [[',', [1, 2]]], ['|.', 'x', ['|?.()', [[',', [3, 4]]]]]]), null)
        const escaped = /** @type {Exp} */ ([
            '.', null, 'x',
            ['|?.()', [[',', [1, 2]]], ['|.', 'y', ['|!()', [[',', [3, 4]]]]]],
        ])
        assertEq(reason(escaped), null)
        assertEq(reason(['.', null, 'x', ['|()', [1]]]), null)
        assertEq(reason(['?.()', null, [1]]), null)
    },
    /** Direct result regions carry values without creating a capture boundary. */
    regions: () => {
        const first = { index: 0 }
        const result = { index: 1 }
        /** @type {Block} */
        const fast = {
            statements: [
                ['block', [first], { statements: [], exit: ['yield', [1]] }],
                ['if', [result], true,
                    { statements: [], exit: ['yield', [['ref', first]]] },
                    { statements: [], exit: ['yield', [2]] },
                ],
            ],
            exit: ['yield', [['ref', result]]],
        }
        const table = assertOk(identityAnalysis(fromFast(fast)))
        assertEq(sourceReason(table, fast), null)
    },
    identity: () => {
        /** @type {readonly Exp[]} */
        const minting = [
            ['[]', []], ['{}', []], ['=>', 0, [], 1], ['entry'], ['hasEntry'], ['slice'],
            ['()', ['=>', 0, [], 1], []], ['?.()', null, []], ['?.', null, 'x', ['|.', 'y']],
        ]
        for (const value of minting) {
            assertEq(reason(shared(value)), 'a shared node reached from outside the lazy operand that establishes it')
        }
        /** @type {Exp} */
        const array = ['[]', []]
        const field = /** @type {Exp} */ (['.', array, 'length'])
        assertEq(reason(shared(['+', 1, field])), 'a shared node reached from outside the lazy operand that establishes it')
        assertEq(reason(shared(field)), 'a shared node reached from outside the lazy operand that establishes it')
        assertEq(reason([',', [array, shared(field)]]), null)
        assertEq(reason(['?:', true, ['[]', [1]], ['[]', [1]]]), null)
        assertEq(reason(['=>', 1, [], ['?:', ['<', ['arg', 0], 3], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]]), null)
    },
    deepValues: () => {
        /** @type {Exp} */
        let value = 1
        /** @type {Value} */
        let normalized = 1
        /** @type {List<ExpOp>} */
        let exps = null
        const count = 20_000
        const nodes = Array.from({ length: count }, (_, index) => /** @type {Node} */ (['~', index === 0 ? 1 : ['#', index - 1]]))
        for (let depth = 0; depth < count; depth += 1) { value = ['~', value]; normalized = ['~', normalized]; exps = { first: value, tail: exps } }
        /** @type {Analysis} */
        const table = { root: ['#', count - 1], nodes, scope: nodes.map(() => -1), shared: [], exps: toArray(reverse(exps)) }
        assertEq(sourceReason(table, { statements: [], exit: ['yield', [normalized]] }), null)
    },
}
