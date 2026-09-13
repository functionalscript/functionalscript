/**
 * @import { Meta } from '../../ebnf/ast/types.ts'
 */

import { stringToCodePointList, stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { parser } from '../../ebnf/ll1/module.f.mjs'
import { token as ebnfToken } from '../../ebnf/lib/js/module.f.mjs'
import { tokenize } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { stringifyAsTree } from '../../djs/serializer/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

// JsTokenWithMetadata carries bigint fields that JSON.stringify cannot
// serialize — the DJS tree serializer can, and this is a proof-local dump.
const stringify = stringifyAsTree(sort)

/**
 * The tokens of a text as one string, positions left out — `error` where
 * the text does not tokenize. Proof-local: it exists to make an expectation
 * one readable string.
 *
 * @type {(s: string) => string}
 */
const tokenizeString = s => {
    const tokens = toArray(tokenize(stringToCodePointList(s))(''))
    return tokens.some(({ token }) => token.kind === 'error')
        ? 'error'
        : stringify(tokens.map(({ token }) => token))
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

/** The grammar's parser of one token, resumed per token below. */
const parseToken = parser(ebnfToken)

/**
 * Whether the grammar reads the whole text as tokens — whatever the layers
 * above then make of them, so `2true` is covered, two tokens side by side.
 *
 * @type {(s: string) => boolean}
 */
const covers = s => {
    /** @type {readonly Meta<null>[]} */
    const symbols = toArray(stringToCodePointList(s)).map(symbol => ({ symbol, meta: null }))
    let pos = 0
    while (pos < symbols.length) {
        const match = parseToken(symbols, pos)
        if (match[0] === 'error') { return false }
        pos = match[1][1]
    }
    return true
}

export const proof = {
    // What the grammar covers, token by token, whatever the layers above
    // make of the tokens. The token stream itself — kind, text, position —
    // is pinned by every `tokenizeString` and `tokenize` case below, which
    // the descent tokenizer met before the port and this one meets unchanged.
    isValid: [() => {
            /** @type {(s: string, expected: boolean) => void} */
            const expect = (s, expected) => {
                assertEq(covers(s), expected, s)
            }

            expect('"', false)
            expect('   true   ', true)
            expect('   tr2ue   ', true)
            expect('   2true   ', true)
            expect('   true"   ', false)
            expect('   "Hello"   ', true)
            expect('   "Hello   ', false)
            expect('   "Hello\\n\\r\\""   ', true)
            expect('   56.7e+5  ', true)
            expect('   -56.7e+5  ', true)
            expect('   h-56.7e+5   ', true)
            expect('   -56.7e+5   3', true)
            expect('   [] ', true)
            expect('   {} ', true)
            expect('   [[[]]] ', true)
            expect('   [1] ', true)
            expect('   [ 12, false, "a"]  ', true)
            expect('   [ 12, false2, "a"]  ', true)
            expect('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [{}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [}], "a"] }  ', true)
            expect('   [{ "q": [ 12, false, [{}], "a"] }]  ', true)
            expect('   [{ "q": [ 12, false, [}], "a"] }]  ', true)
            expect('. + ++ +=', true)
            expect('//12\n', true)
            expect('/*12*/', true)
            expect('/* 1*2 */', true)
        }
    ],
    djs: [
        () => {
            const result = tokenizeString('')
            assertEq(result, '[{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('{')
            assertEq(result, '[{"kind":"{"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('}')
            assertEq(result, '[{"kind":"}"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString(':')
            assertEq(result, '[{"kind":":"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString(',')
            assertEq(result, '[{"kind":","},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('[')
            assertEq(result, '[{"kind":"["},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString(']')
            assertEq(result, '[{"kind":"]"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('ᄑ')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('{ \t\n\r}')
            assertEq(result, '[{"kind":"{"},{"kind":"nl"},{"kind":"}"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('""')
            assertEq(result, '[{"kind":"string","value":""},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"value"')
            assertEq(result, '[{"kind":"string","value":"value"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"value')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"value1" "value2"')
            assertEq(result, '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\\\"')
            assertEq(result, '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"\\""')
            assertEq(result, '[{"kind":"string","value":"\\""},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"\\/"')
            assertEq(result, '[{"kind":"string","value":"/"},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"\\u1234"')
            assertEq(result, '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"\\uaBcDEeFf"')
            assertEq(result, '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('"\\uEeFg"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('0')
            assertEq(result, '[{"kind":"number","value":"0"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('[0]')
            assertEq(result, '[{"kind":"["},{"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('{90}')
            assertEq(result, '[{"kind":"{"},{"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('1 2')
            assertEq(result, '[{"kind":"number","value":"1"},{"kind":"ws"},{"kind":"number","value":"2"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('0. 2')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('10-0')
            assertEq(result, '[{"kind":"number","value":"10"},{"kind":"-"},{"kind":"number","value":"0"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('9a:')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-10')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"10"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-0')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"0"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-00')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-.123')
            assertEq(result, '[{"kind":"-"},{"kind":"."},{"kind":"number","value":"123"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('0.01')
            assertEq(result, '[{"kind":"number","value":"0.01"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-0.9')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"0.9"},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"number","value":"12.34"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-12.00')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"12.00"},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"number","value":"0e1"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('0e+2')
            assertEq(result, '[{"kind":"number","value":"0e+2"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('0e-0')
            assertEq(result, '[{"kind":"number","value":"0e-0"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('12e0000')
            assertEq(result, '[{"kind":"number","value":"12e0000"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-12e-0001')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"12e-0001"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-12.34e1234')
            assertEq(result, '[{"kind":"-"},{"kind":"number","value":"12.34e1234"},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('{ABCdef1234567890$_}')
            assertEq(result, '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('123 _123')
            assertEq(result, '[{"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('123 $123')
            assertEq(result, '[{"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('123_123')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('123$123')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('1234567890n')
            assertEq(result, '[{"kind":"bigint","value":1234567890n},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('0n')
            assertEq(result, '[{"kind":"bigint","value":0n},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('[-1234567890n]')
            assertEq(result, '[{"kind":"["},{"kind":"-"},{"kind":"bigint","value":1234567890n},{"kind":"]"},{"kind":"eof"}]')
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
    operators:
    [
        () => {
            const result = tokenizeString('=')
            assertEq(result, '[{"kind":"="},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('=a')
            assertEq(result, '[{"kind":"="},{"kind":"id","value":"a"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('-')
            assertEq(result, '[{"kind":"-"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('1*2')
            assertEq(result, '[{"kind":"number","value":"1"},{"kind":"*"},{"kind":"number","value":"2"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('( )')
            assertEq(result, '[{"kind":"("},{"kind":"ws"},{"kind":")"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('== != === !== > >= < <=')
            assertEq(result, '[{"kind":"=="},{"kind":"ws"},{"kind":"!="},{"kind":"ws"},{"kind":"==="},{"kind":"ws"},{"kind":"!=="},{"kind":"ws"},{"kind":">"},{"kind":"ws"},{"kind":">="},{"kind":"ws"},{"kind":"<"},{"kind":"ws"},{"kind":"<="},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('+ - * / % ++ -- **')
            assertEq(result, '[{"kind":"+"},{"kind":"ws"},{"kind":"-"},{"kind":"ws"},{"kind":"*"},{"kind":"ws"},{"kind":"/"},{"kind":"ws"},{"kind":"%"},{"kind":"ws"},{"kind":"++"},{"kind":"ws"},{"kind":"--"},{"kind":"ws"},{"kind":"**"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('= += -= *= /= %= **=')
            assertEq(result, '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('& | ^ ~ << >> >>>')
            assertEq(result, '[{"kind":"&"},{"kind":"ws"},{"kind":"|"},{"kind":"ws"},{"kind":"^"},{"kind":"ws"},{"kind":"~"},{"kind":"ws"},{"kind":"<<"},{"kind":"ws"},{"kind":">>"},{"kind":"ws"},{"kind":">>>"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('&= |= ^= <<= >>= >>>=')
            assertEq(result, '[{"kind":"&="},{"kind":"ws"},{"kind":"|="},{"kind":"ws"},{"kind":"^="},{"kind":"ws"},{"kind":"<<="},{"kind":"ws"},{"kind":">>="},{"kind":"ws"},{"kind":">>>="},{"kind":"eof"}]')
        },
        () => {
            // '<<<' and '<<<=' are not JS operators; maximal munch tokenizes them
            // as '<<' followed by '<' / '<=', matching the old tokenizer's behavior.
            const result = tokenizeString('<<< <<<=')
            assertEq(result, '[{"kind":"<<"},{"kind":"<"},{"kind":"ws"},{"kind":"<<"},{"kind":"<="},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('&& || ! ??')
            assertEq(result, '[{"kind":"&&"},{"kind":"ws"},{"kind":"||"},{"kind":"ws"},{"kind":"!"},{"kind":"ws"},{"kind":"??"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('&&= ||= ??=')
            assertEq(result, '[{"kind":"&&="},{"kind":"ws"},{"kind":"||="},{"kind":"ws"},{"kind":"??="},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('? ?. . =>')
            assertEq(result, '[{"kind":"?"},{"kind":"ws"},{"kind":"?."},{"kind":"ws"},{"kind":"."},{"kind":"ws"},{"kind":"=>"},{"kind":"eof"}]')
        },
    ],
    ws: [
        () => {
            const result = tokenizeString(' ')
            assertEq(result, '[{"kind":"ws"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('\t')
            assertEq(result, '[{"kind":"ws"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString(' \t')
            assertEq(result, '[{"kind":"ws"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('\n')
            assertEq(result, '[{"kind":"nl"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('\r')
            assertEq(result, '[{"kind":"nl"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString(' \t\n\r ')
            assertEq(result, '[{"kind":"nl"},{"kind":"eof"}]')
        },
    ],
    id: [
        () => {
            const result = tokenizeString('err')
            assertEq(result, '[{"kind":"id","value":"err"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('{e}')
            assertEq(result, '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('tru')
            assertEq(result, '[{"kind":"id","value":"tru"},{"kind":"eof"}]')
        },
    ],
    keywords: [
        () => {
            const result = tokenizeString('true')
            assertEq(result, '[{"kind":"true"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('false')
            assertEq(result, '[{"kind":"false"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('null')
            assertEq(result, '[{"kind":"null"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('undefined')
            assertEq(result, '[{"kind":"undefined"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('[null]')
            assertEq(result, '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('arguments')
            assertEq(result, '[{"kind":"arguments"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('await')
            assertEq(result, '[{"kind":"await"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('break')
            assertEq(result, '[{"kind":"break"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('case')
            assertEq(result, '[{"kind":"case"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('catch')
            assertEq(result, '[{"kind":"catch"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('class')
            assertEq(result, '[{"kind":"class"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('const')
            assertEq(result, '[{"kind":"const"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('continue')
            assertEq(result, '[{"kind":"continue"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('debugger')
            assertEq(result, '[{"kind":"debugger"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('default')
            assertEq(result, '[{"kind":"default"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('delete')
            assertEq(result, '[{"kind":"delete"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('do')
            assertEq(result, '[{"kind":"do"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('else')
            assertEq(result, '[{"kind":"else"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('enum')
            assertEq(result, '[{"kind":"enum"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('eval')
            assertEq(result, '[{"kind":"eval"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('export')
            assertEq(result, '[{"kind":"export"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('extends')
            assertEq(result, '[{"kind":"extends"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('finally')
            assertEq(result, '[{"kind":"finally"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('for')
            assertEq(result, '[{"kind":"for"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('function')
            assertEq(result, '[{"kind":"function"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('if')
            assertEq(result, '[{"kind":"if"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('implements')
            assertEq(result, '[{"kind":"implements"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('import')
            assertEq(result, '[{"kind":"import"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('in')
            assertEq(result, '[{"kind":"in"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('instanceof')
            assertEq(result, '[{"kind":"instanceof"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('interface')
            assertEq(result, '[{"kind":"interface"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('let')
            assertEq(result, '[{"kind":"let"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('new')
            assertEq(result, '[{"kind":"new"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('package')
            assertEq(result, '[{"kind":"package"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('private')
            assertEq(result, '[{"kind":"private"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('protected')
            assertEq(result, '[{"kind":"protected"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('public')
            assertEq(result, '[{"kind":"public"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('return')
            assertEq(result, '[{"kind":"return"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('static')
            assertEq(result, '[{"kind":"static"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('super')
            assertEq(result, '[{"kind":"super"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('switch')
            assertEq(result, '[{"kind":"switch"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('this')
            assertEq(result, '[{"kind":"this"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('throw')
            assertEq(result, '[{"kind":"throw"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('try')
            assertEq(result, '[{"kind":"try"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('typeof')
            assertEq(result, '[{"kind":"typeof"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('var')
            assertEq(result, '[{"kind":"var"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('void')
            assertEq(result, '[{"kind":"void"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('while')
            assertEq(result, '[{"kind":"while"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('with')
            assertEq(result, '[{"kind":"with"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('yield')
            assertEq(result, '[{"kind":"yield"},{"kind":"eof"}]')
        },
    ],
    comments: [
        () => {
            const result = tokenizeString('//singleline comment')
            assertEq(result, '[{"kind":"//","value":"singleline comment"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('true//singleline comment\nfalse')
            assertEq(result, '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('/* multiline comment */')
            assertEq(result, '[{"kind":"/*","value":" multiline comment "},{"kind":"eof"}]')
        },
        () => {
            // a `/` inside the body is content: only `*/` ends the comment
            const result = tokenizeString('/* a/b ../../x.ts */')
            assertEq(result, '[{"kind":"/*","value":" a/b ../../x.ts "},{"kind":"eof"}]')
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
            assertEq(result, '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('/* multiline comment *\n * **/')
            assertEq(result, '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"},{"kind":"eof"}]')
        },
        // `'/'` is an `operatorTags` member for division, so a line comment's own
        // slashes must be consumed by the comment rule before the tag reaches
        // `filterFunc`. These pin that: a multi-character line comment stays one
        // token, inner slashes included, and division still tokenizes as an
        // operator.
        () => {
            const result = tokenizeString('//ab\n')
            assertEq(result, '[{"kind":"//","value":"ab"},{"kind":"nl"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('//a//b\n')
            assertEq(result, '[{"kind":"//","value":"a//b"},{"kind":"nl"},{"kind":"eof"}]')
        },
        () => {
            const result = tokenizeString('a/b')
            assertEq(result, '[{"kind":"id","value":"a"},{"kind":"/"},{"kind":"id","value":"b"},{"kind":"eof"}]')
        },
    ],
    metadata: [
        () => {
            const result = toArray(tokenize(stringToList(''))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":1}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('true'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"true"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":5}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('true false'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"true"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"ws"},"metadata":{"path":"a.js","line":1,"column":5}},{"token":{"kind":"false"},"metadata":{"path":"a.js","line":1,"column":6}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":11}}]')
        },
        () => {
            // a lone \n collapses into a single nl token, but line/column still advance
            // correctly for whatever comes after it
            const result = toArray(tokenize(stringToList('a\nb'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"id","value":"a"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":2}},{"token":{"kind":"id","value":"b"},"metadata":{"path":"a.js","line":2,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":2,"column":2}}]')
        },
        () => {
            // two consecutive newlines still collapse into one nl token, but line still
            // advances by two for the token after them
            const result = toArray(tokenize(stringToList('a\n\nb'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"id","value":"a"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":2}},{"token":{"kind":"id","value":"b"},"metadata":{"path":"a.js","line":3,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":3,"column":2}}]')
        },
        () => {
            // position after a multi-line block comment resumes on the comment's closing line
            const result = toArray(tokenize(stringToList('/* c\n */ x'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"/*","value":" c\\n "},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"ws"},"metadata":{"path":"a.js","line":2,"column":4}},{"token":{"kind":"id","value":"x"},"metadata":{"path":"a.js","line":2,"column":5}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":2,"column":6}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('"unterminated'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"error","message":"invalid token","end":{"line":1,"column":14}},"metadata":{"path":"a.js","line":1,"column":1}}]')
        },
        () => {
            // position points at the poisoning trailing char ('0'), not the start of input
            const result = toArray(tokenize(stringToList('00'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"error","message":"invalid number"},"metadata":{"path":"a.js","line":1,"column":2}}]')
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
    // Regression coverage for large inputs: both a file with many short tokens and a
    // single very long token used to overflow the JS call stack, when the matcher
    // recursed once per grammar step. The LL(1) machine runs on an explicit frame
    // stack and the tokenizer resumes it once per token, so a file of any length
    // is a loop, and a token of any length one match.
    largeInputs: [
        () => {
            // many short whitespace tokens: the reported repro (`' '.repeat(5000)`)
            const result = tokenizeString(' '.repeat(5000))
            assertEq(result, '[{"kind":"ws"},{"kind":"eof"}]')
        },
        () => {
            // many distinct short tokens, well past the ~1000-1500 token crash threshold
            // the old whole-file recursive match hit for this shape
            const ids = Array.from({ length: 3000 }, (_, i) => `a${i % 10}`)
            const src = ids.join(' ')
            const result = tokenizeString(src)
            assert(result !== 'error', result)
            // `tokenizeString` runs its own pipeline (`getTokensFromAstRule` +
            // filter/scan + `stringify`), not `tokenize`'s, so only its dump
            // covers it. Compared whole rather than counted: at this size the
            // count was the only thing the old JSON round-trip could check,
            // while the reconstructed literal also pins every token's content.
            assertEq(
                result,
                `[${ids.map(v => `{"kind":"id","value":"${v}"}`).join(',{"kind":"ws"},')},{"kind":"eof"}]`)
            // The token list must agree with the dump: 3000 ids + 2999
            // separating ws + a trailing eof token.
            assertEq(toArray(tokenize(stringToList(src))('a.js')).length, 3000 + 2999 + 1)
        },
        () => {
            // same many-short-tokens shape through the metadata-aware entry point
            const src = 'x '.repeat(3000)
            const result = toArray(tokenize(stringToList(src))('a.js'))
            assertEq(result.length, 3000 * 2 + 1)
        },
        () => {
            // a single long token: a 5 KB string literal — overflows unless the
            // matcher itself is iterative
            const value = 'a'.repeat(5000)
            const result = tokenizeString(`"${value}"`)
            assertEq(result, `[{"kind":"string","value":"${value}"},{"kind":"eof"}]`)
        },
        () => {
            // a single long token via the hand-written recursive multilineContent rule:
            // a 20 KB block comment (the size the pre-grammar tokenizer handled)
            const value = 'x'.repeat(20000)
            const result = tokenizeString(`/*${value}*/`)
            assertEq(result, `[{"kind":"/*","value":"${value}"},{"kind":"eof"}]`)
        },
        () => {
            // a single long identifier (repeat0Plus(idChar) inside one token match)
            const value = 'x'.repeat(10000)
            const result = tokenizeString(value)
            assertEq(result, `[{"kind":"id","value":"${value}"},{"kind":"eof"}]`)
        },
    ],
}
