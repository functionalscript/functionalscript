/** Ordered demands retain eager work, lazy selection and established identity.
 * @import { Exp } from '../types.ts'
 */

import { assertEq } from '../../asserts/module.f.js'
import { demandsInOrder } from './module.f.mjs'

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
        for (const exp of /** @type {readonly Exp[]} */ ([['!', first], ['typeof', first], ['instanceof', first, 'Array']])) {
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
    deepContainers: () => {
        /** @type {Exp} */
        let exp = first
        for (let depth = 0; depth < 20_000; ++depth) { exp = ['[]', [exp]] }
        assertEq(demandsInOrder(exp, [first]), true)
    },
})
