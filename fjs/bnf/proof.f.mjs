/**
 * @module
 *
 * @import { Rule } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import {
    rangeEncode,
    str,
    set,
    range,
    commaJoin0Plus,
    isEmpty,
    oneEncode,
    repeat1Plus,
} from './module.f.mjs'
import { classic, deterministic } from './testlib.f.mjs'

export const proof = {
    test: () => {
        classic()
        deterministic()
    },
    throw: {
        rangeEncodeInvalid: [
            () => { rangeEncode(-1, 0) },
            () => { rangeEncode(0, -1) },
            () => { rangeEncode(5, 3) },
        ],
        rangeInvalid: [
            () => { range('a') },
            () => { range('abc') },
        ],
    },
    str: [
        () => {
            const result = str('a')
            assertEq(typeof result, 'number', result)
            assertEq(result, oneEncode(0x61))
        },
        () => {
            const result = str('ab')
            assert(Array.isArray(result), result)
            assertEq(result.length, 2, result)
        },
    ],
    set: () => {
        const result = set('abc')
        assert(!(typeof result !== 'object' || result === null), result)
        assert('a' in result, result)
        assert('b' in result, result)
        assert('c' in result, result)
    },
    commaJoin0Plus: () => {
        /** @type {Rule} */
        const ws = ''
        /** @type {Rule} */
        const item = 'x'
        const result = commaJoin0Plus(ws)('[]', item)
        assert(Array.isArray(result), result)
        assert(result[0] === '[', result)
    },
    isEmpty: [
        () => { assert(isEmpty(''), 'empty string should be empty') },
        () => { assert(isEmpty([]), 'empty array should be empty') },
        () => { assert(!(isEmpty('a')), 'non-empty string should not be empty') },
        () => {
            /** @type {Rule} */
            const f = () => ''
            assert(isEmpty(f), 'function returning empty string should be empty')
        },
    ],
    repeat1Plus: [
        () => {
            const result = repeat1Plus('x')
            assert(result[0] === 'x')
            assertEq(typeof result[1], 'function', 'expected repeat0Plus function')
        },
        () => {
            /** @type {Rule} */
            const rule = 'ab'
            const result = repeat1Plus(rule)
            assertEq(result[0], rule)
            const inner = result[1]()
            assert(!(!('some' in inner) || !('none' in inner)), 'expected Option shape')
        },
    ],
}
