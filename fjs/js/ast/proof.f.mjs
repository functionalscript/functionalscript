/**
 * Resolved write/capture facts and operand mappings preserve identity and metadata.
 *
 * @import { BindingScope, Entry, Operator, Step, Value } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { analyzeBindings, isSpread, mapOperator, operatorOperands } from './module.f.mjs'

export const proof = {
    bigintOperands: () => {
        assertStructurallySame(operatorOperands(['BigInt', 7]), [7])
        assertStructurallySame(mapOperator(value => value + 1)(['BigInt', 7]), ['BigInt', 8])
    },
    spreadItems: () => {
        const spread = /** @type {typeof isSpread<Value>} */ (isSpread)
        const operand = /** @type {Value} */ (['array', [1]])
        assertEq(spread(['...', operand]), true)
        assertEq(spread(operand), false)
        assertEq(spread(3), false)
        assertEq(spread('...'), false)
    },
    bindings: {
        empty: () => {
            assertStructurallySame(analyzeBindings({ target: { kind: 'function', index: 0 }, bindings: [], events: [] }), [])
            assertStructurallySame(analyzeBindings({ target: { kind: 'function', index: 0 }, bindings: [], events: [['read', { index: 0 }]] }), [])
        },
        wideCaptures: () => {
            const ids = Array.from({ length: 20_000 }, (_, index) => ({ index }))
            const outer = /** @type {const} */ ({ kind: 'function', index: 0 })
            const first = /** @type {const} */ ({ kind: 'function', index: 1 })
            const second = /** @type {const} */ ({ kind: 'function', index: 1 })
            const facts = analyzeBindings({ target: outer, bindings: ids, events: [
                ['function', { target: first, bindings: [], events: ids.flatMap(id => /** @type {const} */ ([['read', id], ['read', id]])) }],
                ['function', { target: second, bindings: [], events: ids.map(id => ['write', id]) }],
            ] })
            assertEq(facts.length, ids.length)
            for (const [index, fact] of facts.entries()) {
                assertEq(fact.id, ids[index])
                assertEq(fact.isMutable, true)
                assertEq(fact.capturedBy.length, 2)
                assertEq(fact.capturedBy[0], first)
                assertEq(fact.capturedBy[1], second)
            }
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
    deepChains: () => {
        /** @type {Step<number>} */
        let step = ['|!()', [2]]
        for (let i = 0; i < 20_000; i += 1) { step = ['|.', ['Number', 1], step] }
        const mapped = mapOperator((value, index) => value + index)(['?.', 0, 'x', step])
        const operands = operatorOperands(mapped)
        assertEq(operands.length, 20_002)
        assertEq(operands[1], 2)
        assertEq(operands[20_000], 20_001)
        assertEq(operands[20_001], 20_003)
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
            [['memberPresent', 1, 'x'], ['memberPresent', 11, 'x'], [1]],
            [['memberPresent', 1, 2], ['memberPresent', 11, 2], [1]],
            [['memberPresent', 1, ['Number', 2]], ['memberPresent', 11, ['Number', 12]], [1, 2]],
            [['?.', 1, ['Number', 2]], ['?.', 11, ['Number', 12]], [1, 2]],
            [['.', 1, 'x', ['|.', ['Number', 2], ['|()', [3], ['|?.()', [['...', 4]], ['|!()', [5]]]]]],
                ['.', 11, 'x', ['|.', ['Number', 12], ['|()', [13], ['|?.()', [['...', 14]], ['|!()', [15]]]]]], [1, 2, 3, 4, 5]],
            [['?.', 1, 'x', ['|.', 'y']], ['?.', 11, 'x', ['|.', 'y']], [1]],
            [['?.()', 1, [2]], ['?.()', 11, [12]], [1, 2]],
            [['?.()', 1, [2], ['|?.()', [3]]], ['?.()', 11, [12], ['|?.()', [13]]], [1, 2, 3]],
            [['?.()', 1, [], ['|()', [2]]], ['?.()', 11, [], ['|()', [12]]], [1, 2]],
            [['instanceof', 1, 'Array'], ['instanceof', 11, 'Array'], [1]],
            [['in', 'x', 1], ['in', 'x', 11], [1]],
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
    wideObject: () => {
        const width = 20_000
        const shared = { index: 0 }
        /** @type {readonly Entry<typeof shared>[]} */
        const entries = Array.from({ length: width }, (_, index) => index % 2 === 0 ? [':', shared, shared] : ['...', shared])
        const mapped = mapOperator((value, index) => /** @type {const} */ ([value, index]))(['object', entries])
        assert(mapped[0] === 'object')
        assertEq(mapped[1].length, width)
        for (const [index, entry] of mapped[1].entries()) { assertEq(entry[0], index % 2 === 0 ? ':' : '...') }
        const operands = operatorOperands(mapped)
        assertEq(operands.length, width * 3 / 2)
        for (const [index, operand] of operands.entries()) {
            assertEq(operand[0], shared)
            assertEq(operand[1], index)
        }
        assertStructurallySame(mapOperator(value => value)(['object', []]), ['object', []])
    },
}
