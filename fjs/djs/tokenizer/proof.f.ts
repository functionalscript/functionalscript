import { descentParser } from '../../bnf/descent/module.f.ts'
import { stringToCodePointList, stringToList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { jsGrammar, tokenizeString, descentParserCpOnly, tokenizeJs, tokenize } from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import type { Unknown } from '../module.f.ts'

// DjsTokenWithMetadata carries bigint fields (bf, bigint value) that JSON.stringify can't
// serialize — reuse the same djs stringifyAsTree serializer tokenizeString uses internally.
const stringify = stringifyAsTree(sort)

export const proof = {
    isValid: [() => {
            const m = descentParser(jsGrammar())

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                assertEq(success, expected, JSON.stringify([s, mr]))
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
    tokenizer: [
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('tr'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'id', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('"tr"'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'string', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('56.7e+5'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'number', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('56n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'number', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('*'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '*', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('**'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '**', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('=>'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '=>', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('=='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assert(!(seq.tag !== '=='), JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('==='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assert(!(seq.tag !== '==='), JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '=', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList(' '))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, ' ', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '\n', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('/\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, '/', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('//\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'comment', JSON.stringify(mr))
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('/*1*/'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            assert(!(seq instanceof Array), JSON.stringify(mr))
            assertEq(seq.tag, 'comment', JSON.stringify(mr))
        }
    ],
    djs: [
        () => {
            const result = tokenizeString('')
            if (result !== '[{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('{')
            if (result !== '[{"kind":"{"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('}')
            if (result !== '[{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString(':')
            if (result !== '[{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString(',')
            if (result !== '[{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('[')
            if (result !== '[{"kind":"["},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString(']')
            if (result !== '[{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('ᄑ')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('{ \t\n\r}')
            if (result !== '[{"kind":"{"},{"kind":"nl"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('""')
            if (result !== '[{"kind":"string","value":""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"value"')
            if (result !== '[{"kind":"string","value":"value"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"value')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"value1" "value2"')
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('"\\\\"')
            if (result !== '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"\\""')
            if (result !== '[{"kind":"string","value":"\\""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"\\/"')
            if (result !== '[{"kind":"string","value":"/"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"\\u1234"')
            if (result !== '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"\\uaBcDEeFf"')
            if (result !== '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"\\uEeFg"')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('0')
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('[0]')
            if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('{90}')
            if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('1 2')
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('0. 2')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('10-0')
            if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('9a:')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-10')
            if (result !== '[{"kind":"-"},{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-0')
            if (result !== '[{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-00')
            assertEq(result, 'error')
        },
        () => {
            const result = tokenizeString('-.123')
            if (result !== '[{"kind":"-"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('0.01')
            if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-0.9')
            if (result !== '[{"kind":"-"},{"bf":[9n,-1],"kind":"number","value":"0.9"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-12.00')
            if (result !== '[{"kind":"-"},{"bf":[1200n,-2],"kind":"number","value":"12.00"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"bf":[0n,1],"kind":"number","value":"0e1"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('0e+2')
            if (result !== '[{"bf":[0n,2],"kind":"number","value":"0e+2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('0e-0')
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0e-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('12e0000')
            if (result !== '[{"bf":[12n,0],"kind":"number","value":"12e0000"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-12e-0001')
            if (result !== '[{"kind":"-"},{"bf":[12n,-1],"kind":"number","value":"12e-0001"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-12.34e1234')
            if (result !== '[{"kind":"-"},{"bf":[1234n,1232],"kind":"number","value":"12.34e1234"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('{ABCdef1234567890$_}')
            if (result !== '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('123 _123')
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('123 $123')
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"kind":"bigint","value":1234567890n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('0n')
            if (result !== '[{"kind":"bigint","value":0n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('[-1234567890n]')
            if (result !== '[{"kind":"["},{"kind":"-"},{"kind":"bigint","value":1234567890n},{"kind":"]"},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"kind":"="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('=a')
            if (result !== '[{"kind":"="},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('-')
            if (result !== '[{"kind":"-"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('1*2')
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"*"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('( )')
            if (result !== '[{"kind":"("},{"kind":"ws"},{"kind":")"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('== != === !== > >= < <=')
            if (result !== '[{"kind":"=="},{"kind":"ws"},{"kind":"!="},{"kind":"ws"},{"kind":"==="},{"kind":"ws"},{"kind":"!=="},{"kind":"ws"},{"kind":">"},{"kind":"ws"},{"kind":">="},{"kind":"ws"},{"kind":"<"},{"kind":"ws"},{"kind":"<="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('+ - * / % ++ -- **')
            if (result !== '[{"kind":"+"},{"kind":"ws"},{"kind":"-"},{"kind":"ws"},{"kind":"*"},{"kind":"ws"},{"kind":"/"},{"kind":"ws"},{"kind":"%"},{"kind":"ws"},{"kind":"++"},{"kind":"ws"},{"kind":"--"},{"kind":"ws"},{"kind":"**"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('= += -= *= /= %= **=')
            if (result !== '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('& | ^ ~ << >> >>>')
            if (result !== '[{"kind":"&"},{"kind":"ws"},{"kind":"|"},{"kind":"ws"},{"kind":"^"},{"kind":"ws"},{"kind":"~"},{"kind":"ws"},{"kind":"<<"},{"kind":"ws"},{"kind":">>"},{"kind":"ws"},{"kind":">>>"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('&= |= ^= <<= >>= >>>=')
            if (result !== '[{"kind":"&="},{"kind":"ws"},{"kind":"|="},{"kind":"ws"},{"kind":"^="},{"kind":"ws"},{"kind":"<<="},{"kind":"ws"},{"kind":">>="},{"kind":"ws"},{"kind":">>>="},{"kind":"eof"}]') { throw result }
        },
        () => {
            // '<<<' and '<<<=' are not JS operators; maximal munch tokenizes them
            // as '<<' followed by '<' / '<=', matching the old tokenizer's behavior.
            const result = tokenizeString('<<< <<<=')
            if (result !== '[{"kind":"<<"},{"kind":"<"},{"kind":"ws"},{"kind":"<<"},{"kind":"<="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('&& || ! ??')
            if (result !== '[{"kind":"&&"},{"kind":"ws"},{"kind":"||"},{"kind":"ws"},{"kind":"!"},{"kind":"ws"},{"kind":"??"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('&&= ||= ??=')
            if (result !== '[{"kind":"&&="},{"kind":"ws"},{"kind":"||="},{"kind":"ws"},{"kind":"??="},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('? ?. . =>')
            if (result !== '[{"kind":"?"},{"kind":"ws"},{"kind":"?."},{"kind":"ws"},{"kind":"."},{"kind":"ws"},{"kind":"=>"},{"kind":"eof"}]') { throw result }
        },
    ],
    ws: [
        () => {
            const result = tokenizeString(' ')
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('\t')
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString(' \t')
            if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('\n')
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('\r')
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString(' \t\n\r ')
            if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
    ],
    id: [
        () => {
            const result = tokenizeString('err')
            if (result !== '[{"kind":"id","value":"err"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('{e}')
            if (result !== '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('tru')
            if (result !== '[{"kind":"id","value":"tru"},{"kind":"eof"}]') { throw result }
        },
    ],
    keywords: [
        () => {
            const result = tokenizeString('true')
            if (result !== '[{"kind":"true"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('false')
            if (result !== '[{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('null')
            if (result !== '[{"kind":"null"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('undefined')
            if (result !== '[{"kind":"undefined"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('[null]')
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('arguments')
            if (result !== '[{"kind":"arguments"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('await')
            if (result !== '[{"kind":"await"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('break')
            if (result !== '[{"kind":"break"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('case')
            if (result !== '[{"kind":"case"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('catch')
            if (result !== '[{"kind":"catch"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('class')
            if (result !== '[{"kind":"class"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('const')
            if (result !== '[{"kind":"const"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('continue')
            if (result !== '[{"kind":"continue"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('debugger')
            if (result !== '[{"kind":"debugger"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('default')
            if (result !== '[{"kind":"default"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('delete')
            if (result !== '[{"kind":"delete"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('do')
            if (result !== '[{"kind":"do"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('else')
            if (result !== '[{"kind":"else"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('enum')
            if (result !== '[{"kind":"enum"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('eval')
            if (result !== '[{"kind":"eval"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('export')
            if (result !== '[{"kind":"export"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('extends')
            if (result !== '[{"kind":"extends"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('finally')
            if (result !== '[{"kind":"finally"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('for')
            if (result !== '[{"kind":"for"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('function')
            if (result !== '[{"kind":"function"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('if')
            if (result !== '[{"kind":"if"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('implements')
            if (result !== '[{"kind":"implements"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('import')
            if (result !== '[{"kind":"import"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('in')
            if (result !== '[{"kind":"in"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('instanceof')
            if (result !== '[{"kind":"instanceof"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('interface')
            if (result !== '[{"kind":"interface"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('let')
            if (result !== '[{"kind":"let"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('new')
            if (result !== '[{"kind":"new"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('package')
            if (result !== '[{"kind":"package"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('private')
            if (result !== '[{"kind":"private"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('protected')
            if (result !== '[{"kind":"protected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('public')
            if (result !== '[{"kind":"public"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('return')
            if (result !== '[{"kind":"return"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('static')
            if (result !== '[{"kind":"static"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('super')
            if (result !== '[{"kind":"super"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('switch')
            if (result !== '[{"kind":"switch"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('this')
            if (result !== '[{"kind":"this"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('throw')
            if (result !== '[{"kind":"throw"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('try')
            if (result !== '[{"kind":"try"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('typeof')
            if (result !== '[{"kind":"typeof"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('var')
            if (result !== '[{"kind":"var"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('void')
            if (result !== '[{"kind":"void"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('while')
            if (result !== '[{"kind":"while"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('with')
            if (result !== '[{"kind":"with"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('yield')
            if (result !== '[{"kind":"yield"},{"kind":"eof"}]') { throw result }
        },
    ],
    comments: [
        () => {
            const result = tokenizeString('//singleline comment')
            if (result !== '[{"kind":"//","value":"singleline comment"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('true//singleline comment\nfalse')
            if (result !== '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('/* multiline comment */')
            if (result !== '[{"kind":"/*","value":" multiline comment "},{"kind":"eof"}]') { throw result }
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
            if (result !== '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('/* multiline comment *\n * **/')
            if (result !== '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
    ],
    metadata: [
        () => {
            const result = toArray(tokenizeJs(stringToList(''))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":1}}]')
        },
        () => {
            const result = toArray(tokenizeJs(stringToList('true'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"true"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":5}}]')
        },
        () => {
            const result = toArray(tokenizeJs(stringToList('true false'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"true"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"ws"},"metadata":{"path":"a.js","line":1,"column":5}},{"token":{"kind":"false"},"metadata":{"path":"a.js","line":1,"column":6}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":1,"column":11}}]')
        },
        () => {
            // a lone \n collapses into a single nl token, but line/column still advance
            // correctly for whatever comes after it
            const result = toArray(tokenizeJs(stringToList('a\nb'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"id","value":"a"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":2}},{"token":{"kind":"id","value":"b"},"metadata":{"path":"a.js","line":2,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":2,"column":2}}]')
        },
        () => {
            // two consecutive newlines still collapse into one nl token, but line still
            // advances by two for the token after them
            const result = toArray(tokenizeJs(stringToList('a\n\nb'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"id","value":"a"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":2}},{"token":{"kind":"id","value":"b"},"metadata":{"path":"a.js","line":3,"column":1}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":3,"column":2}}]')
        },
        () => {
            // position after a multi-line block comment resumes on the comment's closing line
            const result = toArray(tokenizeJs(stringToList('/* c\n */ x'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"/*","value":" c\\n "},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"nl"},"metadata":{"path":"a.js","line":1,"column":1}},{"token":{"kind":"ws"},"metadata":{"path":"a.js","line":2,"column":4}},{"token":{"kind":"id","value":"x"},"metadata":{"path":"a.js","line":2,"column":5}},{"token":{"kind":"eof"},"metadata":{"path":"a.js","line":2,"column":6}}]')
        },
        () => {
            const result = toArray(tokenizeJs(stringToList('"unterminated'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"error","message":"invalid token"},"metadata":{"path":"a.js","line":1,"column":1}}]')
        },
        () => {
            // position points at the poisoning trailing char ('0'), not the start of input
            const result = toArray(tokenizeJs(stringToList('00'))('a.js'))
            assertEq(JSON.stringify(result), '[{"token":{"kind":"error","message":"invalid token"},"metadata":{"path":"a.js","line":1,"column":2}}]')
        },
    ],
    // DJS-level: keyword remapping and '-'-folding on top of tokenizeJs. Doesn't re-test
    // JS-level token shapes already covered above/elsewhere in this file.
    djsTokenize: [
        () => {
            // keywords other than true/false/null/undefined become plain ids
            const result = toArray(tokenize(stringToList('break'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"id","value":"break"}},{"metadata":{"column":6,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-10'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"bf":[-10n,0],"kind":"number","value":"-10"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-0'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"bf":[0n,0],"kind":"number","value":"-0"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('-1234567890n'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"bigint","value":-1234567890n}},{"metadata":{"column":13,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // '-' followed by '-': one error, stays in minus-state waiting for what follows
            const result = toArray(tokenize(stringToList('--'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('---'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":4,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // dangling '-' at eof
            const result = toArray(tokenize(stringToList('-'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            const result = toArray(tokenize(stringToList('[-1234567890n]'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":1,"line":1,"path":""},"token":{"kind":"["}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"bigint","value":-1234567890n}},{"metadata":{"column":14,"line":1,"path":""},"token":{"kind":"]"}},{"metadata":{"column":15,"line":1,"path":""},"token":{"kind":"eof"}}]')
        },
        () => {
            // grammar-level tokenizer error position flows through the DJS wrapper unchanged
            const result = toArray(tokenize(stringToList('00'))(''))
            assertEq(stringify(result as Unknown), '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}}]')
        },
    ],
    // Regression coverage for large inputs: both a file with many short tokens and a
    // single very long token used to overflow the JS call stack, because fjs/bnf/descent's
    // matcher recursed once per grammar step. It now runs on an explicit frame stack, so
    // the whole-file jsGrammar() match is safe at any input length.
    largeInputs: [
        () => {
            // many short whitespace tokens: the reported repro (`' '.repeat(5000)`)
            const result = tokenizeString(' '.repeat(5000))
            assertEq(result, '[{"kind":"ws"},{"kind":"eof"}]')
        },
        () => {
            // many distinct short tokens, well past the ~1000-1500 token crash threshold
            // the old whole-file recursive match hit for this shape
            const src = Array.from({ length: 3000 }, (_, i) => `a${i % 10}`).join(' ')
            const result = tokenizeString(src)
            assert(result !== 'error', result)
            const parsed = JSON.parse(result)
            // 3000 ids + 2999 separating ws + a trailing eof token
            assertEq(parsed.length, 3000 + 2999 + 1)
        },
        () => {
            // same many-short-tokens shape through the metadata-aware entry point
            const src = 'x '.repeat(3000)
            const result = toArray(tokenizeJs(stringToList(src))('a.js'))
            assertEq(result.length, 3000 * 2 + 1)
        },
        () => {
            // a single long token: a 5 KB string literal — overflows unless the descent
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
