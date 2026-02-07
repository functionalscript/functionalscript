import { descentParser, type CodePointMeta, type DescentMatch, type DescentMatchResult } from '../../bnf/data/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { jsGrammar } from './module.f.ts'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

export default {
    isValid: [() => {
            const m = descentParser(jsGrammar())
            
            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }
            
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
    parser: [
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
    ]
}