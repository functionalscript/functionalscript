/**
 * @import { JsonToken } from './types.ts'
 */

import { tokenize } from './module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { stringifyAsTree } from '../../../djs/serializer/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

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
    // A malformed string literal is reported as errors alone. `fjs/js/tokenizer`
    // keeps scanning after an error raised from *inside* a literal, so the
    // closing quote used to emit an ordinary `string` token for text no
    // document contained — `"\x"` gave `string "x"`, which a caller filtering
    // errors out could not tell from the `"x"` a valid document produces.
    //
    // All three messages that behave that way are pinned here, together with
    // the two boundaries that make the suppression a rule rather than a guess:
    // a genuine string after the error still arrives, and a raw newline is not
    // in the class at all.
    stringRecovery: {
        invalidEscape: () => assertEq(
            stringify(tokenizeString('"\\x"')),
            '[{"kind":"error","message":"unescaped character"},{"kind":"eof"}]'),
        // a second escape, so the proof holds the class and not one instance
        // of it: `\v` is a JavaScript escape that JSON does not have
        escapeJsHasAndJsonDoesNot: () => assertEq(
            stringify(tokenizeString('"\\v"')),
            '[{"kind":"error","message":"unescaped character"},{"kind":"eof"}]'),
        // `\u` whose four hex digits are not four hex digits
        invalidHexValue: () => assertEq(
            stringify(tokenizeString('"\\uEeFg"')),
            '[{"kind":"error","message":"invalid hex value"},{"kind":"eof"}]'),
        // JavaScript's code-point escape, which JSON does not have: the `{`
        // is the non-hex character, and `{41}` was the value it fabricated
        codePointEscape: () => assertEq(
            stringify(tokenizeString('"\\u{41}"')),
            '[{"kind":"error","message":"invalid hex value"},{"kind":"eof"}]'),
        // the third message, which no proof reached before: a raw control
        // character, which the literal absorbed into its value
        rawTab: () => assertEq(
            stringify(tokenizeString('"a\tb"')),
            '[{"kind":"error","message":"unescaped control character in string"},{"kind":"eof"}]'),
        rawNul: () => assertEq(
            stringify(tokenizeString('"\u0000"')),
            '[{"kind":"error","message":"unescaped control character in string"},{"kind":"eof"}]'),
        // two errors from one literal: an error is not a `string`, so the flag
        // survives it and still drops the one token the closing quote emits
        twoInvalidEscapes: () => assertEq(
            stringify(tokenizeString('"\\x\\y"')),
            '[{"kind":"error","message":"unescaped character"},{"kind":"error","message":"unescaped character"},{"kind":"eof"}]'),
        // the rule is "the next token", not "every string after an error":
        // `"ok"` is really in the source, and a caller is owed it
        laterStringSurvives: () => assertEq(
            stringify(tokenizeString('"\\x" "ok"')),
            '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"ok"},{"kind":"eof"}]'),
        // ...and **adjacently**, which is the case that actually rests on the
        // flag being cleared when the fabricated token is dropped. With a space
        // between, the whitespace token clears the flag on its own, so the
        // spaced case above still passes when the reset is wrong — and the
        // adjacent form is exactly the one that then loses a genuine string.
        // Verified by mutation: `[empty, true]` in place of `[empty, false]`
        // leaves the suite green without these two and fails with them.
        adjacentStringSurvives: () => assertEq(
            stringify(tokenizeString('"\\x""ok"')),
            '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"ok"},{"kind":"eof"}]'),
        adjacentStringSurvivesAfterHexError: () => assertEq(
            stringify(tokenizeString('"\\u""ok"')),
            '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"ok"},{"kind":"eof"}]'),
        // the fabricated token reaches the `'-'` state too, which returns to
        // `'def'` on the error and so would have passed the `string` through
        afterMinus: () => assertEq(
            stringify(tokenizeString('-"\\x"')),
            '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"unescaped character"},{"kind":"eof"}]'),
        // where the class ends: a raw newline *ends* the literal rather than
        // continuing it, so there is no partial token to drop and this shape
        // is unchanged. That boundary is why the rule keys on the message and
        // not on "a control character".
        rawNewLine: () => assertEq(
            stringify(tokenizeString('"a\nb"')),
            '[{"kind":"error","message":"unterminated string literal"},{"kind":"error","message":"invalid token"},{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]'),
    },
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
