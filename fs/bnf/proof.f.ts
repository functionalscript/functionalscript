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
            if (typeof result !== 'number') { throw result }
            if (result !== oneEncode(0x61)) { throw result }
        },
        () => {
            const result = str('ab')
            if (!Array.isArray(result)) { throw result }
            if ((result as readonly number[]).length !== 2) { throw result }
        },
    ],
    set: () => {
        const result = set('abc')
        if (typeof result !== 'object' || result === null) { throw result }
        if (!('a' in result)) { throw result }
        if (!('b' in result)) { throw result }
        if (!('c' in result)) { throw result }
    },
    commaJoin0Plus: () => {
        const ws: Rule = ''
        const item: Rule = 'x'
        const result = commaJoin0Plus(ws)('[]', item)
        if (!Array.isArray(result)) { throw result }
        if (result[0] !== '[') { throw result }
    },
    isEmpty: [
        () => { if (!isEmpty('')) { throw 'empty string should be empty' } },
        () => { if (!isEmpty([])) { throw 'empty array should be empty' } },
        () => { if (isEmpty('a')) { throw 'non-empty string should not be empty' } },
        () => {
            const f: Rule = () => ''
            if (!isEmpty(f)) { throw 'function returning empty string should be empty' }
        },
    ],
    repeat1Plus: [
        () => {
            const result = repeat1Plus('x')
            if (result[0] !== 'x') { throw result[0] }
            if (typeof result[1] !== 'function') { throw 'expected repeat0Plus function' }
        },
        () => {
            const rule: Rule = 'ab'
            const result = repeat1Plus(rule)
            if (result[0] !== rule) { throw result[0] }
            const inner = result[1]()
            if (!('some' in inner) || !('none' in inner)) { throw 'expected Option shape' }
        },
    ],
}
