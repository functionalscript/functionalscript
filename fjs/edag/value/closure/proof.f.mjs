/**
 * Closed values keep their graph identity while function bodies obey the
 * EDAG binding and scope rules, including nested function creation.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../../asserts/module.f.mjs'
import { validateClosure } from './module.f.mjs'

/** @type {(value: EdagValue) => void} */
const accept = value => { assertEq(Object.is(assertOk(validateClosure(value)), value), true) }

/** @type {(value: EdagValue, message: string) => void} */
const reject = (value, message) => { assertEq(assertError(validateClosure(value)), message) }

export const proof = {
    data: () => {
        /** @type {readonly EdagValue[]} */
        const values = [null, false, true, 0, -0, NaN, Infinity, '', 'value', 0n, ['undefined']]
        for (const value of values) { accept(value) }
        accept(['[]', []])
        accept(['{}', []])
        accept(['[]', [1, ['{}', [[':', 'x', ['[]', [['undefined']]]]]]]])
    },
    functionLengths: () => {
        for (let length = 0; length <= 16; length += 1) {
            accept(['=>', length, [], 0])
        }
        for (const length of [-0, -1, 0.5, NaN, Infinity, -Infinity]) {
            reject(['=>', length, [], 0], 'invalid function length')
            reject(['=>', 0, [], ['=>', length, [], 0]], 'invalid function length')
            reject(['=>', 0, [['=>', length, [], 0]], 0], 'invalid function length')
        }
        for (const length of [17, 2 ** 32 - 1, 2 ** 32]) {
            reject(['=>', length, [], 0], 'a function length above 16')
            reject(['=>', 0, [], ['=>', length, [], 0]], 'a function length above 16')
            reject(['=>', 0, [['=>', length, [], 0]], 0], 'a function length above 16')
        }
    },
    captures: () => {
        const shared = /** @type {const} */ (['{}', [[':', 'x', ['[]', [1]]]]])
        accept(['=>', 0, [null, false, 0, -0, NaN, '', 0n, shared, shared], ['frame', 8]])
        accept(['=>', 0, [1, 1, shared], 0])
        accept(['=>', 0, [shared, shared], ['[]', [['frame', 0], ['frame', 1]]]])
        accept(['=>', 0, [['=>', 1, [shared], ['arg', 0]]], ['frame', 0]])
        // An unused captured function still has to be closed.
        reject(['=>', 0, [['=>', 0, [], ['arg', 0]]], 0], 'invalid fixed parameter index or scope')
    },
    ownBindings: () => {
        accept(['=>', 1, [10], ['[]', [['arg', 0], ['frame', 0], ['rest']]]])
        accept(['=>', 16, [], ['arg', 15]])
        accept(['=>', 0, [], ['rest']])
        // A nested function's slot expressions use its parent's bindings;
        // its body uses its own parameter count and capture-slot count.
        accept(['=>', 2, [40, 50], ['=>', 2,
            [['arg', 1], ['frame', 1], ['rest'], 7],
            ['[]', [['arg', 1], ['frame', 2], ['rest']]],
        ]])
        accept(['=>', 0, [40, 50], ['=>', 0, [['frame', 1]], ['frame', 0]]])
    },
    fixedParameterErrors: () => {
        for (const index of [-0, -1, 0.5, NaN, Infinity, -Infinity, 2]) {
            reject(['=>', 2, [], ['arg', index]], 'invalid fixed parameter index or scope')
        }
        reject(['=>', 1, [], ['=>', 0, [], ['arg', 0]]], 'invalid fixed parameter index or scope')
        reject(['=>', 0, [], ['=>', 1, [['arg', 0]], 0]], 'invalid fixed parameter index or scope')
    },
    frameSlotErrors: () => {
        for (const index of [-0, -1, 0.5, NaN, Infinity, -Infinity, 2]) {
            reject(['=>', 0, [1, 2], ['frame', index]], 'invalid frame slot index or scope')
        }
        reject(['=>', 0, [], ['frame', 0]], 'invalid frame slot index or scope')
        reject(['=>', 0, [40, 50], ['=>', 0, [['frame', 1]], ['frame', 1]]], 'invalid frame slot index or scope')
        reject(['=>', 0, [], ['=>', 0, [['frame', 0], 1], 0]], 'invalid frame slot index or scope')
        reject(['=>', 0, [['=>', 0, [], ['frame', 0]]], 0], 'invalid frame slot index or scope')
    },
    unresolvedImports: () => {
        reject(['=>', 0, [], ['args']], 'module args in a function')
        reject(['=>', 0, [], ['=>', 0, [], ['args']]], 'module args in a function')
        reject(['=>', 0, [], ['=>', 0, [['args']], 0]], 'module args in a function')
        reject(['=>', 0, [['=>', 0, [], ['args']]], 0], 'module args in a function')
        reject(['=>', 0, [], ['&&', false, ['args']]], 'module args in a function')
    },
    objectExpressions: () => {
        // Body expressions have JavaScript construction semantics rather
        // than the canonical metadata of an already evaluated object.
        accept(['=>', 0, [], ['{}', [
            [':', 'x', 1], [':', '2', 2], [':', '0', 3], [':', 'x', 4],
        ]]])
        accept(['=>', 1, [], ['{}', [[':', ['arg', 0], 1], ['...', ['rest']]]]])
    },
    sharedValues: () => {
        const data = /** @type {const} */ (['[]', [1]])
        const func = /** @type {const} */ (['=>', 0, [data, data], ['frame', 0]])
        accept(['[]', [data, func, func, ['=>', 0, [func, data], ['frame', 0]]]])
        // Repeated body operations are valid within their owning scope.
        const operation = /** @type {const} */ (['+', ['arg', 0], 1])
        accept(['=>', 1, [], ['[]', [operation, operation]]])
        // Equal operations in distinct scopes have distinct node identities.
        accept(['[]', [['=>', 0, [], ['+', 1, 2]], ['=>', 0, [], ['+', 1, 2]]]])
    },
    sharedAcrossScopes: () => {
        const data = /** @type {const} */ (['[]', [1]])
        reject(['[]', [data, ['=>', 0, [], data]]], 'a node shared across a function boundary')
        reject(['[]', [['=>', 0, [], data], data]], 'a node shared across a function boundary')
        reject(['=>', 0, [data], data], 'a node shared across a function boundary')
        const operation = /** @type {const} */ (['+', 1, 2])
        reject(['[]', [['=>', 0, [], operation], ['=>', 0, [], operation]]], 'a node shared across a function boundary')
        reject(['=>', 0, [], ['[]', [operation, ['=>', 0, [], operation]]]], 'a node shared across a function boundary')
    },
}
