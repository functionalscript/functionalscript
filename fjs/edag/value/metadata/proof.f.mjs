/**
 * Evaluated metadata checks preserve values and report raw tuple paths.
 * Function bodies remain expressions for later graph admission.
 *
 * @import { EdagValue, Property } from '../types.ts'
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { validateMetadata } from './module.f.mjs'

/** @type {(value: EdagValue) => void} */
const accept = value => { assertEq(Object.is(assertOk(validateMetadata(value)), value), true) }

/** @type {(value: EdagValue, path: readonly string[], message: string) => void} */
const reject = (value, path, message) => {
    assertStructurallySame(assertError(validateMetadata(value)), { path, message })
}

export const proof = {
    primitives: () => {
        /** @type {readonly EdagValue[]} */
        const values = [null, false, true, 0, -0, NaN, Infinity, '', 'value', 0n, ['undefined']]
        for (const value of values) { accept(value) }
    },
    functionLengths: () => {
        for (let length = 0; length <= 16; length += 1) {
            accept(['=>', length, [], ['undefined']])
        }
        for (const length of [-0, -1, 0.5, NaN, Infinity, -Infinity, 17, 2 ** 32 - 1]) {
            reject(['=>', length, [], 0], ['1'], 'invalid function length')
        }
    },
    recursiveValues: () => {
        accept(['[]', []])
        accept(['{}', []])
        accept(['[]', [1, ['{}', [[':', 'x', ['[]', [['undefined']]]]]]]])
        accept(['=>', 1, [['[]', [2]], ['{}', [[':', 'x', ['=>', 0, [], 3]]]]], ['frame', 0]])
    },
    propertyOrder: () => {
        // Index keys sort numerically; ordinary strings keep insertion order.
        accept(['{}', [
            [':', '0', 0], [':', '2', 2], [':', '10', 10],
            [':', '4294967294', 4], [':', 'z', 1], [':', 'a', 2],
        ]])
        reject(['{}', [[':', '2', 0], [':', '1', 0]]], ['1', '1', '1'], 'object properties are not in enumeration order')
        reject(['{}', [[':', '10', 0], [':', '2', 0]]], ['1', '1', '1'], 'object properties are not in enumeration order')
        reject(['{}', [[':', 'x', 0], [':', '0', 0]]], ['1', '1', '1'], 'object properties are not in enumeration order')
    },
    ordinaryKeys: () => {
        // The maximum uint32 is an ordinary key; its predecessor is an index.
        accept(['{}', [[':', '4294967294', 0], [':', '4294967295', 0]]])
        reject(['{}', [[':', '4294967295', 0], [':', '4294967294', 0]]], ['1', '1', '1'], 'object properties are not in enumeration order')
        for (const key of [
            '-1', '-0', '01', '1.5', '1e3', ' 1', '1 ', '0x1', '',
            'length', 'NaN', 'Infinity', '4294967295', '4294967296', '__proto__',
        ]) {
            accept(['{}', [[':', '0', 0], [':', key, 0]]])
            reject(['{}', [[':', key, 0], [':', '0', 0]]], ['1', '1', '1'], 'object properties are not in enumeration order')
        }
    },
    duplicateKeys: () => {
        for (const key of ['0', 'x', '', '__proto__', 'constructor', 'toString']) {
            reject(['{}', [[':', key, 1], [':', key, 2]]], ['1', '1', '1'], 'duplicate object property')
        }
        reject(['{}', [[':', 'x', 1], [':', 'y', 2], [':', 'x', 3]]], ['1', '2', '1'], 'duplicate object property')
    },
    wideObject: () => {
        const length = 40_000
        /** @type {readonly Property[]} */
        const properties = [
            [':', '__proto__', 0], [':', 'constructor', 0], [':', 'toString', 0],
            ...Array.from({ length }, (_, i) => /** @type {const} */ ([':', `key${i}`, i])),
        ]
        accept(['{}', properties])
        for (const key of ['__proto__', `key${length - 1}`]) {
            reject(['{}', [...properties, [':', key, 0]]], ['1', String(properties.length), '1'], 'duplicate object property')
        }
    },
    firstFailure: () => {
        const bad = /** @type {const} */ (['=>', 17, [], 0])
        reject(['{}', [[':', 'x', bad], [':', 'x', 0]]], ['1', '0', '2', '1'], 'invalid function length')
        reject(['{}', [[':', 'x', 0], [':', 'x', bad]]], ['1', '1', '1'], 'duplicate object property')
        const shared = /** @type {const} */ (['{}', [[':', 'x', bad]]])
        reject(['[]', [0, shared, shared]], ['1', '1', '1', '0', '2', '1'], 'invalid function length')
    },
    nestedFailures: () => {
        const bad = /** @type {const} */ (['=>', 17, [], 0])
        reject(['[]', [0, bad]], ['1', '1', '1'], 'invalid function length')
        reject(['{}', [[':', 'x', bad]]], ['1', '0', '2', '1'], 'invalid function length')
        reject(['=>', 0, [0, bad], 0], ['2', '1', '1'], 'invalid function length')
        reject(['[]', [['{}', [[':', 'x', bad]]]]], ['1', '0', '1', '0', '2', '1'], 'invalid function length')
        reject(['=>', 0, [['{}', [[':', 'x', 0], [':', 'x', 1]]]], 0], ['2', '0', '1', '1', '1'], 'duplicate object property')
    },
    opaqueBodies: () => {
        // These are unevaluated expressions, not evaluated value metadata.
        accept(['=>', 0, [], ['=>', -0, [], 0]])
        accept(['=>', 0, [], ['{}', [[':', 'x', 1], [':', '0', 2], [':', 'x', 3]]]])
        accept(['=>', 0, [], ['=>', 17, [], ['arg', 0]]])
    },
    sharedIdentity: () => {
        const shared = /** @type {const} */ (['{}', [[':', 'x', ['[]', [1]]]]])
        const input = /** @type {const} */ (['[]', [shared, shared, ['=>', 0, [shared], ['frame', 0]]]])
        assertEq(assertOk(validateMetadata(input)), input)
    },
    sharedGraph: () => {
        // Thirty sharing levels contain only thirty-one distinct value nodes.
        /** @type {EdagValue} */
        let shared = ['undefined']
        for (let i = 0; i < 10; i += 1) {
            /** @type {EdagValue} */
            const array = ['[]', [shared, shared]]
            /** @type {EdagValue} */
            const object = ['{}', [[':', 'x', array], [':', 'y', array]]]
            shared = ['=>', 0, [object, object], 0]
        }
        accept(shared)
    },
}
