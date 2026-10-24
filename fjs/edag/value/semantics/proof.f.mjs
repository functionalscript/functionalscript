/**
 * Value classifications and comparisons distinguish primitive semantics
 * from the identity of represented arrays, objects and functions.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tagUndefined, untagUndefined, truthy, typeOf, isUndefined, isNullish, strictEqual, is, unary, binary } from './module.f.mjs'

/** @type {readonly (readonly [EdagValue, boolean, string])[]} */
const classifications = [
    [null, false, 'object'],
    [false, false, 'boolean'], [true, true, 'boolean'],
    [0, false, 'number'], [-0, false, 'number'], [NaN, false, 'number'],
    [1, true, 'number'], [-1, true, 'number'], [0.5, true, 'number'],
    [Infinity, true, 'number'], [-Infinity, true, 'number'],
    ['', false, 'string'], ['value', true, 'string'], ['0', true, 'string'],
    ['undefined', true, 'string'], ['=>', true, 'string'],
    ['[]', true, 'string'], ['{}', true, 'string'],
    [0n, false, 'bigint'], [1n, true, 'bigint'], [-1n, true, 'bigint'],
    [['undefined'], false, 'undefined'],
    [['[]', []], true, 'object'],
    [['{}', []], true, 'object'],
    [['=>', 0, [], 0], true, 'function'],
    [['entry'], true, 'function'],
    [['hasEntry'], true, 'function'],
    [['slice'], true, 'function'],
    [['charCodeAt'], true, 'function'],
    [['Object.entries'], true, 'function'],
    [['Object.is'], true, 'function'],
]

/** @type {(a: EdagValue, b: EdagValue, equal: boolean, same: boolean) => void} */
const compare = (a, b, equal, same) => {
    assertEq(strictEqual(a, b), equal)
    assertEq(strictEqual(b, a), equal)
    assertEq(is(a, b), same)
    assertEq(is(b, a), same)
    assertEq(assertOk(binary['==='](a, b)), equal)
    assertEq(assertOk(binary['==='](b, a)), equal)
    assertEq(assertOk(binary['!=='](a, b)), !equal)
    assertEq(assertOk(binary['!=='](b, a)), !equal)
}

export const proof = {
    untag: () => {
        for (const [value, , type] of classifications) {
            assertEq(Object.is(untagUndefined(value), type === 'undefined' ? undefined : value), true)
        }
    },
    tag: () => {
        // a statically `undefined` argument still types as an EdagValue
        /** @type {EdagValue} */
        const tagged = tagUndefined(undefined)
        assertStructurallySame(tagged, ['undefined'])
        assertEq(tagUndefined(null), null)
        assertEq(tagUndefined(0), 0)
        for (const [value] of classifications) {
            assertEq(Object.is(untagUndefined(tagUndefined(untagUndefined(value))), untagUndefined(value)), true)
        }
    },
    truthiness: () => {
        for (const [value, expected] of classifications) {
            assertEq(truthy(value), expected)
            assertEq(assertOk(unary['!'](value)), !expected)
        }
    },
    types: () => {
        for (const [value, , expected] of classifications) {
            assertEq(typeOf(value), expected)
            assertEq(assertOk(unary.typeof(value)), expected)
        }
    },
    // Only the tagged `undefined` is `undefined`, and `null` beside it is
    // nullish: a string spelled `'undefined'` and a `0` are neither.
    nullish: () => {
        for (const [value, , type] of classifications) {
            assertEq(isUndefined(value), type === 'undefined')
            assertEq(isNullish(value), value === null || type === 'undefined')
        }
    },
    primitives: () => {
        for (const value of [null, false, true, 0, -0, 1, -1, Infinity, -Infinity, '', 'value', 0n, 1n, -1n]) {
            compare(value, value, true, true)
        }
        compare(NaN, NaN, false, true)
        compare(0, -0, true, false)
        compare(1, 2, false, false)
        compare(false, true, false, false)
        compare('', 'value', false, false)
        compare(0n, 1n, false, false)
        // Coercible primitive pairs remain unequal.
        compare(0, false, false, false)
        compare(1, true, false, false)
        compare(0, '', false, false)
        compare(1, '1', false, false)
        compare(0, 0n, false, false)
        compare(1, 1n, false, false)
        compare(null, false, false, false)
    },
    undefinedValue: () => {
        const a = /** @type {const} */ (['undefined'])
        const b = /** @type {const} */ (['undefined'])
        compare(a, a, true, true)
        compare(a, b, true, true)
        compare('undefined', a, false, false)
    },
    identity: () => {
        const data = /** @type {const} */ (['[]', [1]])
        const array = /** @type {const} */ (['[]', [data, data]])
        const otherArray = /** @type {const} */ (['[]', [data, data]])
        compare(data, data, true, true)
        compare(data, ['[]', [1]], false, false)
        compare(array, array, true, true)
        compare(array, otherArray, false, false)
        const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
        const otherObject = /** @type {const} */ (['{}', [[':', 'value', data]]])
        compare(object, object, true, true)
        compare(object, otherObject, false, false)
        // Shared captures keep their identity; distinct functions have
        // distinct body nodes and identities, even with equal code.
        const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        const otherFunc = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        compare(func, func, true, true)
        compare(func, otherFunc, false, false)
        // A static function is identified by its name: two reads are one
        // function, two names two, and a closure is never a static.
        compare(['Object.is'], ['Object.is'], true, true)
        compare(['Object.is'], ['Object.entries'], false, false)
        compare(['Object.is'], func, false, false)
        compare(['Object.is'], ['entry'], false, false)
    },
    mixedTypes: () => {
        /** @type {readonly EdagValue[]} */
        const tagged = [['undefined'], ['[]', []], ['{}', []], ['=>', 0, [], 0]]
        for (const a of tagged) {
            for (const b of [null, false, true, 0, -0, NaN, 1, '', 'value', 0n, 1n]) {
                compare(a, b, false, false)
            }
        }
        for (let i = 0; i < tagged.length; i += 1) {
            for (let j = i + 1; j < tagged.length; j += 1) {
                compare(tagged[i], tagged[j], false, false)
            }
        }
    },
}
