/** @import { Block, Value } from '../types.ts' */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { _restArguments, _restTransition } from './module.f.js'

const target = /** @type {const} */ ({ kind: 'loop', index: 0 })

export const proof = /** @type {const} */ ({
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
