import { assert } from '../asserts/module.f.ts'
import { classic, deterministic } from './testlib.f.ts'
import {
    rangeEncode,
    str,
    set,
    range,
    commaJoin0Plus,
    isEmpty,
    oneEncode,
    repeat1Plus,
    type Rule,
} from './module.f.ts'

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
            assert(typeof result === 'number', result)
            assert(result === oneEncode(0x61), result)
        },
        () => {
            const result = str('ab')
            assert(Array.isArray(result), result)
            assert((result as readonly number[]).length === 2, result)
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
        const ws: Rule = ''
        const item: Rule = 'x'
        const result = commaJoin0Plus(ws)('[]', item)
        assert(Array.isArray(result), result)
        assert(result[0] === '[', result)
    },
    isEmpty: [
        () => { assert(isEmpty(''), 'empty string should be empty') },
        () => { assert(isEmpty([]), 'empty array should be empty') },
        () => { assert(!(isEmpty('a')), 'non-empty string should not be empty') },
        () => {
            const f: Rule = () => ''
            assert(isEmpty(f), 'function returning empty string should be empty')
        },
    ],
    repeat1Plus: [
        () => {
            const result = repeat1Plus('x')
            assert(result[0] === 'x', result[0])
            assert(typeof result[1] === 'function', 'expected repeat0Plus function')
        },
        () => {
            const rule: Rule = 'ab'
            const result = repeat1Plus(rule)
            assert(result[0] === rule, result[0])
            const inner = result[1]()
            assert(!(!('some' in inner) || !('none' in inner)), 'expected Option shape')
        },
    ],
}
