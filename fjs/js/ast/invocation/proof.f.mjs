/** @import { Block, Value } from '../types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { _invocationTransition, _isSelf, _restArguments, _restTransition } from './module.f.js'

const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const first = /** @type {const} */ ({ index: 0 })
const second = /** @type {const} */ ({ index: 1 })
const result = /** @type {const} */ ({ index: 2 })

/** @type {(transition: Block) => import('../../../edag/value/control/types.ts').ValueResult} */
const runTransition = transition => {
    /** @type {Block} */
    const block = { statements: [['loop', { target, parameters: [first, second], initial: [1, 9], results: [result],
        body: { statements: [['if', [], ['>', ['ref', first], 0], transition,
            { statements: [], exit: ['break', target, [['array', [['ref', first], ['ref', second]]]]] }]],
        exit: ['continue', target, [['ref', first], ['ref', second]]] } }]], exit: ['yield', [['ref', result]]] }
    return memo(assertOk(identityAnalysis(fromFast(block))))({ args: [] })
}

export const proof = /** @type {const} */ ({
    selfAliasesUseResolvedBindingIdentity: () => {
        const sameIndex = /** @type {const} */ ({ ...first })
        assert(_isSelf(['ref', first], [first, second]))
        assert(_isSelf(['ref', second], [first, second]))
        assert(!_isSelf(['ref', sameIndex], [first, second]))
        assert(!_isSelf(['ref', first], []))
        /** @type {readonly Value[]} */
        const others = [0, null, ['array', [['ref', first]]]]
        for (const value of others) {
            assert(!_isSelf(value, [first]))
        }
    },
    fixedCallsPadMissingValuesAndPreserveArrayArguments: () => {
        assertStructurallySame(_invocationTransition(0, [], target), { statements: [], exit: ['continue', target, []] })
        const missing = runTransition(_invocationTransition(2, [0], target))
        assertStructurallySame(assertOk(toData(assertOk(missing))), [0, undefined])
        const arrayArgument = runTransition(_invocationTransition(2, [0, ['array', [7]]], target))
        assertStructurallySame(assertOk(toData(assertOk(arrayArgument))), [0, [7]])
    },
    expandedAndUnusedArgumentsRemainRequired: () => {
        const extra = runTransition(_invocationTransition(2, [0, 3, 99], target))
        assertStructurallySame(assertOk(toData(assertOk(extra))), [0, 3])
        const spread = runTransition(_invocationTransition(2, [['...', ['array', [0, 4, 99]]]], target))
        assertStructurallySame(assertOk(toData(assertOk(spread))), [0, 4])
        assertError(runTransition(_invocationTransition(2, [0, 3, ['+', 1, 1n]], target)))
        assertError(runTransition(_invocationTransition(2, [['...', null]], target)))
    },
    inverse: () => {
        const args = /** @type {const} */ ([1, ['...', ['array', [2, 3]]]])
        for (const length of [0, 1, 16]) {
            const block = _restTransition(length, args, target)
            assertEq(_restArguments(block, length, target), args)
            assert(block.exit[0] === 'continue')
            assertEq(block.exit[2].length, length + 1)
            assert(_restTransition(length, args, target).statements[0][1] !== block.statements[0][1])
        }
    },
    onlyTheExactPrivateRecipeIsAnInvocation: () => {
        const block = _restTransition(1, [1, 2], target)
        const statement = block.statements[0]
        assert(statement[0] === 'define' && block.exit[0] === 'continue')
        const binding = statement[1]
        const different = /** @type {const} */ ({ ...binding })
        const rest = block.exit[2][1]
        const fixed = block.exit[2][0]
        for (const changed of /** @type {readonly Block[]} */ ([
            { ...block, exit: ['break', target, [1]] },
            { ...block, exit: ['continue', { ...target }, block.exit[2]] },
            { ...block, exit: ['continue', target, []] },
            { ...block, statements: [] },
            { ...block, statements: [['block', [], { statements: [], exit: ['yield', []] }]] },
            { ...block, statements: [['define', binding, statement[2], 'lazy']] },
            { ...block, statements: [['define', binding, 1, 'required']] },
            { ...block, statements: [['define', binding, ['object', []], 'required']] },
            ...[1, ['ref', binding], ['.', ['ref', binding], 0, ['|.', 0]], ['.', 1, 0], ['.', ['ref', different], 0], ['.', ['ref', binding], 1]].map(value =>
                /** @type {Block} */ ({ ...block, exit: ['continue', target, [/** @type {Value} */ (value), rest]] })),
            ...[1, ['array', []], ['()', 1, []], ['()', ['entry'], []], ['()', ['slice'], []], ['()', ['slice'], [1, 1]],
                ['()', ['slice'], [['ref', different], 1]], ['()', ['slice'], [['ref', binding], 2]]].map(value =>
                /** @type {Block} */ ({ ...block, exit: ['continue', target, [fixed, /** @type {Value} */ (value)]] })),
        ])) { assertEq(_restArguments(changed, 1, target), null) }
    },
})
