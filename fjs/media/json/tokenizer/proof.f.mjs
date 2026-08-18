/**
 * @import { JsonToken } from './types.ts'
 */

import { tokenize } from './module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { stringifyAsTree } from '../../../djs/serializer/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(s: string) => readonly JsonToken[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s)))

const stringify = stringifyAsTree(sort)

export const proof = {
    json: [
        () => {
            const result = stringify(tokenizeString(''))
            if (result !== '[{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{'))
            if (result !== '[{"kind":"{"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('}'))
            if (result !== '[{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(':'))
            if (result !== '[{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(','))
            if (result !== '[{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('['))
            if (result !== '[{"kind":"["},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(']'))
            if (result !== '[{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ᄑ'))
            if (result !== '[{"kind":"error","message":"unexpected character"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ \t\n\r}'))
            if (result !== '[{"kind":"{"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('""'))
            if (result !== '[{"kind":"string","value":""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value"'))
            if (result !== '[{"kind":"string","value":"value"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value1" "value2"'))
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\\\"'))
            if (result !== '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\""'))
            if (result !== '[{"kind":"string","value":"\\""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\/"'))
            if (result !== '[{"kind":"string","value":"/"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\x"'))
            if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\u1234"'))
            if (result !== '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
            if (result !== '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uEeFg"'))
            if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0'))
            if (result !== '[{"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[0]'))
            if (result !== '[{"kind":"["},{"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('00'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0abc,'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123456789012345678901234567890'))
            if (result !== '[{"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{90}'))
            if (result !== '[{"kind":"{"},{"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1 2'))
            if (result !== '[{"kind":"number","value":"1"},{"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0. 2'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('10-0'))
            if (result !== '[{"kind":"number","value":"10"},{"kind":"number","value":"-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"kind":"number","value":"-10"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('--'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('---'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"kind":"number","value":"-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid token"},{"kind":"number","value":"123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"kind":"number","value":"0.01"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"kind":"number","value":"-0.9"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"kind":"number","value":"12.34"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"kind":"number","value":"-12.00"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e1'))
            if (result !== '[{"kind":"number","value":"0e1"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e+2'))
            if (result !== '[{"kind":"number","value":"0e+2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-0'))
            if (result !== '[{"kind":"number","value":"0e-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12e0000'))
            if (result !== '[{"kind":"number","value":"12e0000"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12e-0001'))
            if (result !== '[{"kind":"number","value":"-12e-0001"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"kind":"number","value":"-12.34e1234"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890n'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0n'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[-1234567890n]'))
            if (result !== '[{"kind":"["},{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid token"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
    ],
    id: [
        () => {
            const result = stringify(tokenizeString('err'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{e}'))
            if (result !== '[{"kind":"{"},{"kind":"error","message":"invalid token"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('tru'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('break'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
    ],
    keywords: [
        () => {
            const result = stringify(tokenizeString('true'))
            if (result !== '[{"kind":"true"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('false'))
            if (result !== '[{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('null'))
            if (result !== '[{"kind":"null"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[null]'))
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
    ],
    // Losslessness starts at the tokenizer boundary: a syntactically valid
    // JSON number reaches `NumberToken.value` as its exact lexeme. Nothing
    // derived from it — a coefficient bigint, an exponent number — is built
    // while scanning, so no valid input can fail to tokenize because such a
    // derived value would exceed a runtime numeric limit.
    //
    // The runtime's own bigint limit (V8 rejects magnitudes above 2^30 bits,
    // roughly 3.2e8 decimal digits) is not exercised here: the smallest input
    // that reaches it is a JSON document of some hundreds of megabytes. These
    // cases stay far below that while still being far above what `number` and
    // `Number.MAX_SAFE_INTEGER` can hold.
    lossless: {
        // a coefficient with more digits than any JavaScript number can carry
        oversizedCoefficient: () => {
            const value = `1${'0'.repeat(100000)}1`
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        // exponent text far beyond JavaScript-number precision: `Number` of it
        // is `Infinity`, yet every digit still has to reach the token
        unboundedExponent: () => {
            const value = '1e999999999999999999999'
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        negativeUnboundedExponent: () => {
            const value = '-1.5e-999999999999999999999'
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        negativeOversized: () => {
            const value = `-1${'0'.repeat(100000)}1`
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
    },
}
