/** Ordered demands retain eager work, lazy selection and established identity.
 * @import { Exp } from '../types.ts'
 */

import { assertEq } from '../../asserts/module.f.js'
import { demandsInOrder, requiredPrefixLength } from './module.f.mjs'

const first = /** @type {const} */ (['.', null, 'first'])
const second = /** @type {const} */ (['.', null, 'second'])
const fn = /** @type {const} */ (['=>', 0, [], 0])

export const proof = /** @type {const} */ ({
    emptyAndPrimitiveRequests: () => {
        assertEq(demandsInOrder(['throw', 1], []), true)
        for (const primitive of [0, null, 1n, 'value', false]) {
            assertEq(demandsInOrder(primitive, [primitive]), false)
        }
        assertEq(demandsInOrder(first, [first]), true)
        assertEq(demandsInOrder(0, [first]), false)
    },
    orderedEagerContainers: () => {
        for (const exp of /** @type {readonly Exp[]} */ ([
            ['[]', [first, second]],
            [',', [first, second]],
            ['=>', 0, [first, second], 0],
            ['{}', [[':', 'a', first], [':', 'b', second]]],
            ['()', fn, [first, second]],
            ['===', first, second],
            ['!==', first, second],
            ['[]', [['undefined'], ['arg', 0], ['frame', 0], first, second]],
        ])) {
            assertEq(demandsInOrder(exp, [first, second]), true)
        }
        for (const exp of /** @type {readonly Exp[]} */ ([['!', first], ['typeof', first], ['instanceof', first, 'Array'], ['in', 'x', first]])) {
            assertEq(demandsInOrder(exp, [first]), true)
        }
        assertEq(demandsInOrder(['[]', [second, first]], [first, second]), false)
        assertEq(demandsInOrder(['[]', [first, first, second]], [first, second, first]), true)
        assertEq(demandsInOrder(['[]', [first]], [first, second]), false)
    },
    implicitAndUnownedWork: () => {
        for (const exp of /** @type {readonly Exp[]} */ ([
            ['[]', [['...', second], first]],
            ['{}', [['...', second], [':', 'a', first]]],
            ['{}', [[':', ['String', second], first]]],
            ['()', fn, [['...', second], first]],
            ['[]', [['()', fn, []], first]],
            ['[]', [['+', 1, 2], first]],
            ['[]', [['throw', 1], first]],
            ['.', null, 'x', ['|()', [first]]],
        ])) {
            assertEq(demandsInOrder(exp, [first]), false)
        }
    },
    operandsBeforeImplicitWork: () => {
        for (const exp of /** @type {readonly Exp[]} */ ([
            ['+', first, second], ['-', first], ['Number', first], ['String', first], ['throw', first],
            ['[]', [first, ['...', second]]],
            ['[]', [['...', first], second]],
            ['()', fn, [first, ['...', second]]],
            ['()', fn, [['...', first], second]],
            ['{}', [[':', 'a', first], ['...', second]]],
            ['{}', [['...', first], [':', 'a', second]]],
            ['{}', [[':', first, second]]],
            ['{}', [[':', 1, first]]],
            ['.', first, ['Number', second]],
            ['memberPresent', first, 'x'],
        ])) {
            assertEq(demandsInOrder(exp, [first]), true)
        }
        const key = /** @type {const} */ (['Number', first])
        assertEq(demandsInOrder(['.', null, key], [key]), true)
        assertEq(demandsInOrder(['.', null, key], [first]), true)
        assertEq(demandsInOrder(['+', first, second], [first, second]), true)
        assertEq(demandsInOrder(['[]', [first, ['...', second]]], [first, second]), true)
        assertEq(demandsInOrder(['{}', [[':', 1, first], [':', false, second]]], [first, second]), true)
        assertEq(demandsInOrder(['{}', [[':', first, second]]], [first, second]), false)
        assertEq(demandsInOrder(['{}', []], [first]), false)
        assertEq(demandsInOrder(['[]', [['+', first, 1], second]], [first, second]), false)
    },
    lazyAndFunctionBoundaries: () => {
        for (const exp of /** @type {readonly Exp[]} */ ([
            ['?.()', first, [second]],
            ['?.', first, ['Number', second]],
            ['.', first, 'x', ['|()', [second]]],
            ['?:', first, second, 0],
        ])) {
            assertEq(demandsInOrder(exp, [first]), true)
            assertEq(demandsInOrder(exp, [first, second]), false)
        }
        assertEq(demandsInOrder(['=>', 0, [], first], [first]), false)
        assertEq(demandsInOrder(['[]', [['?:', true, second, 0], first]], [first]), false)
    },
    establishedValues: () => {
        assertEq(demandsInOrder(0, [first], [first]), true)
        assertEq(demandsInOrder(second, [first, second], [first]), true)
        assertEq(demandsInOrder(second, [first, second, first], [first]), true)
        assertEq(demandsInOrder(['[]', [first, second]], [second], [first]), true)
        assertEq(demandsInOrder(['[]', [first, second]], [second]), false)
        const read = /** @type {const} */ (['()', fn, []])
        assertEq(demandsInOrder(['[]', [read, second]], [second], [read]), true)
        assertEq(demandsInOrder(['[]', [first, second]], [second], [['.', null, 'first']]), false)
    },
    completedParentsEstablishEagerDependencies: () => {
        /** @type {Exp} */
        const state = ['arg', 0]
        /** @type {Exp} */
        const read = ['.', state, 0]
        /** @type {Exp} */
        const predicate = ['>', read, 0]
        assertEq(demandsInOrder(['[]', [read, second]], [second], [predicate]), true)
        /** @type {Exp} */
        const owner = ['[]', [first]]
        assertEq(demandsInOrder(['[]', [owner, second]], [owner, first, second]), true)
        /** @type {Exp} */
        const key = ['String', first]
        /** @type {readonly Exp[]} */
        const parents = [
            ['[]', [['...', first], second]],
            ['()', fn, [['...', first], second]],
            ['{}', [[':', key, second]]],
        ]
        for (const parent of parents) {
            assertEq(demandsInOrder(0, [first, second], [parent]), true)
            assertEq(demandsInOrder(['[]', [parent, second]], [parent, first, second]), true)
        }
        assertEq(demandsInOrder(0, [key], [parents[2]]), true)
    },
    completedParentsKeepLazyAndFunctionBoundaries: () => {
        /** @type {Exp} */
        const test = ['===', first, 0]
        /** @type {readonly ['Number', Exp]} */
        const key = ['Number', second]
        /** @type {readonly (readonly [Exp, readonly Exp[], readonly Exp[]])[]} */
        const cases = [
            [['?:', test, second, fn], [test, first], [second, fn]],
            [['=>', 0, [first], second], [first], [second]],
            [['?.', first, key], [first], [key, second]],
            [['?.()', first, [second]], [first], [second]],
            [['.', first, 'method', ['|()', [second]]], [first], [second]],
        ]
        for (const [parent, reached, skipped] of cases) {
            for (const value of reached) { assertEq(demandsInOrder(0, [value], [parent]), true) }
            for (const value of skipped) { assertEq(demandsInOrder(0, [value], [parent]), false) }
        }
        /** @type {Exp} */
        const other = ['.', null, 'first']
        assertEq(demandsInOrder(0, [other], [['[]', [first]]]), false)
    },
    deepSharedCompletedParents: () => {
        /** @type {Exp} */
        let parent = first
        for (let depth = 0; depth < 20_000; ++depth) { parent = ['[]', [parent, parent]] }
        assertEq(demandsInOrder(0, [first], [parent]), true)
    },
    deepContainers: () => {
        /** @type {Exp} */
        let exp = first
        for (let depth = 0; depth < 20_000; ++depth) { exp = ['[]', [exp]] }
        assertEq(demandsInOrder(exp, [first]), true)
    },
    shortestRequiredPrefixes: () => {
        /** @type {Exp} */
        const owner = ['[]', [first]]
        /** @type {Exp} */
        const other = ['.', null, 'first']
        /** @type {readonly (readonly [Exp, readonly Exp[], number])[]} */
        const cases = [
            [0, [], 0],
            [first, [first], 0],
            [second, [first, second], 1],
            [0, [first, second], 2],
            [['[]', [second, first]], [first, second], 1],
            [['[]', [first, second]], [first, second, first], 0],
            [first, [other, first], 1],
            [second, [owner, first, second], 1],
            [second, [first, 0, second], 2],
            [second, [first, 0, second, 0], 4],
            [['[]', [first, second]], [first, null, first, second], 2],
            [0, [0, null, 1n, 'value', false], 5],
            [['[]', [owner, second]], [owner, second, other], 3],
        ]
        for (const [exp, required, expected] of cases) {
            assertEq(requiredPrefixLength(exp, required), expected)
            assertEq(demandsInOrder(exp, required.slice(expected), required.slice(0, expected)), true)
            for (let at = 0; at < expected; ++at) {
                assertEq(demandsInOrder(exp, required.slice(at), required.slice(0, at)), false)
            }
        }
    },
    requiredPrefixesKeepCompletionBoundaries: () => {
        /** @type {readonly ['Number', Exp]} */
        const key = ['Number', second]
        /** @type {readonly (readonly [Exp, readonly Exp[], readonly Exp[]])[]} */
        const cases = [
            [['?:', first, second, fn], [first], [second, fn]],
            [['=>', 0, [first], second], [first], [second]],
            [['?.', first, key], [first], [key, second]],
            [['?.()', first, [second]], [first], [second]],
            [['.', first, 'method', ['|()', [second]]], [first], [second]],
        ]
        for (const [parent, reached, skipped] of cases) {
            assertEq(requiredPrefixLength(0, [parent, ...reached]), 1)
            for (const value of skipped) { assertEq(requiredPrefixLength(0, [parent, value]), 2) }
        }
        /** @type {readonly Exp[]} */
        const completed = [
            ['[]', [['...', first], second]],
            ['()', fn, [['...', first], second]],
            ['{}', [[':', key, first]]],
        ]
        for (const parent of completed) { assertEq(requiredPrefixLength(0, [parent, first, second]), 1) }
        assertEq(requiredPrefixLength(['[]', [['+', first, 1], second]], [first, second]), 2)
    },
    manyUnusedRequiredValues: () => {
        /** @type {readonly Exp[]} */
        const required = Array.from({ length: 3_000 }, () => ['[]', []])
        assertEq(requiredPrefixLength(0, required), required.length)
        assertEq(requiredPrefixLength(required[required.length - 1], required), required.length - 1)
    },
    requiredPrefixesUseOnlyCompletedContext: () => {
        /** @type {Exp} */
        const read = ['.', ['arg', 0], 0]
        /** @type {Exp} */
        const test = ['>', read, 0]
        /** @type {Exp} */
        const a = ['+', ['arg', 1], 1]
        /** @type {Exp} */
        const b = ['+', ['arg', 2], 1]
        /** @type {Exp} */
        const exp = ['[]', [read, a, b]]
        assertEq(requiredPrefixLength(exp, [a, b]), 2)
        assertEq(requiredPrefixLength(exp, [a, b], [test]), 0)
        assertEq(requiredPrefixLength(exp, [read, 0, a, b], [test]), 2)
        assertEq(requiredPrefixLength(exp, [a, b], [['>', ['.', ['arg', 0], 0], 0]]), 2)
        assertEq(requiredPrefixLength(['[]', [a, b]], [b], [['=>', 0, [read], a]]), 1)
        assertEq(requiredPrefixLength(exp, [a, b], [['?:', true, test, 0]]), 2)
        assertEq(requiredPrefixLength(exp, [a, b], [['?.()', null, [test]]]), 2)
    },
    selectedConditionalsDemandOnlyTheirActualArm: () => {
        /** @type {Exp} */
        const test = ['===', ['arg', 0], 0]
        /** @type {Exp} */
        const sameText = ['===', ['arg', 0], 0]
        /** @type {Exp} */
        const exp = ['?:', test, first, second]
        assertEq(demandsInOrder(exp, [first], [], [[test, true]]), true)
        assertEq(demandsInOrder(exp, [second], [], [[test, true]]), false)
        assertEq(demandsInOrder(exp, [second], [], [[test, false]]), true)
        assertEq(demandsInOrder(exp, [first], [], [[test, false]]), false)
        assertEq(demandsInOrder(exp, [first], [], [[sameText, true]]), false)
        assertEq(requiredPrefixLength(exp, [first], [], [[test, true]]), 0)
        assertEq(requiredPrefixLength(exp, [second], [], [[test, false]]), 0)
        assertEq(requiredPrefixLength(exp, [first], [], [[test, false]]), 1)
        // Knowing the test does not establish a selected operand by itself.
        assertEq(demandsInOrder(0, [first], [], [[test, true]]), false)
        assertEq(requiredPrefixLength(0, [first], [], [[test, true]]), 1)
        assertEq(demandsInOrder(0, [test], [], [[test, false]]), true)
        assertEq(requiredPrefixLength(0, [test], [], [[test, true]]), 0)
    },
    selectedConditionalsKeepWorkAndInvocationBoundaries: () => {
        /** @type {Exp} */
        const test = ['arg', 0]
        /** @type {Exp} */
        const other = ['arg', 1]
        /** @type {Exp} */
        const call = ['()', fn, []]
        /** @type {readonly (readonly [Exp, boolean])[]} */
        const selected = [[test, true], [other, false]]
        assertEq(demandsInOrder(['?:', test, ['?:', other, second, first], 0], [first], [], selected), true)
        assertEq(demandsInOrder(['?:', test, ['[]', [call, first]], second], [first], [], selected), false)
        assertEq(demandsInOrder(['?:', test, ['throw', first], second], [first], [], selected), true)
        assertEq(demandsInOrder(['?:', test, ['throw', first], second], [first, second], [], selected), false)
        assertEq(demandsInOrder(['=>', 0, [], ['?:', test, first, second]], [first], [], selected), false)
        assertEq(demandsInOrder(['()', ['=>', 0, [], first], []], [first], [], selected), false)
        assertEq(demandsInOrder(['?.()', test, [first]], [first], [], selected), false)
        assertEq(demandsInOrder(['?.', test, ['Number', first]], [first], [], selected), false)
        assertEq(requiredPrefixLength(['?:', test, ['[]', [call, first]], second], [first], [], selected), 1)
        assertEq(requiredPrefixLength(['?:', test, ['[]', [first, second]], 0], [first, second], [], selected), 0)
        assertEq(requiredPrefixLength(['?:', test, first, second], [0, first], [], selected), 1)
    },
})
