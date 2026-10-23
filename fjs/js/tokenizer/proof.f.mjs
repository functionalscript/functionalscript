/**
 * @import { JsToken } from '../../ebnf/lib/js/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { stringToCodePointList, stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { parser } from '../../ebnf/ll1/module.f.mjs'
import { token as ebnfToken } from '../../ebnf/lib/js/module.f.mjs'
import { assertRecognizes, recognizer } from '../../ebnf/testlib.f.mjs'
import { _positions, tokenize } from './module.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { demo, tokensOf } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'

/**
 * The tokens of a text, positions left out — `error` where the text does not
 * tokenize. Proof-local: it exists so an expectation states the token values
 * alone, compared with `assertStructurallySame`.
 *
 * @type {(s: string) => readonly JsToken[] | 'error'}
 */
const tokenizeString = s => {
    const tokens = toArray(tokenize(stringToCodePointList(s))(''))
    return tokens.some(({ token }) => token.kind === 'error')
        ? 'error'
        : tokens.map(({ token }) => token)
}

// 'line:column' of the error token `s` tokenizes to — 'line:column..line:column'
// when the token carries an `end` — or 'no error'. Collapsing the whole report to
// one string keeps an expectation readable as the underline a reader would draw,
// instead of separate assertions per case, and makes an expectation *without*
// `..` assert the absence of an end rather than ignore one.
/** @type {(s: string) => string} */
const errorAt = s => {
    const found = toArray(tokenize(stringToList(s))('a.js'))
        .find(t => t.token.kind === 'error')
    if (found === undefined) { return 'no error' }
    const start = `${found.metadata.line}:${found.metadata.column}`
    const { token } = found
    // the kind re-check narrows what `find`'s predicate could not
    return token.kind !== 'error' || token.end === undefined
        ? start
        : `${start}..${token.end.line}:${token.end.column}`
}

/**
 * 'line:column' of the identifier `x` in `s`, the token every position case
 * below places after the line terminators it is about.
 *
 * @type {(s: string) => string}
 */
const xAt = s => {
    const found = toArray(tokenize(stringToList(s))('a.js'))
        .find(({ token }) => token.kind === 'id' && token.value === 'x')
    return found === undefined ? 'no x' : `${found.metadata.line}:${found.metadata.column}`
}

/** The grammar's parser of one token, resumed per token below. */
const parseToken = parser(ebnfToken)

/**
 * Whether the grammar reads the whole text as tokens — whatever the layers
 * above then make of them, so `2true` is covered, two tokens side by side.
 */
const covers = assertRecognizes(recognizer(
    parseToken,
    s => toArray(stringToCodePointList(s)).map(symbol => ({ symbol, meta: null }))))

/**
 * The demo's state after `event`, which must settle without asking for an
 * operation.
 *
 * @type {(event: DemoEvent) => (state: string) => string}
 */
const step = event => state => {
    const [result] = runPure(demo.update(state)(event))
    return unwrap(assertNotNullish(result,
        'expected the demo to reach a value without asking for an operation'))
}

export const proof = {
    templates: {
        chunks: () => {
            assertStructurallySame(tokenizeString('``'), [
                { kind: 'noSubstitutionTemplate', value: '', source: '' },
                { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`é😀$ $$ $a { }`'), [
                { kind: 'noSubstitutionTemplate', value: 'é😀$ $$ $a { }', source: 'é😀$ $$ $a { }' },
                { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`a${x}b${y}c`'), [
                { kind: 'templateHead', value: 'a', source: 'a' }, { kind: 'id', value: 'x' },
                { kind: 'templateMiddle', value: 'b', source: 'b' }, { kind: 'id', value: 'y' },
                { kind: 'templateTail', value: 'c', source: 'c' }, { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`${x}${y}`'), [
                { kind: 'templateHead', value: '', source: '' }, { kind: 'id', value: 'x' },
                { kind: 'templateMiddle', value: '', source: '' }, { kind: 'id', value: 'y' },
                { kind: 'templateTail', value: '', source: '' }, { kind: 'eof' },
            ])
        },
        escapes: () => {
            assertStructurallySame(tokenizeString('`A`'), [
                { kind: 'noSubstitutionTemplate', value: 'A', source: 'A' }, { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`\\"\\\\\\/\\b\\f\\n\\r\\t\\u0041\\`\\${`'), [
                { kind: 'noSubstitutionTemplate', value: '"\\/\b\f\n\r\tA`${', source: '\\"\\\\\\/\\b\\f\\n\\r\\t\\u0041\\`\\${' }, { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`a\rb\r\nc\nd\u2028e\u2029f`'), [
                { kind: 'noSubstitutionTemplate', value: 'a\nb\nc\nd\u2028e\u2029f', source: 'a\rb\r\nc\nd\u2028e\u2029f' }, { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('`\\u000D\r\n`'), [
                { kind: 'noSubstitutionTemplate', value: '\r\n', source: '\\u000D\r\n' }, { kind: 'eof' },
            ])
            // Each JavaScript spelling cooks correctly, while the exact source
            // stays distinct from the value for consumers' spelling policies.
            const cases = /** @type {const} */ ([
                ['\\x41', 'A'], ['\\v', '\v'], ['\\0', '\0'], ['\\0a', '\0a'],
                ['\\u{1f600}', '😀'], ['\\u{000000000041}', 'A'],
                ['\\u{0}', '\0'], ['\\u{10FFFF}', '\u{10ffff}'], ['\\u{0000000000000010fFfF}', '\u{10ffff}'],
                ['\\xfF', '\xff'], ['\\u00411', 'A1'], ['\\uD83D\\uDE00', '😀'], ['\\x411', 'A1'],
                ['\\q', 'q'], ["\\'", "'"], ['\\$', '$'], ['\\$x', '$x'],
                ['\\\n', ''], ['\\\r', ''], ['\\\r\n', ''], ['\\\u2028', ''], ['\\\u2029', ''],
                ['\0', '\0'], ['\t', '\t'], ['\x1f', '\x1f'],
            ])
            for (const [source, value] of cases) {
                assertStructurallySame(tokenizeString('`' + source + '`'), [
                    { kind: 'noSubstitutionTemplate', value, source }, { kind: 'eof' },
                ], source)
            }
            assertStructurallySame(tokenizeString('`a${x}\\x41${y}\\v`'), [
                { kind: 'templateHead', value: 'a', source: 'a' }, { kind: 'id', value: 'x' },
                { kind: 'templateMiddle', value: 'A', source: '\\x41' }, { kind: 'id', value: 'y' },
                { kind: 'templateTail', value: '\v', source: '\\v' }, { kind: 'eof' },
            ])
        },
        nesting: () => {
            assertStructurallySame(tokenizeString('`a${{value:"}"}.value}b${`c${x}d`}e`'), [
                { kind: 'templateHead', value: 'a', source: 'a' },
                { kind: '{' }, { kind: 'id', value: 'value' }, { kind: ':' }, { kind: 'string', value: '}' }, { kind: '}' },
                { kind: '.' }, { kind: 'id', value: 'value' },
                { kind: 'templateMiddle', value: 'b', source: 'b' },
                { kind: 'templateHead', value: 'c', source: 'c' }, { kind: 'id', value: 'x' },
                { kind: 'templateTail', value: 'd', source: 'd' },
                { kind: 'templateTail', value: 'e', source: 'e' }, { kind: 'eof' },
            ])
            /** @type {(source: string) => readonly string[]} */
            const kinds = source => toArray(tokenize(stringToCodePointList(source))('')).map(({ token }) => token.kind)
                .filter(kind => kind !== 'ws' && kind !== 'nl' && kind !== '/*' && kind !== '//')
            assertStructurallySame(kinds('`${()=>{switch(x){case 0:{return `n`}}}}end`'), [
                'templateHead', '(', ')', '=>', '{', 'switch', '(', 'id', ')', '{', 'case', 'number', ':', '{',
                'return', 'noSubstitutionTemplate', '}', '}', '}', 'templateTail', 'eof',
            ])
            assertStructurallySame(kinds('`${/* } `${ */"}"// } `${\n}end`'), ['templateHead', 'string', 'templateTail', 'eof'])
            assertStructurallySame(kinds('`${`plain` + x}end`'), ['templateHead', 'noSubstitutionTemplate', '+', 'id', 'templateTail', 'eof'])
        },
        positions: () => {
            const tokens = toArray(tokenize(stringToCodePointList('`a\r\n${value}b\u2028${other}c` x'))('p'))
            assertStructurallySame(tokens.map(({ metadata }) => [metadata.line, metadata.column]), [
                [1, 1], [2, 3], [2, 8], [3, 3], [3, 8], [3, 11], [3, 12], [3, 13],
            ])
        },
        failures: () => {
            assertEq(errorAt('x `unfinished'), '1:3..1:14')
            assertEq(errorAt('`a${x'), '1:1..1:6')
            assertEq(errorAt('`a${`inner'), '1:5..1:11')
            assertEq(errorAt('`a${x}bad'), '1:6..1:10')
            assertEq(errorAt('`\\xG1`'), '1:1..1:7')
            assertEq(errorAt('`\\u{}`'), '1:1..1:7')
            assertEq(errorAt('`\\01`'), '1:1..1:6')
            assertEq(errorAt('`\\8`'), '1:1..1:5')
            assertEq(tokenizeString('`\\u{110000}`'), 'error')
            assertEq(tokenizeString('`\\u{1100000}`'), 'error')
            assertEq(tokenizeString('`\\u{0000000000000000110000}`'), 'error')
            assertEq(tokenizeString('`\\u{FFFFFFFFFFFFFFFFFFFFFFFF}`'), 'error')
            assertEq(tokenizeString('`\\u{12G}`'), 'error')
            assertEq(tokenizeString('`\\u12`'), 'error')
            assertEq(tokenizeString('`\\x1`'), 'error')
            assertEq(tokenizeString('`\\'), 'error')
            // Ordinary quoted strings retain their existing escape subset.
            assertEq(tokenizeString('"\\x41"'), 'error')
        },
    },
    // What the grammar covers, token by token, whatever the layers above
    // make of the tokens. The token stream itself — kind, text, position —
    // is pinned by every `tokenizeString` and `tokenize` case below, which
    // the descent tokenizer met before the port and this one meets unchanged.
    isValid: () => covers([
        ['"', false],
        ['   true   ', true],
        ['   tr2ue   ', true],
        ['   2true   ', true],
        ['   true"   ', false],
        ['   "Hello"   ', true],
        ['   "Hello   ', false],
        ['   "Hello\\n\\r\\""   ', true],
        ['   56.7e+5  ', true],
        ['   -56.7e+5  ', true],
        ['   h-56.7e+5   ', true],
        ['   -56.7e+5   3', true],
        ['   [] ', true],
        ['   {} ', true],
        ['   [[[]]] ', true],
        ['   [1] ', true],
        ['   [ 12, false, "a"]  ', true],
        ['   [ 12, false2, "a"]  ', true],
        ['   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', true],
        ['   { "q": [ 12, false, [{}], "a"] }  ', true],
        ['   { "q": [ 12, false, [}], "a"] }  ', true],
        ['   [{ "q": [ 12, false, [{}], "a"] }]  ', true],
        ['   [{ "q": [ 12, false, [}], "a"] }]  ', true],
        ['. + ++ +=', true],
        ['//12\n', true],
        ['/*12*/', true],
        ['/* 1*2 */', true],
    ]),
    djs: [
        () => {
            const result = tokenizeString('')
            assertStructurallySame(result, [{ kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('{')
            assertStructurallySame(result, [{ kind: '{' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('}')
            assertStructurallySame(result, [{ kind: '}' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString(':')
            assertStructurallySame(result, [{ kind: ':' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString(',')
            assertStructurallySame(result, [{ kind: ',' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('[')
            assertStructurallySame(result, [{ kind: '[' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString(']')
            assertStructurallySame(result, [{ kind: ']' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('ᄑ')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('{ \t\n\r}')
            assertStructurallySame(result, [{ kind: '{' }, { kind: 'nl' }, { kind: '}' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('""')
            assertStructurallySame(result, [{ kind: 'string', value: '' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"value"')
            assertStructurallySame(result, [{ kind: 'string', value: 'value' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"value')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"value1" "value2"')
            assertStructurallySame(result, [
                { kind: 'string', value: 'value1' },
                { kind: 'ws' },
                { kind: 'string', value: 'value2' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\\\"')
            assertStructurallySame(result, [{ kind: 'string', value: '\\' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\""')
            assertStructurallySame(result, [{ kind: 'string', value: '"' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\/"')
            assertStructurallySame(result, [{ kind: 'string', value: '/' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\x"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\r"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\n null')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\b\\f\\n\\r\\t"')
            assertStructurallySame(result, [{ kind: 'string', value: '\b\f\n\r\t' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\u1234"')
            assertStructurallySame(result, [{ kind: 'string', value: 'ሴ' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\uaBcDEeFf"')
            assertStructurallySame(result, [{ kind: 'string', value: 'ꯍEeFf' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('"\\uEeFg"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\u0000\\uFFFF\\uD83D\\uDE00"')
            assertStructurallySame(result, [{ kind: 'string', value: '\u0000\uffff😀' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('0')
            assertStructurallySame(result, [{ kind: 'number', value: '0' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('[0]')
            assertStructurallySame(result, [
                { kind: '[' },
                { kind: 'number', value: '0' },
                { kind: ']' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('00')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('0abc,')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('123456789012345678901234567890')
            assertStructurallySame(result, [
                { kind: 'number', value: '123456789012345678901234567890' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('{90}')
            assertStructurallySame(result, [
                { kind: '{' },
                { kind: 'number', value: '90' },
                { kind: '}' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('1 2')
            assertStructurallySame(result, [
                { kind: 'number', value: '1' },
                { kind: 'ws' },
                { kind: 'number', value: '2' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('0. 2')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('10-0')
            assertStructurallySame(result, [
                { kind: 'number', value: '10' },
                { kind: '-' },
                { kind: 'number', value: '0' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('9a:')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-10')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '10' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-0')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '0' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-00')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-.123')
            assertStructurallySame(result, [
                { kind: '-' },
                { kind: '.' },
                { kind: 'number', value: '123' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('0.01')
            assertStructurallySame(result, [{ kind: 'number', value: '0.01' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-0.9')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '0.9' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-0.')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-0.]')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('12.34')
            assertStructurallySame(result, [{ kind: 'number', value: '12.34' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-12.00')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '12.00' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-12.')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('12.]')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('0e1')
            assertStructurallySame(result, [{ kind: 'number', value: '0e1' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('0e+2')
            assertStructurallySame(result, [{ kind: 'number', value: '0e+2' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('0e-0')
            assertStructurallySame(result, [{ kind: 'number', value: '0e-0' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('12e0000')
            assertStructurallySame(result, [{ kind: 'number', value: '12e0000' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-12e-0001')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '12e-0001' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-12.34e1234')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'number', value: '12.34e1234' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('0e')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('0e-')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('ABCdef1234567890$_')
            assertStructurallySame(result, [{ kind: 'id', value: 'ABCdef1234567890$_' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('{ABCdef1234567890$_}')
            assertStructurallySame(result, [
                { kind: '{' },
                { kind: 'id', value: 'ABCdef1234567890$_' },
                { kind: '}' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('123 _123')
            assertStructurallySame(result, [
                { kind: 'number', value: '123' },
                { kind: 'ws' },
                { kind: 'id', value: '_123' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('123 $123')
            assertStructurallySame(result, [
                { kind: 'number', value: '123' },
                { kind: 'ws' },
                { kind: 'id', value: '$123' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('123_123')
            assertStructurallySame(result, [{ kind: 'number', value: '123_123' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('123$123')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('1234567890n')
            assertStructurallySame(result, [{ kind: 'bigint', value: 1234567890n }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('0n')
            assertStructurallySame(result, [{ kind: 'bigint', value: 0n }, { kind: 'eof' }])
        },
        () => {
            // hexadecimal: the number keeps its spelling, the bigint is its value
            const result = tokenizeString('0xFF 0XaBn')
            assertStructurallySame(result, [
                { kind: 'number', value: '0xFF' },
                { kind: 'ws' },
                { kind: 'bigint', value: 171n },
                { kind: 'eof' },
            ])
        },
        () => {
            assertEq(tokenizeString('0x'), 'error')
            assertEq(tokenizeString('0x1g'), 'error')
            assertEq(tokenizeString('0x1n2'), 'error')
            assertEq(tokenizeString('0b'), 'error')
            assertEq(tokenizeString('0B2'), 'error')
            assertEq(tokenizeString('0b102'), 'error')
            assertEq(tokenizeString('0b1e2'), 'error')
            assertEq(tokenizeString('0b1n2'), 'error')
            assertStructurallySame(tokenizeString('0b1_0'), [{ kind: 'number', value: '0b1_0' }, { kind: 'eof' }])
            assertStructurallySame(tokenizeString('1_000 0xF_Fn 0B1_0n'), [
                { kind: 'number', value: '1_000' },
                { kind: 'ws' },
                { kind: 'bigint', value: 255n },
                { kind: 'ws' },
                { kind: 'bigint', value: 2n },
                { kind: 'eof' },
            ])
            for (const source of ['1_', '1__0', '0_1', '0x_FF', '0b_1', '1_.0', '1._0', '1e_2', '1e+_2', '1_n', '0x1_n', '0b1_n']) {
                assertEq(tokenizeString(source), 'error')
            }
            assertStructurallySame(tokenizeString('0b101 0B01n'), [
                { kind: 'number', value: '0b101' },
                { kind: 'ws' },
                { kind: 'bigint', value: 1n },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('[-1234567890n]')
            assertStructurallySame(result, [
                { kind: '[' },
                { kind: '-' },
                { kind: 'bigint', value: 1234567890n },
                { kind: ']' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('123.456n')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('123e456n')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('1234567890na')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('1234567890nn')
            assertEq(result, 'error')
        },
    ],
    // A string between single quotes is JSON's with the delimiters swapped
    // (`spec/todo/2460-js-string-literals.md`): the same value as its
    // double-quoted spelling, a `"` standing for itself, `\'` the one escape
    // it adds, and everything else JSON refuses still refused.
    singleQuoted: {
        sameValue: () => {
            assertStructurallySame(tokenizeString("'value'"), tokenizeString('"value"'))
            assertStructurallySame(tokenizeString("''"), tokenizeString('""'))
            assertStructurallySame(tokenizeString("'\\u0041\\n\\t\\/\\\\'"), tokenizeString('"\\u0041\\n\\t\\/\\\\"'))
            assertStructurallySame(tokenizeString("'é😀'"), tokenizeString('"é😀"'))
        },
        // U+2028 and U+2029 are line terminators to JavaScript but not
        // control characters, so JSON admits them raw in a string, and so
        // does either quote here; a line feed or carriage return does not
        separators: () => {
            assertStructurallySame(tokenizeString("'\u2028\u2029'"), [
                { kind: 'string', value: '\u2028\u2029' },
                { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString("'\u2028\u2029'"), tokenizeString('"\u2028\u2029"'))
            assertEq(tokenizeString("'a\rb'"), 'error')
        },
        otherQuote: () => {
            assertStructurallySame(tokenizeString("'a\"b'"), [{ kind: 'string', value: 'a"b' }, { kind: 'eof' }])
            assertStructurallySame(tokenizeString("'a\\\"b'"), [{ kind: 'string', value: 'a"b' }, { kind: 'eof' }])
            assertStructurallySame(tokenizeString('"it\'s"'), [{ kind: 'string', value: 'it\'s' }, { kind: 'eof' }])
        },
        escapedQuote: () => {
            assertStructurallySame(tokenizeString("'can\\'t'"), [{ kind: 'string', value: 'can\'t' }, { kind: 'eof' }])
        },
        refused: () => {
            // `\'` is not JSON's, so a double-quoted string keeps refusing it
            assertEq(tokenizeString('"\\\'"'), 'error')
            // JavaScript's other escapes are not FunctionalScript's
            assertEq(tokenizeString("'\\x41'"), 'error')
            assertEq(tokenizeString("'\\v'"), 'error')
            assertEq(tokenizeString("'\\0'"), 'error')
            // no raw control character, no line terminator, no end
            assertEq(tokenizeString("'\t'"), 'error')
            assertEq(tokenizeString("'a\nb'"), 'error')
            assertEq(tokenizeString("'a"), 'error')
            assertEq(tokenizeString("'"), 'error')
        },
        twoStrings: () => {
            assertStructurallySame(tokenizeString("'a' \"b\""), [
                { kind: 'string', value: 'a' },
                { kind: 'ws' },
                { kind: 'string', value: 'b' },
                { kind: 'eof' },
            ])
        },
    },
    operators:
    [
        () => {
            const result = tokenizeString('=')
            assertStructurallySame(result, [{ kind: '=' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('=a')
            assertStructurallySame(result, [{ kind: '=' }, { kind: 'id', value: 'a' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('-')
            assertStructurallySame(result, [{ kind: '-' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('1*2')
            assertStructurallySame(result, [
                { kind: 'number', value: '1' },
                { kind: '*' },
                { kind: 'number', value: '2' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('( )')
            assertStructurallySame(result, [{ kind: '(' }, { kind: 'ws' }, { kind: ')' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('== != === !== > >= < <=')
            assertStructurallySame(result, [
                { kind: '==' },
                { kind: 'ws' },
                { kind: '!=' },
                { kind: 'ws' },
                { kind: '===' },
                { kind: 'ws' },
                { kind: '!==' },
                { kind: 'ws' },
                { kind: '>' },
                { kind: 'ws' },
                { kind: '>=' },
                { kind: 'ws' },
                { kind: '<' },
                { kind: 'ws' },
                { kind: '<=' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('+ - * / % ++ -- **')
            assertStructurallySame(result, [
                { kind: '+' },
                { kind: 'ws' },
                { kind: '-' },
                { kind: 'ws' },
                { kind: '*' },
                { kind: 'ws' },
                { kind: '/' },
                { kind: 'ws' },
                { kind: '%' },
                { kind: 'ws' },
                { kind: '++' },
                { kind: 'ws' },
                { kind: '--' },
                { kind: 'ws' },
                { kind: '**' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('= += -= *= /= %= **=')
            assertStructurallySame(result, [
                { kind: '=' },
                { kind: 'ws' },
                { kind: '+=' },
                { kind: 'ws' },
                { kind: '-=' },
                { kind: 'ws' },
                { kind: '*=' },
                { kind: 'ws' },
                { kind: '/=' },
                { kind: 'ws' },
                { kind: '%=' },
                { kind: 'ws' },
                { kind: '**=' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('& | ^ ~ << >> >>>')
            assertStructurallySame(result, [
                { kind: '&' },
                { kind: 'ws' },
                { kind: '|' },
                { kind: 'ws' },
                { kind: '^' },
                { kind: 'ws' },
                { kind: '~' },
                { kind: 'ws' },
                { kind: '<<' },
                { kind: 'ws' },
                { kind: '>>' },
                { kind: 'ws' },
                { kind: '>>>' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('&= |= ^= <<= >>= >>>=')
            assertStructurallySame(result, [
                { kind: '&=' },
                { kind: 'ws' },
                { kind: '|=' },
                { kind: 'ws' },
                { kind: '^=' },
                { kind: 'ws' },
                { kind: '<<=' },
                { kind: 'ws' },
                { kind: '>>=' },
                { kind: 'ws' },
                { kind: '>>>=' },
                { kind: 'eof' },
            ])
        },
        () => {
            // '<<<' and '<<<=' are not JS operators; maximal munch tokenizes them
            // as '<<' followed by '<' / '<=', matching the old tokenizer's behavior.
            const result = tokenizeString('<<< <<<=')
            assertStructurallySame(result, [
                { kind: '<<' },
                { kind: '<' },
                { kind: 'ws' },
                { kind: '<<' },
                { kind: '<=' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('&& || ! ??')
            assertStructurallySame(result, [
                { kind: '&&' },
                { kind: 'ws' },
                { kind: '||' },
                { kind: 'ws' },
                { kind: '!' },
                { kind: 'ws' },
                { kind: '??' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('&&= ||= ??=')
            assertStructurallySame(result, [
                { kind: '&&=' },
                { kind: 'ws' },
                { kind: '||=' },
                { kind: 'ws' },
                { kind: '??=' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('? ?. . =>')
            assertStructurallySame(result, [
                { kind: '?' },
                { kind: 'ws' },
                { kind: '?.' },
                { kind: 'ws' },
                { kind: '.' },
                { kind: 'ws' },
                { kind: '=>' },
                { kind: 'eof' },
            ])
        },
    ],
    ws: [
        () => {
            const result = tokenizeString(' ')
            assertStructurallySame(result, [{ kind: 'ws' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('\t')
            assertStructurallySame(result, [{ kind: 'ws' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString(' \t')
            assertStructurallySame(result, [{ kind: 'ws' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('\n')
            assertStructurallySame(result, [{ kind: 'nl' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('\r')
            assertStructurallySame(result, [{ kind: 'nl' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString(' \t\n\r ')
            assertStructurallySame(result, [{ kind: 'nl' }, { kind: 'eof' }])
        },
        () => {
            // the Unicode line and paragraph separators are no token outside a
            // string: not a newline, not comment text — a line comment ends at
            // one as JavaScript's does, and a block comment cannot hold one
            assertEq(tokenizeString('\u2028'), 'error')
            assertEq(tokenizeString('a \u2029 b'), 'error')
            assertEq(tokenizeString('/* a\u2028b */'), 'error')
            assertEq(tokenizeString('/* a\u2029b */'), 'error')
            assertEq(tokenizeString('// a\u2028b'), 'error')
            assertEq(tokenizeString('// a\u2029b'), 'error')
            assertStructurallySame(tokenizeString('"a\u2028b"'), [
                { kind: 'string', value: 'a\u2028b' },
                { kind: 'eof' },
            ])
            assertStructurallySame(tokenizeString('"a\u2029b"'), [
                { kind: 'string', value: 'a\u2029b' },
                { kind: 'eof' },
            ])
        },
    ],
    id: [
        () => {
            const result = tokenizeString('err')
            assertStructurallySame(result, [{ kind: 'id', value: 'err' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('{e}')
            assertStructurallySame(result, [{ kind: '{' }, { kind: 'id', value: 'e' }, { kind: '}' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('tru')
            assertStructurallySame(result, [{ kind: 'id', value: 'tru' }, { kind: 'eof' }])
        },
    ],
    keywords: [
        () => {
            const result = tokenizeString('true')
            assertStructurallySame(result, [{ kind: 'true' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('false')
            assertStructurallySame(result, [{ kind: 'false' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('null')
            assertStructurallySame(result, [{ kind: 'null' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('undefined')
            assertStructurallySame(result, [{ kind: 'undefined' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('[null]')
            assertStructurallySame(result, [{ kind: '[' }, { kind: 'null' }, { kind: ']' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('arguments')
            assertStructurallySame(result, [{ kind: 'arguments' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('await')
            assertStructurallySame(result, [{ kind: 'await' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('break')
            assertStructurallySame(result, [{ kind: 'break' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('case')
            assertStructurallySame(result, [{ kind: 'case' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('catch')
            assertStructurallySame(result, [{ kind: 'catch' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('class')
            assertStructurallySame(result, [{ kind: 'class' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('const')
            assertStructurallySame(result, [{ kind: 'const' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('continue')
            assertStructurallySame(result, [{ kind: 'continue' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('debugger')
            assertStructurallySame(result, [{ kind: 'debugger' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('default')
            assertStructurallySame(result, [{ kind: 'default' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('delete')
            assertStructurallySame(result, [{ kind: 'delete' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('do')
            assertStructurallySame(result, [{ kind: 'do' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('else')
            assertStructurallySame(result, [{ kind: 'else' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('enum')
            assertStructurallySame(result, [{ kind: 'enum' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('eval')
            assertStructurallySame(result, [{ kind: 'eval' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('export')
            assertStructurallySame(result, [{ kind: 'export' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('extends')
            assertStructurallySame(result, [{ kind: 'extends' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('finally')
            assertStructurallySame(result, [{ kind: 'finally' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('for')
            assertStructurallySame(result, [{ kind: 'for' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('function')
            assertStructurallySame(result, [{ kind: 'function' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('if')
            assertStructurallySame(result, [{ kind: 'if' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('implements')
            assertStructurallySame(result, [{ kind: 'implements' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('import')
            assertStructurallySame(result, [{ kind: 'import' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('in')
            assertStructurallySame(result, [{ kind: 'in' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('instanceof')
            assertStructurallySame(result, [{ kind: 'instanceof' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('interface')
            assertStructurallySame(result, [{ kind: 'interface' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('let')
            assertStructurallySame(result, [{ kind: 'let' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('new')
            assertStructurallySame(result, [{ kind: 'new' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('package')
            assertStructurallySame(result, [{ kind: 'package' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('private')
            assertStructurallySame(result, [{ kind: 'private' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('protected')
            assertStructurallySame(result, [{ kind: 'protected' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('public')
            assertStructurallySame(result, [{ kind: 'public' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('return')
            assertStructurallySame(result, [{ kind: 'return' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('static')
            assertStructurallySame(result, [{ kind: 'static' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('super')
            assertStructurallySame(result, [{ kind: 'super' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('switch')
            assertStructurallySame(result, [{ kind: 'switch' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('this')
            assertStructurallySame(result, [{ kind: 'this' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('throw')
            assertStructurallySame(result, [{ kind: 'throw' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('try')
            assertStructurallySame(result, [{ kind: 'try' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('typeof')
            assertStructurallySame(result, [{ kind: 'typeof' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('var')
            assertStructurallySame(result, [{ kind: 'var' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('void')
            assertStructurallySame(result, [{ kind: 'void' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('while')
            assertStructurallySame(result, [{ kind: 'while' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('with')
            assertStructurallySame(result, [{ kind: 'with' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('yield')
            assertStructurallySame(result, [{ kind: 'yield' }, { kind: 'eof' }])
        },
    ],
    comments: [
        () => {
            const result = tokenizeString('//singleline comment')
            assertStructurallySame(result, [{ kind: '//', value: 'singleline comment' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('true//singleline comment\nfalse')
            assertStructurallySame(result, [
                { kind: 'true' },
                { kind: '//', value: 'singleline comment' },
                { kind: 'nl' },
                { kind: 'false' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('/* multiline comment */')
            assertStructurallySame(result, [{ kind: '/*', value: ' multiline comment ' }, { kind: 'eof' }])
        },
        () => {
            // a `/` inside the body is content: only `*/` ends the comment
            const result = tokenizeString('/* a/b ../../x.ts */')
            assertStructurallySame(result, [{ kind: '/*', value: ' a/b ../../x.ts ' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('/* multiline comment *')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('/* multiline comment ')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('/* multiline comment \n * **/')
            assertStructurallySame(result, [
                { kind: '/*', value: ' multiline comment \n * *' },
                { kind: 'nl' },
                { kind: 'eof' },
            ])
        },
        () => {
            const result = tokenizeString('/* multiline comment *\n * **/')
            assertStructurallySame(result, [
                { kind: '/*', value: ' multiline comment *\n * *' },
                { kind: 'nl' },
                { kind: 'eof' },
            ])
        },
        // `'/'` is an `operatorTags` member for division, so a line comment's own
        // slashes must be consumed by the comment rule before the tag reaches
        // `filterFunc`. These pin that: a multi-character line comment stays one
        // token, inner slashes included, and division still tokenizes as an
        // operator.
        () => {
            const result = tokenizeString('//ab\n')
            assertStructurallySame(result, [{ kind: '//', value: 'ab' }, { kind: 'nl' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('//a//b\n')
            assertStructurallySame(result, [{ kind: '//', value: 'a//b' }, { kind: 'nl' }, { kind: 'eof' }])
        },
        () => {
            const result = tokenizeString('a/b')
            assertStructurallySame(result, [
                { kind: 'id', value: 'a' },
                { kind: '/' },
                { kind: 'id', value: 'b' },
                { kind: 'eof' },
            ])
        },
    ],
    metadata: [
        () => {
            const result = toArray(tokenize(stringToList(''))('a.js'))
            assertStructurallySame(result, [{ token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 1 } }])
        },
        () => {
            const result = toArray(tokenize(stringToList('true'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'true' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 5 } },
            ])
        },
        () => {
            const result = toArray(tokenize(stringToList('true false'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'true' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'ws' }, metadata: { path: 'a.js', line: 1, column: 5 } },
                { token: { kind: 'false' }, metadata: { path: 'a.js', line: 1, column: 6 } },
                { token: { kind: 'eof' }, metadata: { path: 'a.js', line: 1, column: 11 } },
            ])
        },
        () => {
            // a lone \n collapses into a single nl token, but line/column still advance
            // correctly for whatever comes after it
            const result = toArray(tokenize(stringToList('a\nb'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'id', value: 'a' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'nl' }, metadata: { path: 'a.js', line: 1, column: 2 } },
                { token: { kind: 'id', value: 'b' }, metadata: { path: 'a.js', line: 2, column: 1 } },
                { token: { kind: 'eof' }, metadata: { path: 'a.js', line: 2, column: 2 } },
            ])
        },
        () => {
            // two consecutive newlines still collapse into one nl token, but line still
            // advances by two for the token after them
            const result = toArray(tokenize(stringToList('a\n\nb'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'id', value: 'a' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'nl' }, metadata: { path: 'a.js', line: 1, column: 2 } },
                { token: { kind: 'id', value: 'b' }, metadata: { path: 'a.js', line: 3, column: 1 } },
                { token: { kind: 'eof' }, metadata: { path: 'a.js', line: 3, column: 2 } },
            ])
        },
        () => {
            // position after a multi-line block comment resumes on the comment's closing line
            const result = toArray(tokenize(stringToList('/* c\n */ x'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: '/*', value: ' c\n ' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'nl' }, metadata: { path: 'a.js', line: 1, column: 1 } },
                { token: { kind: 'ws' }, metadata: { path: 'a.js', line: 2, column: 4 } },
                { token: { kind: 'id', value: 'x' }, metadata: { path: 'a.js', line: 2, column: 5 } },
                { token: { kind: 'eof' }, metadata: { path: 'a.js', line: 2, column: 6 } },
            ])
        },
        () => {
            const result = toArray(tokenize(stringToList('"unterminated'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'error', message: 'invalid token', end: { line: 1, column: 14 } }, metadata: { path: 'a.js', line: 1, column: 1 } },
            ])
        },
        () => {
            // position points at the poisoning trailing char ('0'), not the start of input
            const result = toArray(tokenize(stringToList('00'))('a.js'))
            assertStructurallySame(result, [
                { token: { kind: 'error', message: 'invalid number' }, metadata: { path: 'a.js', line: 1, column: 2 } },
            ])
        },
    ],
    // Where an error token is reported. The `tokenizer` group above checks that
    // these inputs are rejected at all, through the metadata-free
    // `tokenizeString`; here the same shapes go through `tokenize` so the
    // position is pinned too.
    errorPosition: [
        () => {
            // input that tokenizes cleanly produces no error token at all —
            // without this the helper's own no-error branch never runs
            assertEq(errorAt('x'), 'no error')
            assertEq(errorAt('{ "a": 1 }'), 'no error')
        },
        () => {
            // a character no rule accepts: reported where it stands, spanning
            // to the end of input — nothing past a lexical failure is tokenized,
            // so everything from the failure on is part of what it rejects
            assertEq(errorAt('ᄑ'), '1:1..1:2')
        },
        () => {
            // after a good prefix, the position advances past it
            assertEq(errorAt('x @'), '1:3..1:4')
        },
        () => {
            // line as well as column, once newlines have been consumed; the
            // second case's span covers the `y` too, which the failure at `@`
            // kept from ever being tokenized
            assertEq(errorAt('a\nb\n@'), '3:1..3:2')
            assertEq(errorAt('x\n\n  @y'), '3:3..3:5')
        },
        () => {
            // a number poisoned by a trailing character points at that
            // character, with no end: the source it is about — `00` up to and
            // including the second `0` — ends where the anchor *starts*, so a
            // forward span from the anchor cannot describe it
            assertEq(errorAt('00'), '1:2')
        },
        () => {
            // a number cut short points just past the input
            assertEq(errorAt('1.'), '1:3')
            assertEq(errorAt('0x'), '1:3')
            // or at the character where a digit was expected
            assertEq(errorAt('0xg'), '1:3')
        },
        () => {
            // Unterminated tokens anchor at the token's *start*, not where the
            // input ran out: the grammar matches them and tags them
            // 'unterminated', so this is the structural-error path, not a failed
            // match. They span to where the input ran out — the far end is
            // where the missing close quote belongs, one past the token's last
            // character, crossing lines when the token does.
            assertEq(errorAt('"value'), '1:1..1:7')
            assertEq(errorAt('"a\nb"'), '1:1..2:3')
        },
        () => {
            // an unterminated block comment is anchored at its `/*`, like an
            // unterminated string is at its quote — it used to report the end of
            // input, which made the two constructs disagree
            assertEq(errorAt('/* c'), '1:1..1:5')
        },
        () => {
            // the *second* comment is the unclosed one, so it is the one
            // blamed, and the span starts at its `/*`, not the first one's
            assertEq(errorAt('/* ok */ /* bad'), '1:10..1:16')
        },
        () => {
            // a malformed number keeps its own convention: the offending
            // character, not the token start, because that is what the reader
            // has to change — and therefore no end, for the same reason as `00`
            assertEq(errorAt('123abc'), '1:4')
        },
        () => {
            // errors come in document order, the boundary between a number
            // and the token against it included, whatever that token then
            // does: `01.` is refused at the `1`, not where its digits ran out,
            // and `01"` at the `1`, not at the string the input ends inside;
            // with a space between there is no boundary, and the number cut short
            // points just past the input, as `1.` alone does
            assertEq(errorAt('01.'), '1:2')
            assertEq(errorAt('01"'), '1:2')
            assertEq(errorAt('0 1.'), '1:5')
            assertEq(errorAt('1"'), '1:2..1:3')
            // a malformed number before an unterminated comment is the first
            // error, where the descent tokenizer looked for the comment first
            assertEq(errorAt('123abc /* x'), '1:4')
            assertEq(errorAt('/* x */ 123abc'), '1:12')
        },
    ],
    // A line starts after each of ECMAScript's `LineTerminatorSequence`s:
    // LF, CR, U+2028, U+2029, and CRLF once — whichever token holds it.
    // The position of each code point, and of the end, by the fold that
    // positions the tokens: a linkage export for readers who need an offset.
    positions: () => {
        /** @type {(text: string) => string} */
        const at = text => _positions('p')(toArray(stringToCodePointList(text))).map(({ line, column }) => `${line}:${column}`).join(' ')
        assertEq(at(''), '1:1')
        assertEq(at('ab'), '1:1 1:2 1:3')
        assertEq(at('a\nb'), '1:1 1:2 2:1 2:2')
        // a CRLF starts one line, and its LF takes the position of what follows it
        assertEq(at('a\r\nb'), '1:1 1:2 2:1 2:1 2:2')
        // a character beyond U+FFFF is one position
        assertEq(at('😀b'), '1:1 1:2 1:3')
    },
    lineTerminators: [
        () => {
            // without an `x`, the helper says so
            assertEq(xAt('y'), 'no x')
        },
        () => {
            // LF alone, as before
            assertEq(xAt('a\nx'), '2:1')
            assertEq(xAt('a\n\nx'), '3:1')
        },
        () => {
            // a lone CR starts a line, and two start two
            assertEq(xAt('a\rx'), '2:1')
            assertEq(xAt('a\r\rx'), '3:1')
            assertEq(xAt('export default 1;\r\rx;\n'), '3:1')
        },
        () => {
            // CRLF is one line terminator; LF CR is two
            assertEq(xAt('a\r\nx'), '2:1')
            assertEq(xAt('a\r\n\r\nx'), '3:1')
            assertEq(xAt('a\n\rx'), '3:1')
        },
        () => {
            // inside a block comment, CR and CRLF each start one line
            assertEq(xAt('/* c\r */ x'), '2:5')
            assertEq(xAt('/* c\r\n */ x'), '2:5')
            assertEq(xAt('/* c\r\r */ x'), '3:5')
        },
        () => {
            // a CR ends a line comment and starts a line
            assertEq(xAt('// c\rx'), '2:1')
            assertEq(xAt('// c\r\nx'), '2:1')
        },
        () => {
            // the separators a string may hold start a line too
            assertEq(xAt('"a\u2028b"\nx'), '3:1')
            assertEq(xAt('"a\u2029b" x'), '2:4')
        },
        () => {
            // an error after a lone CR is reported on the CR's next line
            assertEq(errorAt('a\r@'), '2:1..2:2')
            assertEq(errorAt('a\r\n@'), '2:1..2:2')
        },
    ],
    // Regression coverage for large inputs: both a file with many short tokens and a
    // single very long token used to overflow the JS call stack, when the matcher
    // recursed once per grammar step. The LL(1) machine runs on an explicit frame
    // stack and the tokenizer resumes it once per token, so a file of any length
    // is a loop, and a token of any length one match.
    largeInputs: [
        () => {
            // many short whitespace tokens: the reported repro (`' '.repeat(5000)`)
            const result = tokenizeString(' '.repeat(5_000))
            assertStructurallySame(result, [{ kind: 'ws' }, { kind: 'eof' }])
        },
        () => {
            // many distinct short tokens, well past the ~1000-1500 token crash threshold
            // the old whole-file recursive match hit for this shape
            const ids = Array.from({ length: 3_000 }, (_, i) => `a${i % 10}`)
            const src = ids.join(' ')
            // Compared whole rather than counted: at this size the count was
            // the only thing the old JSON round-trip could check, while the
            // expected list also pins every token's content.
            assertStructurallySame(tokenizeString(src), [
                ...ids.flatMap((value, i) => i === 0 ? [{ kind: 'id', value }] : [{ kind: 'ws' }, { kind: 'id', value }]),
                { kind: 'eof' },
            ])
            // The token list with positions agrees: 3000 ids + 2999
            // separating ws + a trailing eof token.
            assertEq(toArray(tokenize(stringToList(src))('a.js')).length, 3_000 + 2_999 + 1)
        },
        () => {
            // same many-short-tokens shape through the metadata-aware entry point
            const src = 'x '.repeat(3_000)
            const result = toArray(tokenize(stringToList(src))('a.js'))
            assertEq(result.length, 3_000 * 2 + 1)
        },
        () => {
            // a single long token: a 5 KB string literal — overflows unless the
            // matcher itself is iterative
            const value = 'a'.repeat(5_000)
            const result = tokenizeString(`"${value}"`)
            assertStructurallySame(result, [{ kind: 'string', value }, { kind: 'eof' }])
        },
        () => {
            // a single long token via the hand-written recursive multilineContent rule:
            // a 20 KB block comment (the size the pre-grammar tokenizer handled)
            const value = 'x'.repeat(20_000)
            const result = tokenizeString(`/*${value}*/`)
            assertStructurallySame(result, [{ kind: '/*', value }, { kind: 'eof' }])
        },
        () => {
            // a single long identifier (repeat0Plus(idChar) inside one token match)
            const value = 'x'.repeat(10_000)
            const result = tokenizeString(value)
            assertStructurallySame(result, [{ kind: 'id', value }, { kind: 'eof' }])
        },
    ],
    demo: {
        // Trivia is kept: a comment shows its text, and whitespace is one token.
        tokens: () => assertEq(tokensOf('a // c\n`t${1n}`'), [
            '1:1  id  "a"',
            '1:2  ws',
            '1:3  //  " c"',
            '1:7  nl',
            '2:1  templateHead  "t"',
            '2:5  bigint  1n',
            '2:7  templateTail  ""',
            '2:9  eof',
        ].join('\n')),
        // An error is the whole stream.
        error: () => assertEq(tokensOf('123abc'), '1:4  error  invalid number'),
        // A line or paragraph separator in a value stays escaped, so a token
        // keeps one line.
        separators: () => assertEq(tokensOf('"\\u2028\\u2029"'), '1:1  string  "\\u2028\\u2029"\n1:15  eof'),
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            assertEq(step({ kind: 'input', name: 'source', value: 'x' })(''), 'x')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="source"'), html)
            assert(html.includes('templateHead'), html)
        },
    },
}
