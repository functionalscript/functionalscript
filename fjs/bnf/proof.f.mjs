/**
 * @import { Rule } from './types.ts'
 */

import {
    assert,
    assertEq,
    assertStructurallySame,
} from '../asserts/module.f.mjs'
import {
    eof,
    eofSymbol,
    fullRange,
    not,
    notSet,
    rangeDecode,
    rangeEncode,
    str,
    set,
    range,
    commaJoin0Plus,
    isEmpty,
    oneEncode,
    repeat1Plus,
} from './module.f.mjs'
import { definedValues } from '../types/object/module.f.mjs'
import { classic, deterministic } from './testlib.f.mjs'

// The last ordinary symbol, `2 ** 24 - 2`. Written out because the range codec
// is what these tests check: deriving it from the codec would move both sides
// of every assertion together.
const maxSymbol = 0xFFFFFE

export const proof = {
    test: () => {
        classic()
        deterministic
    },
    throw: {
        rangeEncodeInvalid: [
            // one below `eofSymbol`, the smallest semantic terminal
            () => { rangeEncode(-2, 0) },
            () => { rangeEncode(0, -2) },
            // one above the largest ordinary symbol: `2 ** 24 - 1` is EOF's
            // stored code, not a terminal of its own
            () => { rangeEncode(0, maxSymbol + 1) },
            // semantic ordering, so EOF is below every ordinary symbol
            () => { rangeEncode(0, eofSymbol) },
            () => { rangeEncode(5, 3) },
        ],
        rangeInvalid: [
            () => { range('a') },
            () => { range('abc') },
        ],
    },
    terminal: [
        () => {
            // EOF is the singleton `[-1, -1]` and keeps the stored code
            // `2 ** 24 - 1` at both endpoints.
            assertEq(eof, 0xFFFFFF_FFFFFF)
            const [a, b] = rangeDecode(eof)
            assertEq(a, eofSymbol)
            assertEq(b, eofSymbol)
        },
        () => {
            // `fullRange` holds the ordinary symbols only.
            const [a, b] = rangeDecode(fullRange)
            assertEq(a, 0)
            assertEq(b, maxSymbol)
        },
        () => {
            // Round trips over the whole semantic domain: EOF, the ordinary
            // minimum, an ordinary symbol, and the ordinary maximum.
            for (const v of [eofSymbol, 0, 0x10FFFF, maxSymbol]) {
                const [a, b] = rangeDecode(oneEncode(v))
                assertEq(a, v)
                assertEq(b, v)
            }
        },
        () => {
            // Ordinary symbols keep their own value as their stored code, so a
            // packed literal still reads as its endpoints.
            assertEq(oneEncode(0x20), 0x000020_000020)
            const [a, b] = rangeDecode(0x000030_000039)
            assertEq(a, 0x30)
            assertEq(b, 0x39)
        },
        () => {
            // A range may span EOF and ordinary symbols; the endpoints are
            // ordered semantically, not by stored code.
            const [a, b] = rangeDecode(rangeEncode(eofSymbol, maxSymbol))
            assertEq(a, eofSymbol)
            assertEq(b, maxSymbol)
        },
    ],
    complement: [
        () => {
            // The complement of nothing over `fullRange` is `fullRange`: EOF is
            // not an ordinary symbol, so no complement can produce it.
            const r = definedValues(not({}))
            assertEq(r.length, 1)
            assertEq(r[0], fullRange)
        },
        () => {
            const r = definedValues(notSet('a'))
            const decoded = r.map(rangeDecode)
            assertStructurallySame(decoded, [[0, 0x60], [0x62, maxSymbol]])
        },
    ],
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
