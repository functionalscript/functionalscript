import { classic, deterministic } from './testlib.f.ts'
import {
    rangeEncode,
    str,
    set,
    range,
    commaJoin0Plus,
    isEmpty,
    oneEncode,
    type Rule,
} from './module.f.ts'

export const proof = {
    test: () => {
        classic()
        deterministic()
    },
    rangeEncodeInvalid: [
        () => {
            let threw = false
            try { rangeEncode(-1, 0) } catch (_) { threw = true }
            if (!threw) { throw 'expected throw for negative a' }
        },
        () => {
            let threw = false
            try { rangeEncode(0, -1) } catch (_) { threw = true }
            if (!threw) { throw 'expected throw for negative b' }
        },
        () => {
            let threw = false
            try { rangeEncode(5, 3) } catch (_) { threw = true }
            if (!threw) { throw 'expected throw for a > b' }
        },
    ],
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
    rangeInvalid: [
        () => {
            let threw = false
            try { range('a') } catch (_) { threw = true }
            if (!threw) { throw 'expected throw for single char' }
        },
        () => {
            let threw = false
            try { range('abc') } catch (_) { threw = true }
            if (!threw) { throw 'expected throw for three chars' }
        },
    ],
    commaJoin0Plus: () => {
        const ws: Rule = ''
        const item: Rule = 'x'
        const result = commaJoin0Plus(ws)('[]', item)
        if (!Array.isArray(result)) { throw result }
        if (result[0] !== '[') { throw result }
    },
    isEmpty: [
        () => {
            if (!isEmpty('')) { throw 'empty string should be empty' }
        },
        () => {
            if (!isEmpty([])) { throw 'empty array should be empty' }
        },
        () => {
            if (isEmpty('a')) { throw 'non-empty string should not be empty' }
        },
        () => {
            const f: Rule = () => ''
            if (!isEmpty(f)) { throw 'function returning empty string should be empty' }
        },
    ],
}
