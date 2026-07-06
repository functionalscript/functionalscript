import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { commaJoin0Plus, fullRange, option, range, repeat0Plus, set } from '../module.f.ts'
import { deterministic } from '../testlib.f.ts'
import { toData } from '../data/module.f.ts'
import { createEmptyTagMap, descentParser, type DescentMatch, type CodePointMeta, type DescentMatchResult } from './module.f.ts'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

const end = {
    end: '*/',
    cont: () => [fullRange, end] as const,
} as const

const code = {
    comment: [`/*`, end],
    commentError: ['/*', repeat0Plus(fullRange)],
    div: '/',
    mul: '*',
} as const

// A tokenizer applies `code` over and over, each call consuming exactly one token
// (a single '/', a single '*', or a whole comment) starting from where the
// previous call left off.
const tokenize = (s: string): readonly string[] => {
    const m = descentParser(code)
    const cpm = toArray(map(mapCodePoint)(toArray(stringToCodePointList(s))))
    const tags: string[] = []
    let idx = 0
    while (idx < cpm.length) {
        const [ast, success, consumed] = m('', cpm.slice(idx))
        if (!success || consumed === 0) {
            throw `tokenizer stuck at index ${idx} for ${JSON.stringify(s)}`
        }
        tags.push(String(ast.tag))
        idx += consumed
    }
    return tags
}

export const proof = {
    emptyTags: [
        () => {
            const stringRule = 'true'
            const data = toData(stringRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"":false}') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"":false}') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const data = toData(varintRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":false,"6":false,"7":false,"8":false,"9":false,"":false}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"":true}') { throw result }
        },
        () => {
            const emptyRule = ''
            const varintRule = { true: 'true', e: emptyRule}
            const data = toData(varintRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":true,"":"e"}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const data = toData(repeatRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":"none","1":false,"2":false,"3":true,"r":"none","":true}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const data = toData(repeatRule)
            const emptyTags = createEmptyTagMap(data)
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":false,"1":false,"2":false,"3":false,"4":false,"5":true,"r":"none","":true}') { throw result }
        }
    ],
    descentParser: [
        () => {
            const emptyRule = ''
            const m = descentParser(emptyRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const m = descentParser(emptyRule)
            const mr = descentParserCpOnly(m, "", [65, 70])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,0]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr = descentParserCpOnly(m, "", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[[65,null]]},true,1]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr =descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"a","sequence":[[65,null]]},true,1]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
             const m = descentParser(variantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,0]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", [65,66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"sequence":[[65,null]]},{"sequence":[[66,null]]}]},true,2]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", [65,67])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", [50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"none","sequence":[]},{"sequence":[[50,null]]}]},true,1]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", [45,50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"minus","sequence":[[45,null]]},{"sequence":[[50,null]]}]},true,2]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,0]') { throw result }
        },
        () => {
            const m = descentParser(option('a'))

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }

            expect('a', true)
            expect('', true)
            expect('aa', false)
            expect('b', false)
        },
        () => {
            const ws = repeat0Plus(set(' \n\r\t'))

            const cj = commaJoin0Plus(ws)

            const value = () => ({
                object: cj('{}', 'a'),
                array: cj('[]', 'a')
            })

            value.name //bun will fail if no usage of name found

            const m = descentParser(value)

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, 'value', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }

            expect('', false)
            expect('[]', true)
            expect('[a]', true)
            expect('[a, a]', true)
            expect('{a}', true)
        },
        () => {
            const m = descentParser(deterministic())

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr[1] && mr[2] === cp.length
                if (success !== expected) {
                    throw mr
                }
            }

            expect('   true   ', true)
            expect('   tr2ue   ', false)
            expect('   true"   ', false)
            expect('   "Hello"   ', true)
            expect('   "Hello   ', false)
            expect('   "Hello\\n\\r\\""   ', true)
            expect('   -56.7e+5  ', true)
            expect('   h-56.7e+5   ', false)
            expect('   -56.7e+5   3', false)
            expect('   [] ', true)
            expect('   {} ', true)
            expect('   [[[]]] ', true)
            expect('   [1] ', true)
            expect('   [ 12, false, "a"]  ', true)
            expect('   [ 12, false2, "a"]  ', false)
            expect('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [{}], "a"] }  ', true)
            expect('   { "q": [ 12, false, [}], "a"] }  ', false)
            expect('   [{ "q": [ 12, false, [{}], "a"] }]  ', true)
            expect('   [{ "q": [ 12, false, [}], "a"] }]  ', false)
        }
    ],
    descentParserWithMeta: [
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = m("", [[45, 'minus'], [50, 'two']])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[{"tag":"minus","sequence":[[45,"minus"]]},{"sequence":[[50,"two"]]}]},true,2]') { throw result }
        },
    ],
    code: [
        () => {
            // Each call to the `code` matcher consumes exactly one token: a single
            // '/', a single '*', or a whole comment.
            const m = descentParser(code)

            const expect = (s: string, tag: string, len: number) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const [ast, success, idx] = mr
                if (!success || idx !== len || ast.tag !== tag) {
                    throw JSON.stringify(mr)
                }
            }

            expect('/', 'div', 1)
            expect('*', 'mul', 1)
            expect('//', 'div', 1)
            expect('**', 'mul', 1)
            expect('*/', 'mul', 1)
            expect('/*', 'commentError', 2)
            expect('/*/', 'commentError', 3)
            expect('**/', 'mul', 1)
            expect('/**/', 'comment', 4)
            expect('/*abc*/', 'comment', 7)
            expect('/*a/*b*/', 'comment', 8)

            // there is no empty alternative, so an empty input never matches.
            const emptyMr = descentParserCpOnly(m, '', [])
            if (emptyMr[1]) { throw JSON.stringify(emptyMr) }
        },
        () => {
            // Tokenizer: apply `code` over and over, each call picking up where the
            // previous one left off. The main invariant: two consecutive tokens must
            // never be `div` followed by `mul`, because a '/' immediately followed by
            // '*' must always be claimed together by `comment`/`commentError`, never
            // split into separate `div`/`mul` tokens.
            const maxLen = 6

            const strings: string[] = []
            const gen = (s: string, depth: number) => {
                if (s.length > 0) { strings.push(s) }
                if (depth === maxLen) { return }
                gen(s + '/', depth + 1)
                gen(s + '*', depth + 1)
            }
            gen('', 0)

            for (const s of strings) {
                const tags = tokenize(s)
                for (let i = 0; i + 1 < tags.length; ++i) {
                    if (tags[i] === 'div' && tags[i + 1] === 'mul') {
                        throw `div immediately followed by mul for input ${JSON.stringify(s)}: ${JSON.stringify(tags)}`
                    }
                }
            }
        },
    ],
}
