import { descentParser, type AstRuleMeta, type AstSequence, type AstSequenceMeta, type AstTag, type CodePointMeta, type DescentMatch, type DescentMatchResult } from '../../bnf/data/module.f.ts'
import type { JsToken } from '../../js/tokenizer/module.f.ts'
import {
    backspace, ht, lf, ff, cr,
    quotationMark, solidus, reverseSolidus,
    digitRange, digit0,
    latinCapitalLetterA,
    latinSmallLetterA, latinSmallLetterB, latinSmallLetterF,
    latinSmallLetterN, latinSmallLetterR, latinSmallLetterT, latinSmallLetterU,
    range,
} from '../../text/ascii/module.f.ts'
import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import type { StateScan } from '../../types/function/operator/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import { concat, filter, flat, flatMap, map, stateScan, toArray, type List } from '../../types/list/module.f.ts'
import { jsGrammar, parse } from './module.f.ts'

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
        const [ast, ok, len] = descentParserCpOnly(m, '', cp)
        if (cp.length === 0) {
            return JSON.stringify([{kind: 'eof'}])
        }
        if (!ok)
            return 'error'
        if (cp.length > 0 && len !== cp.length)
            return 'error'

        const flatTokens = getTokensFromAstRule(ast)
        const filterTokens = concat(filter(filterFunc)(flatTokens))([''])
        const tokens = flat(stateScan(scanFunc)(['', []])(filterTokens))
        const jsTokens = concat(map(toJsToken)(tokens))([{kind: 'eof'}])
        const result = toArray(filter(v => v !== null)(jsTokens))
        //return JSON.stringify(toArray(filterTokens))
        return JSON.stringify(result)
    }

type Token = [string, readonly number[]]

type FlatToken = string | number

type TokenScanState = [string, List<number>]

const isNlTag = (tag: string): boolean => tag === '\n' || tag === '\r'
const isWsTag = (tag: string): boolean => tag === ' ' || tag === '\t'

const scanFunc
    : StateScan<FlatToken, TokenScanState, List<Token>>
    = (input, state) => {
        if (typeof input === 'string') {
            if (isNlTag(input) && isNlTag(state[0])) return [null, state]
            if (isWsTag(input) && isWsTag(state[0])) return [null, state]
            if (isNlTag(input) && isWsTag(state[0])) return [null, [input, []]]
            const newState: TokenScanState = [input, []]
            if (state[0] === '') {
                return [null, newState]
            }
            const tk: Token = [state[0], toArray(state[1])]
            return [[tk], newState]
        }
        return [null, [state[0], concat(state[1])([input])]]
    }

// All operator tag strings produced by the grammar's operator rule
const operatorTags = new Set<string>([
    '.', '=>', '===', '==', '=', '!==', '!=', '!',
    '>>>=', '>>>', '>>=', '>>', '>=', '>',
    '<<<=', '<<<', '<<=', '<<', '<=', '<',
    '+=', '++', '+', '-=', '--', '-',
    '**=', '**', '*=', '*', '/=', '/', '%=', '%',
    '&&=', '&&', '&=', '&', '||=', '||', '|=', '|',
    '^=', '^', '~', '??=', '??', '?.', '?',
    '[', ']', '{', '}', '(', ')', ',', ':'
])

const filterFunc
    : (tk: FlatToken) => boolean
    = tk => {
        if (typeof tk === 'number')
            return true
        switch(tk) {
            case 'number':
            case 'string':
            case '\n':
            case '\r':
            case ' ':
            case '\t':
                return true
            default:
                return operatorTags.has(tk)
        }
    }

const rangeCapitalAF = range('AF')

type StringDecodeState =
    | { readonly kind: 'normal' }
    | { readonly kind: 'escape' }
    | { readonly kind: 'unicode', readonly acc: number, readonly count: number }

const stringDecodeScan
    : StateScan<number, StringDecodeState, List<number>>
    = (cp, state) => {
        switch (state.kind) {
            case 'escape':
                switch (cp) {
                    case quotationMark:  return [[quotationMark],  { kind: 'normal' }]  // \" → "
                    case reverseSolidus: return [[reverseSolidus], { kind: 'normal' }]  // \\ → \
                    case solidus:        return [[solidus],        { kind: 'normal' }]  // \/ → /
                    case latinSmallLetterB: return [[backspace], { kind: 'normal' }]    // \b → backspace (BS)
                    case latinSmallLetterF: return [[ff],        { kind: 'normal' }]    // \f → form feed (FF)
                    case latinSmallLetterN: return [[lf],        { kind: 'normal' }]    // \n → line feed (LF)
                    case latinSmallLetterR: return [[cr],        { kind: 'normal' }]    // \r → carriage return (CR)
                    case latinSmallLetterT: return [[ht],        { kind: 'normal' }]    // \t → horizontal tab (HT)
                    case latinSmallLetterU: return [null, { kind: 'unicode', acc: 0, count: 0 }]  // \u → start 4 hex digits
                    default:  return [[cp], { kind: 'normal' }]
                }
            case 'unicode': {
                // convert hex digit char to its numeric value: '0'-'9', 'A'-'F', 'a'-'f'
                const digit = contains(digitRange)(cp) ? cp - digit0
                    : contains(rangeCapitalAF)(cp) ? cp - (latinCapitalLetterA - 10)
                    : cp - (latinSmallLetterA - 10)
                const acc = (state.acc << 4) | digit
                return state.count === 3 ? [[acc], { kind: 'normal' }] : [null, { kind: 'unicode', acc, count: state.count + 1 }]
            }
            default:
                return cp === reverseSolidus ? [null, { kind: 'escape' }] : [[cp], { kind: 'normal' }]
        }
    }

const decodeJsonString
    : (codePoints: readonly number[]) => string
    = codePoints => String.fromCodePoint(...toArray(flat(stateScan(stringDecodeScan)({ kind: 'normal' })(codePoints.slice(1, -1)))))

const toJsToken
    : (tk: Token) => JsToken | null
    = tk => {
        switch(tk[0]) {
            case '\n':
            case '\r':
                return {kind: 'nl'}
            case ' ':
            case '\t':
                return {kind: 'ws'}
            case 'string':
                return {kind: 'string', value: decodeJsonString(tk[1])}
            default:
                return {kind: tk[0]} as JsToken
        }
    }

const getTokensFromAstRuleOrCodePoint
    : (value: AstRuleMeta<unknown>|CodePointMeta<unknown>) => List<FlatToken>
    = value => {
        if (value instanceof Array)
            return [value[0]]

        return getTokensFromAstRule(value)
    }

const getTokensFromAstSequence
    : (seq: AstSequenceMeta<unknown>) => List<FlatToken>
    = seq => {
        return flatMap(getTokensFromAstRuleOrCodePoint)(seq)
    }

const tagToToken
    : (tag: AstTag) => FlatToken
    = tag => {
        switch (typeof tag) {
            case 'string': return tag
            case 'undefined': return 'undefined'
            default: return 'true'
        }
    }

const getTokensFromAstRule
    : (ast: AstRuleMeta<unknown>) => List<FlatToken>
    = ast => {
        const token = tagToToken(ast.tag)
        if (ast.sequence.length === 0)
            return [token]

        return { first: token, tail: getTokensFromAstSequence(ast.sequence)}
    }


export const proof = {
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
            if (result !== 'error') { throw result }
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
            if (result !== 'error') { throw result }
        },
        () => {
            const result = tokenizeString('"value1" "value2"')
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = tokenizeString('"')
            if (result !== 'error') { throw result }
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
            if (result !== 'error') { throw result }
        },
        () => {
            const result = tokenizeString('"\\')
            if (result !== 'error') { throw result }
        },
        () => {
            const result = tokenizeString('"\r"')
            if (result !== 'error') { throw result }
        },
        () => {
            const result = tokenizeString('"\n null')
            if (result !== 'error') { throw result }
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
            if (result !== 'error') { throw result }
        },
    //     () => {
    //         const result = tokenizeString('0')
    //         if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
    //     },
        // () => {
        //     const result = tokenizeString('[0]')
        //     if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        // },
        // () => {
        //     const result = tokenizeString('00')
        //     if (result !== 'error') { throw result }
        // },
        // () => {
        //     const result = tokenizeString('0abc,')
        //     if (result !== 'error') { throw result }
        // },
    //     () => {
    //         const result = tokenizeString('123456789012345678901234567890')
    //         if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
    //     },
        // () => {
        //     const result = tokenizeString('{90}')
        //     if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        // },
    //     () => {
    //         const result = tokenizeString('1 2')
    //         if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0. 2')
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('10-0')
    //         if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"kind":"-"},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('9a:')
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('-0.]')
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('12.]')
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('0e-')
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123$123')
    //         if (result !== 'error') { throw result }
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('123e456n')
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1234567890na')
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('1234567890nn')
    //         if (result !== 'error') { throw result }
    //     },
    ],
    operators:
    [
        () => {
            const result = tokenizeString('=')
            if (result !== '[{"kind":"="},{"kind":"eof"}]') { throw result }
        },
    //     () => {
    //         const result = tokenizeString('=a')
    //         if (result !== '[{"kind":"="},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
    //     },
        () => {
            const result = tokenizeString('-')
            if (result !== '[{"kind":"-"},{"kind":"eof"}]') { throw result }
        },
    //     () => {
    //         const result = tokenizeString('1*2')
    //         if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"*"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
    //     },
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
        // () => {
        //     const result = tokenizeString('= += -= *= /= %= **=')
        //     if (result !== '[{"kind":"="},{"kind":"ws"},{"kind":"+="},{"kind":"ws"},{"kind":"-="},{"kind":"ws"},{"kind":"*="},{"kind":"ws"},{"kind":"/="},{"kind":"ws"},{"kind":"%="},{"kind":"ws"},{"kind":"**="},{"kind":"eof"}]') { throw result }
        // },
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
    ],
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
    throw: {
        parse: () => { parse('') }
    },
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
    //         if (result !== 'error') { throw result }
    //     },
    //     () => {
    //         const result = tokenizeString('/* multiline comment ')
    //         if (result !== 'error') { throw result }
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
