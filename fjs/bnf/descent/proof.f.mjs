/**
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { RuleSet } from '../data/types.ts'
 * @import { DescentMatch, CodePointMeta, DescentMatchResult } from './types.ts'
 */

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { map, toArray } from '../../types/list/module.f.mjs'
import { commaJoin0Plus, eof, option, range, repeat0Plus, set } from '../module.f.mjs'
import { emptyTagMap, toData } from '../data/module.f.mjs'
import { descentParser, descentParserRuleSet } from './module.f.mjs'
import { assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { deterministic, showAst } from '../testlib.f.mjs'

/** @type {(cp: CodePoint) => CodePointMeta<unknown>} */
const mapCodePoint = cp => [cp, undefined]

/**
 * The code point of a one-character string, for expectations that would
 * otherwise spell it as a bare number. Goes through the module's own
 * conversion, the same one that builds the parser's input.
 *
 * @type {(s: string) => CodePoint}
 */
const cp1 = s => toArray(stringToCodePointList(s))[0]

/** @type {(m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]) => DescentMatchResult<unknown>} */
const descentParserCpOnly = (m, name, cp) => {
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
            // The whole repetition is one `repeat` rule, and a repetition always
            // matches empty — with no tag, because it is a list of items rather
            // than a choice between branches.
            const repeatRule = repeat0Plus(set(' \n\r\t'))
            const data = toData(repeatRule)
            const emptyTags = emptyTagMap(data[0])
            const result = JSON.stringify(emptyTags)
            assertEq(result, '{"r":true}')
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

            const expect = (/** @type {string} */s, /** @type {Boolean} */expected) => {
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

            const expect = (/** @type {string} */s, /** @type {boolean} */expected) => {
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

            // A match is pinned by the AST it built, not just by the fact that it
            // matched: the shape is what a repetition changes, and asserting it
            // subsumes success — only a full match produces one. `showAst` writes
            // a node as `tag(children)` with the code points it consumed as one
            // quoted string, `*` for the tagless empty match.
            //
            // The leading three spaces are the `repeat` to read first: they are
            // three siblings of one node here, and three levels of nesting in the
            // LL(1) backend's copy of these expectations.
            /** @type {(s: string, expected: string) => void} */
            const expectAst = (s, expected) => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                assertEq(mr.success, true, s)
                assertEq(mr.idx, cp.length, s)
                assertEq(showAst(mr.ast), expected, s)
            }

            /** @type {(s: string) => void} */
            const expectNoMatch = s => {
                const cp = toArray(stringToCodePointList(s))
                const mr = descentParserCpOnly(m, '', cp)
                assertEq(mr.success && mr.idx === cp.length, false, s)
            }

            expectAst('   true   ', '((" "(" ") " "(" ") " "(" ")) "true"(("t") ("r") ("u") ("e")) (" "(" ") " "(" ") " "(" ")))')
            expectAst('   "Hello"   ', '((" "(" ") " "(" ") " "(" ")) "string"((("\\"")) ("0x2300005b"("H") "0x5d10ffff"("e") "0x5d10ffff"("l") "0x5d10ffff"("l") "0x5d10ffff"("o")) (("\\""))) (" "(" ") " "(" ") " "(" ")))')
            expectAst('   "Hello\\n\\r\\""   ', '((" "(" ") " "(" ") " "(" ")) "string"((("\\"")) ("0x2300005b"("H") "0x5d10ffff"("e") "0x5d10ffff"("l") "0x5d10ffff"("l") "0x5d10ffff"("o") "escape"((("\\\\")) "n"("n")) "escape"((("\\\\")) "r"("r")) "escape"((("\\\\")) "\\""("\\""))) (("\\""))) (" "(" ") " "(" ") " "(" ")))')
            expectAst('   -56.7e+5  ', '((" "(" ") " "(" ") " "(" ")) "number"("some"(("-")) "onenine"(("5") (("6"))) "some"(((".")) (("7") ())) "some"("e"("e") "+"("+") (("5") ()))) (" "(" ") " "(" ")))')
            expectAst('   [] ', '((" "(" ") " "(" ") " "(" ")) "array"((("[")) () "none"() (("]"))) (" "(" ")))')
            expectAst('   {} ', '((" "(" ") " "(" ") " "(" ")) "object"((("{")) () "none"() (("}"))) (" "(" ")))')
            expectAst('   [[[]]] ', '((" "(" ") " "(" ") " "(" ")) "array"((("[")) () "some"(("array"((("[")) () "some"(("array"((("[")) () "none"() (("]"))) ()) "none"()) (("]"))) ()) "none"()) (("]"))) (" "(" ")))')
            expectAst('   [1] ', '((" "(" ") " "(" ") " "(" ")) "array"((("[")) () "some"(("number"("none"() "onenine"(("1") ()) "none"() "none"()) ()) "none"()) (("]"))) (" "(" ")))')
            expectAst('   [ 12, false, "a"]  ', '((" "(" ") " "(" ") " "(" ")) "array"((("[")) (" "(" ")) "some"(("number"("none"() "onenine"(("1") (("2"))) "none"() "none"()) ()) "some"(((((",")) (" "(" "))) ("false"(("f") ("a") ("l") ("s") ("e")) ())) "some"(((((",")) (" "(" "))) ("string"((("\\"")) ("0x5d10ffff"("a")) (("\\""))) ())) "none"()))) (("]"))) (" "(" ") " "(" ")))')
            expectAst('   { "q": [ 12, false, [{"b" : "c"}], "a"] }  ', '((" "(" ") " "(" ") " "(" ")) "object"((("{")) (" "(" ")) "some"(((((("\\"")) ("0x5d10ffff"("q")) (("\\""))) () ((":")) (" "(" ")) "array"((("[")) (" "(" ")) "some"(("number"("none"() "onenine"(("1") (("2"))) "none"() "none"()) ()) "some"(((((",")) (" "(" "))) ("false"(("f") ("a") ("l") ("s") ("e")) ())) "some"(((((",")) (" "(" "))) ("array"((("[")) () "some"(("object"((("{")) () "some"(((((("\\"")) ("0x5d10ffff"("b")) (("\\""))) (" "(" ")) ((":")) (" "(" ")) "string"((("\\"")) ("0x5d10ffff"("c")) (("\\"")))) ()) "none"()) (("}"))) ()) "none"()) (("]"))) ())) "some"(((((",")) (" "(" "))) ("string"((("\\"")) ("0x5d10ffff"("a")) (("\\""))) ())) "none"())))) (("]")))) (" "(" "))) "none"()) (("}"))) (" "(" ") " "(" ")))')
            expectAst('   { "q": [ 12, false, [{}], "a"] }  ', '((" "(" ") " "(" ") " "(" ")) "object"((("{")) (" "(" ")) "some"(((((("\\"")) ("0x5d10ffff"("q")) (("\\""))) () ((":")) (" "(" ")) "array"((("[")) (" "(" ")) "some"(("number"("none"() "onenine"(("1") (("2"))) "none"() "none"()) ()) "some"(((((",")) (" "(" "))) ("false"(("f") ("a") ("l") ("s") ("e")) ())) "some"(((((",")) (" "(" "))) ("array"((("[")) () "some"(("object"((("{")) () "none"() (("}"))) ()) "none"()) (("]"))) ())) "some"(((((",")) (" "(" "))) ("string"((("\\"")) ("0x5d10ffff"("a")) (("\\""))) ())) "none"())))) (("]")))) (" "(" "))) "none"()) (("}"))) (" "(" ") " "(" ")))')
            expectAst('   [{ "q": [ 12, false, [{}], "a"] }]  ', '((" "(" ") " "(" ") " "(" ")) "array"((("[")) () "some"(("object"((("{")) (" "(" ")) "some"(((((("\\"")) ("0x5d10ffff"("q")) (("\\""))) () ((":")) (" "(" ")) "array"((("[")) (" "(" ")) "some"(("number"("none"() "onenine"(("1") (("2"))) "none"() "none"()) ()) "some"(((((",")) (" "(" "))) ("false"(("f") ("a") ("l") ("s") ("e")) ())) "some"(((((",")) (" "(" "))) ("array"((("[")) () "some"(("object"((("{")) () "none"() (("}"))) ()) "none"()) (("]"))) ())) "some"(((((",")) (" "(" "))) ("string"((("\\"")) ("0x5d10ffff"("a")) (("\\""))) ())) "none"())))) (("]")))) (" "(" "))) "none"()) (("}"))) ()) "none"()) (("]"))) (" "(" ") " "(" ")))')

            expectNoMatch('   tr2ue   ')
            expectNoMatch('   true"   ')
            expectNoMatch('   "Hello   ')
            expectNoMatch('   h-56.7e+5   ')
            expectNoMatch('   -56.7e+5   3')
            expectNoMatch('   [ 12, false2, "a"]  ')
            expectNoMatch('   { "q": [ 12, false, [}], "a"] }  ')

            // The invalid input in detail. A failed match's own index rewound to
            // the start and locates nothing; the furthest failure is the
            // high-water mark, and it lands on the `}` that closes nothing.
            const bad = '   [{ "q": [ 12, false, [}], "a"] }]  '
            const badMr = descentParserCpOnly(m, '', toArray(stringToCodePointList(bad)))
            assertEq(badMr.success, false, bad)
            assertEq(badMr.idx, 0, bad)
            const failure = assertNotNullish(badMr.failure)
            assertEq(failure.idx, 25, bad)
            assertEq(bad[failure.idx], '}', bad)
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
    logicalEof: [
        () => {
            // The matcher synthesizes one EOF after the physical input, so the
            // `eof` terminal matches empty input. It contributes no AST leaf,
            // and the public index stays physical.
            const m = descentParser(eof)
            const mr = m('', [])
            assertEq(JSON.stringify(mr), '{"ast":{"sequence":[]},"success":true,"idx":0}')
        },
        () => {
            // Callers pass physical symbols only, so EOF is not available
            // before the end of the input.
            const m = descentParser(eof)
            const mr = descentParserCpOnly(m, '', toArray(stringToCodePointList('A')))
            assertEq(mr.success, false)
            const f = assertNotNullish(mr.failure)
            assertEq(f.idx, 0)
            assertEq(f.expected.length, 1)
            assertEq(f.expected[0], eof)
        },
        () => {
            // Non-empty input: the terminal consumes the synthesized EOF after
            // the last code point, and `idx` still reports `input.length`.
            const m = descentParser([range('AA'), eof])
            const cp = toArray(stringToCodePointList('A'))
            const mr = descentParserCpOnly(m, '', cp)
            assertEq(mr.success, true)
            assertEq(mr.idx, cp.length)
            assertEq(JSON.stringify(mr.ast), `{"sequence":[{"sequence":[[${cp1('A')},null]]},{"sequence":[]}]}`)
        },
        () => {
            // Exactly one EOF is synthesized: a second `eof` terminal has
            // nothing left to consume, and its failure points at `input.length`.
            const m = descentParser([eof, eof])
            const mr = m('', [])
            assertEq(mr.success, false)
            const f = assertNotNullish(mr.failure)
            assertEq(f.idx, 0)
            assertEq(f.expected.length, 1)
            assertEq(f.expected[0], eof)
        },
        () => {
            // EOF as one alternative among ordinary terminals.
            const m = descentParser({ a: range('AA'), e: eof })
            assertEq(JSON.stringify(m('', [])), '{"ast":{"tag":"e","sequence":[]},"success":true,"idx":0}')
            const mr = descentParserCpOnly(m, '', toArray(stringToCodePointList('A')))
            assertEq(mr.success, true)
            assertEq(mr.idx, 1)
        },
        () => {
            // Repetition terminates on EOF: consuming it moves the complete
            // cursor, so the repeat makes exactly one round and then stops —
            // with `idx` alone this would never stop.
            const rule = repeat0Plus(eof)
            const m = descentParser(rule)
            const mr = m(toData(rule)[1], [])
            assertEq(JSON.stringify(mr), '{"ast":{"sequence":[{"sequence":[]}]},"success":true,"idx":0}')
        },
        () => {
            // Backtracking restores the complete cursor: `x` consumes EOF and
            // then fails, so `y` must still find EOF available.
            const m = descentParser({ x: [eof, range('AA')], y: eof })
            assertEq(JSON.stringify(m('', [])), '{"ast":{"tag":"y","sequence":[]},"success":true,"idx":0}')
        },
        () => {
            // Diagnostic ordering by the complete cursor: `y` got further than
            // `x` — the same physical index, but past the EOF it consumed — so
            // only its expectation is reported, and at the physical end.
            const m = descentParser({ x: range('AA'), y: [eof, range('BB')] })
            const mr = m('', [])
            assertEq(mr.success, false)
            const f = assertNotNullish(mr.failure)
            assertEq(f.idx, 0)
            assertEq(f.expected.length, 1)
            assertEq(f.expected[0], range('BB'))
        },
    ],
    repeat: [
        () => {
            // The whole repetition is one node holding a flat sequence of the
            // items it matched — not the right-recursive chain of `some`/`none`
            // nodes its functional spelling builds.
            const rule = repeat0Plus(set(' \n\r\t'))
            const m = descentParser(rule)
            const name = toData(rule)[1]
            const mr = descentParserCpOnly(m, name, toArray(stringToCodePointList('  ')))
            assertEq(
                JSON.stringify(mr),
                `{"ast":{"sequence":[{"tag":" ","sequence":[[${cp1(' ')},null]]},{"tag":" ","sequence":[[${cp1(' ')},null]]}]},"success":true,"idx":2}`)
        },
        () => {
            // Zero items is a match, and the node is empty rather than tagged.
            const rule = repeat0Plus(set(' \n\r\t'))
            const m = descentParser(rule)
            const mr = m(toData(rule)[1], [])
            assertEq(JSON.stringify(mr), '{"ast":{"sequence":[]},"success":true,"idx":0}')
        },
        () => {
            // A round that fails ends the repetition rather than failing it: the
            // rounds before it stand and the match stops where the failed one
            // began.
            const rule = repeat0Plus(set(' \n\r\t'))
            const m = descentParser(rule)
            const name = toData(rule)[1]
            const mr = descentParserCpOnly(m, name, toArray(stringToCodePointList(' x')))
            assertEq(
                JSON.stringify(mr),
                `{"ast":{"sequence":[{"tag":" ","sequence":[[${cp1(' ')},null]]}]},"success":true,"idx":1}`)
        },
        () => {
            // `toData` never folds a nullable item into a `repeat`, but a
            // hand-written rule set can hold one. A round that consumes nothing
            // would repeat forever, so it is kept once and ends the repetition.
            /** @type {RuleSet} */
            const ruleSet = {
                repeated: 'optionalA',
                optionalA: { some: 'a', none: 'e' },
                a: range('aa'),
                e: [],
            }
            const m = descentParserRuleSet(ruleSet)
            assertEq(
                JSON.stringify(m('repeated', [])),
                '{"ast":{"sequence":[{"tag":"none","sequence":[]}]},"success":true,"idx":0}')
            assertEq(
                JSON.stringify(m('repeated', [[cp1('a'), null]])),
                `{"ast":{"sequence":[{"tag":"some","sequence":[[${cp1('a')},null]]},{"tag":"none","sequence":[]}]},"success":true,"idx":1}`)
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
