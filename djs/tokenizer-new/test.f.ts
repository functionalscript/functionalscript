import { descentParser, type CodePointMeta, type DescentMatch, type DescentMatchResult } from '../../bnf/data/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { jsGrammar } from './module.f.ts'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

const tokenizeString 
    : (s: string) => string
    = s => {
        const m = descentParser(jsGrammar())
        const cp = toArray(stringToCodePointList(s))
        const mr = descentParserCpOnly(m, '', cp)
        return JSON.stringify(mr)
    }             

export default {
    isValid: [() => {
            const m = descentParser(jsGrammar())
            
            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw JSON.stringify([s, mr])
                }
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
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'id') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('"tr"'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'string') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('56.7e+5'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'number') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('56n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'number') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('*'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '*') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('**'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '**') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('=>'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '=>') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('=='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '==') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('==='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '===') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('='))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '=') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList(' '))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== ' ') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '\n') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('/\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== '/') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('//\n'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'comment') throw JSON.stringify(mr)
        },
        () => {
            const m = descentParser(jsGrammar())
            const cp = toArray(stringToCodePointList('/*1*/'))
            const mr = descentParserCpOnly(m, '', cp)
            const seq = mr[0].sequence[0]
            if (seq instanceof Array) throw JSON.stringify(mr)
            if (seq.tag !== 'comment') throw JSON.stringify(mr)
        }
    ],
    // djs: [
    //     () => {
    //         const result = tokenizeString('')
    //         if (result !== '[{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('{')
    //         if (result !== '[{"kind":"{"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('}')
    //         if (result !== '[{"kind":"}"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString(':')
    //         if (result !== '[{"kind":":"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString(',')
    //         if (result !== '[{"kind":","},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('[')
    //         if (result !== '[{"kind":"["},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString(']')
    //         if (result !== '[{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('ᄑ')
    //         if (result !== '[{"kind":"error","message":"unexpected character"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('{ \t\n\r}')
    //         if (result !== '[{"kind":"{"},{"kind":"nl"},{"kind":"}"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('""')
    //         if (result !== '[{"kind":"string","value":""},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"value"')
    //         if (result !== '[{"kind":"string","value":"value"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"value')
    //         if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"value1" "value2"')
    //         if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"')
    //         if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\\\"')
    //         if (result !== '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\""')
    //         if (result !== '[{"kind":"string","value":"\\""},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\/"')
    //         if (result !== '[{"kind":"string","value":"/"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\x"')
    //         if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\')
    //         if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\r"')
    //         if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\n null')
    //         if (result !== '[{"kind":"error","message":"unterminated string literal"},{"kind":"nl"},{"kind":"null"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\b\\f\\n\\r\\t"')
    //         if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\u1234"')
    //         if (result !== '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\uaBcDEeFf"')
    //         if (result !== '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('"\\uEeFg"')
    //         if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0')
    //         if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('[0]')
    //         if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('00')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0abc,')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"abc"},{"kind":","},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123456789012345678901234567890')
    //         if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('{90}')
    //         if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1 2')
    //         if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0. 2')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('10-0')
    //         if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('9a:')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":":"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-10')
    //         if (result !== '[{"kind":"-"},{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-0')
    //         if (result !== '[{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-00')
    //         if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-.123')
    //         if (result !== '[{"kind":"-"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0.01')
    //         if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-0.9')
    //         if (result !== '[{"kind":"-"},{"bf":[9n,-1],"kind":"number","value":"0.9"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-0.')
    //         if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-0.]')
    //         if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('12.34')
    //         if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-12.00')
    //         if (result !== '[{"kind":"-"},{"bf":[1200n,-2],"kind":"number","value":"12.00"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-12.')
    //         if (result !== '[{"kind":"-"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('12.]')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e1')
    //         if (result !== '[{"bf":[0n,1],"kind":"number","value":"0e1"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e+2')
    //         if (result !== '[{"bf":[0n,2],"kind":"number","value":"0e+2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e-0')
    //         if (result !== '[{"bf":[0n,0],"kind":"number","value":"0e-0"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('12e0000')
    //         if (result !== '[{"bf":[12n,0],"kind":"number","value":"12e0000"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-12e-0001')
    //         if (result !== '[{"kind":"-"},{"bf":[12n,-1],"kind":"number","value":"12e-0001"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-12.34e1234')
    //         if (result !== '[{"kind":"-"},{"bf":[1234n,1232],"kind":"number","value":"12.34e1234"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e-')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('ABCdef1234567890$_')
    //         if (result !== '[{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('{ABCdef1234567890$_}')
    //         if (result !== '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123 _123')
    //         if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123 $123')
    //         if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123_123')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123$123')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1234567890n')
    //         if (result !== '[{"kind":"bigint","value":1234567890n},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0n')
    //         if (result !== '[{"kind":"bigint","value":0n},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('[-1234567890n]')
    //         if (result !== '[{"kind":"["},{"kind":"-"},{"kind":"bigint","value":1234567890n},{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123.456n')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123e456n')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1234567890na')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1234567890nn')
    //         if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
    // operators:
    // [
    //     () => {
    //         const result = tokenizeString('=')
    //         if (result !== '[{"kind":"="},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('=a')
    //         if (result !== '[{"kind":"="},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-')
    //         if (result !== '[{"kind":"-"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1*2')
    //         if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"*"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('( )')
    //         if (result !== '[{"kind":"("},{"kind":"ws"},{"kind":")"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('== != === !== > >= < <=')
    //         if (result !== '[{"kind":"=="},{"kind":"ws"},{"kind":"!="},{"kind":"ws"},{"kind":"==="},{"kind":"ws"},{"kind":"!=="},{"kind":"ws"},{"kind":">"},{"kind":"ws"},{"kind":">="},{"kind":"ws"},{"kind":"<"},{"kind":"ws"},{"kind":"<="},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('+ - * / % ++ -- **')
    //         if (result !== '[{"kind":"+"},{"kind":"ws"},{"kind":"-"},{"kind":"ws"},{"kind":"*"},{"kind":"ws"},{"kind":"/"},{"kind":"ws"},{"kind":"%"},{"kind":"ws"},{"kind":"++"},{"kind":"ws"},{"kind":"--"},{"kind":"ws"},{"kind":"**"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('= += -= *= /= %= **=')
    //         if (result !== '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('& | ^ ~ << >> >>>')
    //         if (result !== '[{"kind":"&"},{"kind":"ws"},{"kind":"|"},{"kind":"ws"},{"kind":"^"},{"kind":"ws"},{"kind":"~"},{"kind":"ws"},{"kind":"<<"},{"kind":"ws"},{"kind":">>"},{"kind":"ws"},{"kind":">>>"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('&= |= ^= <<= >>= >>>=')
    //         if (result !== '[{"kind":"&="},{"kind":"ws"},{"kind":"|="},{"kind":"ws"},{"kind":"^="},{"kind":"ws"},{"kind":"<<="},{"kind":"ws"},{"kind":">>="},{"kind":"ws"},{"kind":">>>="},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('&& || ! ??')
    //         if (result !== '[{"kind":"&&"},{"kind":"ws"},{"kind":"||"},{"kind":"ws"},{"kind":"!"},{"kind":"ws"},{"kind":"??"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('&&= ||= ??=')
    //         if (result !== '[{"kind":"&&="},{"kind":"ws"},{"kind":"||="},{"kind":"ws"},{"kind":"??="},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('? ?. . =>')
    //         if (result !== '[{"kind":"?"},{"kind":"ws"},{"kind":"?."},{"kind":"ws"},{"kind":"."},{"kind":"ws"},{"kind":"=>"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
    // ws: [
    //     () => {
    //         const result = tokenizeString(' ')
    //         if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('\t')
    //         if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString(' \t')
    //         if (result !== '[{"kind":"ws"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('\n')
    //         if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('\r')
    //         if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString(' \t\n\r ')
    //         if (result !== '[{"kind":"nl"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
    // id: [
    //     () => {
    //         const result = tokenizeString('err')
    //         if (result !== '[{"kind":"id","value":"err"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('{e}')
    //         if (result !== '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('tru')
    //         if (result !== '[{"kind":"id","value":"tru"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
    // keywords: [
    //     () => {
    //         const result = tokenizeString('true')
    //         if (result !== '[{"kind":"true"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('false')
    //         if (result !== '[{"kind":"false"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('null')
    //         if (result !== '[{"kind":"null"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('undefined')
    //         if (result !== '[{"kind":"undefined"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('[null]')
    //         if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('arguments')
    //         if (result !== '[{"kind":"arguments"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('await')
    //         if (result !== '[{"kind":"await"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('break')
    //         if (result !== '[{"kind":"break"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('case')
    //         if (result !== '[{"kind":"case"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('catch')
    //         if (result !== '[{"kind":"catch"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('class')
    //         if (result !== '[{"kind":"class"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('const')
    //         if (result !== '[{"kind":"const"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('continue')
    //         if (result !== '[{"kind":"continue"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('debugger')
    //         if (result !== '[{"kind":"debugger"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('default')
    //         if (result !== '[{"kind":"default"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('delete')
    //         if (result !== '[{"kind":"delete"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('do')
    //         if (result !== '[{"kind":"do"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('else')
    //         if (result !== '[{"kind":"else"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('enum')
    //         if (result !== '[{"kind":"enum"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('eval')
    //         if (result !== '[{"kind":"eval"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('export')
    //         if (result !== '[{"kind":"export"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('extends')
    //         if (result !== '[{"kind":"extends"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('finally')
    //         if (result !== '[{"kind":"finally"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('for')
    //         if (result !== '[{"kind":"for"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('function')
    //         if (result !== '[{"kind":"function"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('if')
    //         if (result !== '[{"kind":"if"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('implements')
    //         if (result !== '[{"kind":"implements"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('import')
    //         if (result !== '[{"kind":"import"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('in')
    //         if (result !== '[{"kind":"in"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('instanceof')
    //         if (result !== '[{"kind":"instanceof"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('interface')
    //         if (result !== '[{"kind":"interface"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('let')
    //         if (result !== '[{"kind":"let"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('new')
    //         if (result !== '[{"kind":"new"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('package')
    //         if (result !== '[{"kind":"package"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('private')
    //         if (result !== '[{"kind":"private"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('protected')
    //         if (result !== '[{"kind":"protected"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('public')
    //         if (result !== '[{"kind":"public"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('return')
    //         if (result !== '[{"kind":"return"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('static')
    //         if (result !== '[{"kind":"static"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('super')
    //         if (result !== '[{"kind":"super"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('switch')
    //         if (result !== '[{"kind":"switch"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('this')
    //         if (result !== '[{"kind":"this"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('throw')
    //         if (result !== '[{"kind":"throw"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('try')
    //         if (result !== '[{"kind":"try"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('typeof')
    //         if (result !== '[{"kind":"typeof"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('var')
    //         if (result !== '[{"kind":"var"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('void')
    //         if (result !== '[{"kind":"void"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('while')
    //         if (result !== '[{"kind":"while"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('with')
    //         if (result !== '[{"kind":"with"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('yield')
    //         if (result !== '[{"kind":"yield"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
    // comments: [
    //     () => {
    //         const result = tokenizeString('//singleline comment')
    //         if (result !== '[{"kind":"//","value":"singleline comment"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('true//singleline comment\nfalse')
    //         if (result !== '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment */')
    //         if (result !== '[{"kind":"/*","value":" multiline comment "},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment *')
    //         if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment ')
    //         if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment \n * **/')
    //         if (result !== '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment *\n * **/')
    //         if (result !== '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
    //     },
    // ],
}