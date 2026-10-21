/**
 * Resolved write/capture facts and operand mappings preserve identity and metadata.
 *
 * @import { BindingScope, Operator, Value } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { analyzeBindings, mapOperator, operatorOperands } from './module.f.mjs'

export const proof = {
    bindings: {
        empty: () => {
            assertStructurallySame(analyzeBindings({ target: { kind: 'function', index: 0 }, bindings: [], events: [] }), [])
        },
        /** Locals, parameters and expanded patterns share exactly one write rule. */
        wholeScope: () => {
            const a = { index: 0 }
            const b = { index: 1 }
            const parameter = { index: 2 }
            const pattern = { index: 3 }
            const snapshot = { index: 4 }
            // Equal diagnostic indices do not merge two binding identities.
            const innerLocal = { index: 0 }
            const outer = /** @type {const} */ ({ kind: 'function', index: 0 })
            const inner = /** @type {const} */ ({ kind: 'function', index: 1 })
            const deepest = /** @type {const} */ ({ kind: 'function', index: 2 })
            /** @type {BindingScope} */
            const scope = {
                target: outer,
                bindings: [a, b, parameter, pattern, snapshot],
                events: [
                    ['initialize', a], ['initialize', b], ['initialize', parameter],
                    ['initialize', pattern], ['initialize', snapshot],
                    ['read', a], ['read', parameter],
                    ['region', [['write', parameter]]],
                    ['function', {
                        target: inner,
                        bindings: [innerLocal],
                        events: [
                            ['initialize', innerLocal], ['read', innerLocal],
                            ['read', a], ['write', b], ['read', a], ['read', snapshot],
                            ['function', { target: deepest, bindings: [], events: [['read', a], ['write', parameter]] }],
                        ],
                    }],
                    // A capture before a later write is still mutable.
                    ['write', a],
                ],
            }
            const facts = analyzeBindings(scope)
            assertStructurallySame(facts, [
                { id: a, isMutable: true, capturedBy: [inner, deepest] },
                { id: b, isMutable: true, capturedBy: [inner] },
                { id: parameter, isMutable: true, capturedBy: [deepest] },
                { id: pattern, isMutable: false, capturedBy: [] },
                { id: snapshot, isMutable: false, capturedBy: [inner] },
                { id: innerLocal, isMutable: false, capturedBy: [] },
            ])
            assertEq(facts[0].id, a)
            assertEq(facts[5].id, innerLocal)
        },
    },
    operators: () => {
        /** @type {readonly (readonly [Operator<number>, Operator<number>, readonly number[]])[]} */
        const cases = [
            [['entry'], ['entry'], []],
            [['array', [1, ['...', 2]]], ['array', [11, ['...', 12]]], [1, 2]],
            [['object', [[':', 1, 2], ['...', 3], [':', 4, 5]]], ['object', [[':', 11, 12], ['...', 13], [':', 14, 15]]], [1, 2, 3, 4, 5]],
            [[',', [1, 2]], [',', [11, 12]], [1, 2]],
            [['()', 1, [2, ['...', 3]]], ['()', 11, [12, ['...', 13]]], [1, 2, 3]],
            [['.', 1, 'x'], ['.', 11, 'x'], [1]],
            [['?.', 1, ['Number', 2]], ['?.', 11, ['Number', 12]], [1, 2]],
            [['.', 1, 'x', ['|.', ['Number', 2], ['|()', [3], ['|?.()', [['...', 4]], ['|!()', [5]]]]]],
                ['.', 11, 'x', ['|.', ['Number', 12], ['|()', [13], ['|?.()', [['...', 14]], ['|!()', [15]]]]]], [1, 2, 3, 4, 5]],
            [['?.', 1, 'x', ['|.', 'y']], ['?.', 11, 'x', ['|.', 'y']], [1]],
            [['?.()', 1, [2]], ['?.()', 11, [12]], [1, 2]],
            [['?.()', 1, [2], ['|?.()', [3]]], ['?.()', 11, [12], ['|?.()', [13]]], [1, 2, 3]],
            [['?.()', 1, [], ['|()', [2]]], ['?.()', 11, [], ['|()', [12]]], [1, 2]],
            [['instanceof', 1, 'Array'], ['instanceof', 11, 'Array'], [1]],
            [['?:', 1, 2, 3], ['?:', 11, 12, 13], [1, 2, 3]],
            [['+', 1], ['+', 11], [1]],
            [['-', 1], ['-', 11], [1]],
            [['-', 1, 2], ['-', 11, 12], [1, 2]],
            [['~', 1], ['~', 11], [1]],
            [['!', 1], ['!', 11], [1]],
            [['typeof', 1], ['typeof', 11], [1]],
            [['Number', 1], ['Number', 11], [1]],
            [['String', 1], ['String', 11], [1]],
            [['+', 1, 2], ['+', 11, 12], [1, 2]],
            [['*', 1, 2], ['*', 11, 12], [1, 2]],
        ]
        for (const [operator, mapped, operands] of cases) {
            assertStructurallySame(mapOperator(value => value + 10)(operator), mapped)
            assertStructurallySame(operatorOperands(operator), operands)
            assertStructurallySame(operatorOperands(mapOperator((value, index) => [value, index])(operator)), operands.map((value, index) => [value, index]))
        }
        assertStructurallySame(mapOperator((_, index) => index)(['array', [NaN, NaN, 1, 1]]), ['array', [0, 1, 2, 3]])
        /** @type {Value} */
        const ordinaryTuple = ['array', []]
        /** @type {Operator<Value>} */
        const array = ['array', [ordinaryTuple]]
        assertEq(mapOperator(value => value)(array)[0], 'array')
        assertEq(operatorOperands(array)[0], ordinaryTuple)
        /** @type {Operator<number>} */
        const helper = ['Object.is']
        assertEq(mapOperator(value => value + 10)(helper), helper)
    },
}
