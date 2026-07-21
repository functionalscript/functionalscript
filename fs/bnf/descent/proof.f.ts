import { type CodePoint, stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { commaJoin0Plus, option, range, repeat0Plus, set } from '../module.f.ts'
import { deterministic } from '../testlib.f.ts'
import { emptyTagMap, toData } from '../data/module.f.ts'
import { descentParser, type DescentMatch, type CodePointMeta, type DescentMatchResult } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

export const proof = {
    emptyTags: [
        () => {
            const stringRule = 'true'
            const data = toData(stringRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{}') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{}') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const data = toData(varintRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{"":true}') { throw result }
        },
        () => {
            const emptyRule = ''
            const varintRule = { true: 'true', e: emptyRule}
            const data = toData(varintRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{"5":true,"":"e"}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(option('a'))
            const data = toData(repeatRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{"0":"none","3":true,"":true,"r":"none"}') { throw result }
        },
        () => {
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const data = toData(repeatRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            if (result !== '{"5":true,"r":"none"}') { throw result }
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
                assertEq(success, expected, mr)
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
                assertEq(success, expected, mr)
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
                assertEq(success, expected, mr)
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
    // Regression for the stack-recursive matcher bug (see
    // ../../djs/tokenizer/todo/stack-recursive-tokenization.md): the matcher used to
    // recurse natively once per grammar step, so match depth grew with input length and
    // these inputs threw "RangeError: Maximum call stack size exceeded" at a few thousand
    // code points. The explicit-frame-stack matcher handles them in O(1) JS call stack.
    longInput: [
        () => {
            // long right-recursive repetition: one repeat0Plus chain across the whole input
            const rule = repeat0Plus(set(' \n\r\t'))
            const name = toData(rule)[1]
            const m = descentParser(rule)
            const cp = toArray(stringToCodePointList(' '.repeat(10000)))
            const [, ok, idx] = descentParserCpOnly(m, name, cp)
            assertEq(ok, true)
            assertEq(idx, 10000)
        },
        () => {
            // deep non-repetition nesting: 5000 bracket levels in the JSON-like test
            // grammar — a shape that repetition-specific fixes (a `repeat` primitive)
            // would not cover
            const m = descentParser(deterministic())
            const n = 5000
            const cp = toArray(stringToCodePointList('['.repeat(n) + ']'.repeat(n)))
            const [, ok, idx] = descentParserCpOnly(m, '', cp)
            assertEq(ok, true)
            assertEq(idx, n * 2)
        },
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
}
