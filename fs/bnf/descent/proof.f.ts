import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { commaJoin0Plus, fullRange, none, option, range, repeat0Plus, set } from '../module.f.ts'
import { deterministic } from '../testlib.f.ts'
import { toData } from '../data/module.f.ts'
import { createEmptyTagMap, descentParser, type DescentMatch, type CodePointMeta, type DescentMatchResult, type AstRuleMeta } from './module.f.ts'

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
    comment: [`/*`, end, () => code],
    commentError: ['/*', repeat0Plus(fullRange)],
    div: ['/', () => code],
    mul: ['*', () => code],
    none,
} as const

const isCodePointMeta = <T>(item: AstRuleMeta<T>|CodePointMeta<T>): item is CodePointMeta<T> =>
    Array.isArray(item)

// `comment`/`commentError` are tried before `div`/`mul`, so any `/*` prefix is always
// consumed as a comment. A `div` node's nested `code` match can therefore never be
// tagged `mul`: that would mean a `/` was immediately followed by a `*` without the
// comment rules claiming it first.
const hasDivMulViolation = <T>(ast: AstRuleMeta<T>): boolean =>
    (ast.tag === 'div' && ast.sequence.some(item => !isCodePointMeta(item) && item.tag === 'mul'))
    || ast.sequence.some(item => !isCodePointMeta(item) && hasDivMulViolation(item))

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
            const m = descentParser(code)

            const expect = (s: string, tag: string, len: number) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const [ast, success, idx] = mr
                if (!success || idx !== len || ast.tag !== tag) {
                    throw JSON.stringify(mr)
                }
            }

            expect('', 'none', 0)
            expect('/', 'div', 1)
            expect('*', 'mul', 1)
            expect('//', 'div', 2)
            expect('**', 'mul', 2)
            expect('*/', 'mul', 2)
            expect('/*', 'commentError', 2)
            expect('/*/', 'commentError', 3)
            expect('**/', 'mul', 3)
            expect('/**/', 'comment', 4)
            expect('/*abc*/', 'comment', 7)
            expect('/*a/*b*/', 'comment', 8)
        },
        () => {
            // Exhaustively parse every '/'/'*' string up to length 6 and check that
            // a `div` tag is never immediately followed by a `mul` tag: since
            // `comment`/`commentError` are tried before `div`/`mul`, any `/*` in the
            // input must always be claimed by a comment rule, never split into a
            // `div` followed by a `mul`.
            const m = descentParser(code)
            const maxLen = 6

            const strings: string[] = []
            const gen = (s: string, depth: number) => {
                strings.push(s)
                if (depth === maxLen) { return }
                gen(s + '/', depth + 1)
                gen(s + '*', depth + 1)
            }
            gen('', 0)

            for (const s of strings) {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                if (hasDivMulViolation(mr[0])) {
                    throw `div immediately followed by mul for input ${JSON.stringify(s)}: ${JSON.stringify(mr)}`
                }
            }
        },
    ],
}
