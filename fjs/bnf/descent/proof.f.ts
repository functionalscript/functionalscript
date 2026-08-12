import type { CodePoint } from '../../text/utf16/types.ts'
import type { DescentMatch, CodePointMeta, DescentMatchResult } from './types.ts'

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { commaJoin0Plus, option, range, repeat0Plus, set } from '../module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'
import { descentParser } from './module.f.mjs'
import { assertEq, assertNotNullish } from '../../asserts/module.f.mjs'

import { deterministic } from '../testlib.f.mjs'

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

// The code point of a one-character string, for expectations that would
// otherwise spell it as a bare number. Goes through the module's own
// conversion, the same one that builds the parser's input.
const cp1 = (s: string): CodePoint => toArray(stringToCodePointList(s))[0]

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
            if (result !== '{"ast":{"sequence":[]},"success":true,"idx":0}') { throw result }
        },
        () => {
            const emptyRule = ''
            const m = descentParser(emptyRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('AF')))
            const result = JSON.stringify(mr)
            if (result !== '{"ast":{"sequence":[]},"success":true,"idx":0}') { throw result }
        },
        () => {
            // Literal code point on purpose. Elsewhere both sides of the
            // assertion come from `stringToCodePointList` — the input is built
            // with it and the expectation interpolates `cp1`, which calls it
            // too — so a change to the conversion would move both sides
            // together and the test would still pass. Pinning `A` to 65 here
            // covers the conversion itself.
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('A')))
            const result = JSON.stringify(mr)
            if (result !== '{"ast":{"sequence":[[65,null]]},"success":true,"idx":1}') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = descentParser(terminalRangeRule)
            const mr =descentParserCpOnly(m, "", toArray(stringToCodePointList('@')))
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"sequence":[]},"success":false,"idx":0,"failure":{"idx":0,"expected":[${range('AF')}]}}`) { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('A')))
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"tag":"a","sequence":[[${cp1('A')},null]]},"success":true,"idx":1}`) { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('@')))
            const result = JSON.stringify(mr)
            // Both branches were rejected at 0, so both terminals are expected there.
            if (result !== `{"ast":{"sequence":[]},"success":false,"idx":0,"failure":{"idx":0,"expected":[${range('AA')},${range('BB')}]}}`) { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
             const m = descentParser(variantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '{"ast":{"tag":"e","sequence":[]},"success":true,"idx":0}') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = descentParser(variantRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('@')))
            const result = JSON.stringify(mr)
            if (result !== '{"ast":{"tag":"e","sequence":[]},"success":true,"idx":0}') { throw result }
        },
        () => {
            const emptyVariantRule = {}
            const m = descentParser(emptyVariantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            // A variant with no branches fails without ever trying a terminal,
            // so there is nothing to expect.
            if (result !== '{"ast":{"sequence":[]},"success":false,"idx":0,"failure":{"idx":0,"expected":[]}}') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('AB')))
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"sequence":[{"sequence":[[${cp1('A')},null]]},{"sequence":[[${cp1('B')},null]]}]},"success":true,"idx":2}`) { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = descentParser(stringRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('AC')))
            const result = JSON.stringify(mr)
            // The result index rewound to the sequence's start, but the furthest
            // failure kept the position where 'B' was actually rejected.
            if (result !== `{"ast":{"sequence":[]},"success":false,"idx":0,"failure":{"idx":1,"expected":[${range('BB')}]}}`) { throw result }
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('2')))
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"sequence":[{"tag":"none","sequence":[]},{"sequence":[[${cp1('2')},null]]}]},"success":true,"idx":1}`) { throw result }
        },
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = descentParser(numberRule)
            const mr = descentParserCpOnly(m, "", toArray(stringToCodePointList('-2')))
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"sequence":[{"tag":"minus","sequence":[[${cp1('-')},null]]},{"sequence":[[${cp1('2')},null]]}]},"success":true,"idx":2}`) { throw result }
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
            // Past the end: '-' and then the digit range were both rejected at 0.
            if (result !== `{"ast":{"sequence":[]},"success":false,"idx":0,"failure":{"idx":0,"expected":[${range('--')},${range('09')}]}}`) { throw result }
        },
        () => {
            const m = descentParser(option('a'))

            const expect = (s: string, expected: boolean) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                const success = mr.success && mr.idx === cp.length
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
                const success = mr.success && mr.idx === cp.length
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
                const success = mr.success && mr.idx === cp.length
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
    // Regression for the stack-recursive matcher bug: the matcher used to recurse
    // natively once per grammar step, so match depth grew with input length and these
    // inputs threw "RangeError: Maximum call stack size exceeded" at a few thousand
    // code points. The explicit-frame-stack matcher handles them in O(1) JS call stack.
    longInput: [
        () => {
            // long right-recursive repetition: one repeat0Plus chain across the whole input
            const rule = repeat0Plus(set(' \n\r\t'))
            const name = toData(rule)[1]
            const m = descentParser(rule)
            const cp = toArray(stringToCodePointList(' '.repeat(10000)))
            const { success: ok, idx } = descentParserCpOnly(m, name, cp)
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
            const { success: ok, idx } = descentParserCpOnly(m, '', cp)
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
            const mr = m("", [[cp1('-'), 'minus'], [cp1('2'), 'two']])
            const result = JSON.stringify(mr)
            if (result !== `{"ast":{"sequence":[{"tag":"minus","sequence":[[${cp1('-')},"minus"]]},{"sequence":[[${cp1('2')},"two"]]}]},"success":true,"idx":2}`) { throw result }
        },
    ],
    furthestFailure: [
        () => {
            // A branch rejected *before* the high-water mark must not pull it back:
            // `x` gets to index 1 before failing, then `y` fails at 0.
            const m = descentParser({ x: ['A', 'B'], y: 'B' })
            const { success: ok, idx, failure } = descentParserCpOnly(m, '', toArray(stringToCodePointList('AC')))
            assertEq(ok, false)
            assertEq(idx, 0)
            // A failed match always carries a failure; that is the contract.
            const f = assertNotNullish(failure)
            assertEq(f.idx, 1)
            assertEq(f.expected.length, 1)
            assertEq(f.expected[0], range('BB'))
        },
        () => {
            // The same terminal rejected at the same index by two branches is
            // expected once, not twice.
            const m = descentParser({ x: ['A', 'B'], y: ['A', 'B', 'C'] })
            const { failure } = descentParserCpOnly(m, '', toArray(stringToCodePointList('AC')))
            const f = assertNotNullish(failure)
            assertEq(f.idx, 1)
            assertEq(f.expected.length, 1)
            assertEq(f.expected[0], range('BB'))
        },
    ],
}
