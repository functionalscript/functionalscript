/**
 * @module
 *
 * @import { RuleSet } from '../data/types.ts'
 * @import { MatchResult } from './types.ts'
 */

import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { commaJoin0Plus, eof, option, range, repeat0Plus, set } from '../module.f.mjs'
import { toData } from '../data/module.f.mjs'
import { dispatchMap, parser, parserRuleSet } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'
import { deterministic } from '../testlib.f.mjs'

export const proof = {
    dispatch: [
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"":{"rangeMap":[[null,64],[{"rules":[]},70]]}}') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const data = toData(stringRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"rules":["1"]},65]]}}') { throw result }
        },
        () => {
            const a = range('AA')
            const b = range('BB')
            const ab = [a, b]
            const data = toData(ab)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"rules":["1"]},65]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"":{"emptyTag":true,"rangeMap":[]}}') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"tag":"a","rules":[]},65],[{"tag":"b","rules":[]},66]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":true,"rangeMap":[]},"1":{"rangeMap":[[null,64],[{"rules":[]},65]]},"":{"emptyTag":"e","rangeMap":[[null,64],[{"tag":"a","rules":[]},65]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const data = toData(numberRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":"none","rangeMap":[[null,44],[{"tag":"minus","rules":[]},45]]},"1":{"emptyTag":true,"rangeMap":[]},"2":{"rangeMap":[[null,44],[{"rules":[]},45]]},"3":{"rangeMap":[[null,47],[{"rules":[]},57]]},"":{"rangeMap":[[null,44],[{"tag":"minus","rules":["3"]},45],[null,47],[{"rules":[]},57]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const spaceRule = range('  ')
            const optionalSpaceRule = { 'none': emptyRule, 'space': spaceRule}
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalSpaceRule, optionalMinusRule, digitRule]
            const data = toData(numberRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result !== '{"0":{"emptyTag":"none","rangeMap":[[null,31],[{"tag":"space","rules":[]},32]]},"1":{"emptyTag":true,"rangeMap":[]},"2":{"rangeMap":[[null,31],[{"rules":[]},32]]},"3":{"emptyTag":"none","rangeMap":[[null,44],[{"tag":"minus","rules":[]},45]]},"4":{"rangeMap":[[null,44],[{"rules":[]},45]]},"5":{"rangeMap":[[null,47],[{"rules":[]},57]]},"":{"rangeMap":[[null,31],[{"tag":"space","rules":["3","5"]},32],[null,44],[{"tag":"minus","rules":["5"]},45],[null,47],[{"rules":[]},57]]}}') { throw result }
        }
    ],
    parser: [
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":true,"sequence":[]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const m = parser(emptyRule)
            const mr = m("", [65, 70])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":true,"sequence":[]},true,[65,70]]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const m = parser(terminalRangeRule)
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65]},true,[]]') { throw result }
        },
        () => {
            const terminalRangeRule = 0x000079_000087
            const m = parser(terminalRangeRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }
        },
        () => {
            const terminalRangeRule = 0x000080_000087 //broken range
            const m = parser(terminalRangeRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"a","sequence":[65]},true,[]]') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const m = parser(variantRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[64]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
             const m = parser(variantRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const m = parser(variantRule)
            const mr = m("", [64])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"e","sequence":[]},true,[64]]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = parser(stringRule)
            const mr = m("", [65,66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[66]}]},true,[]]') { throw result }
        },
        () => {
            const stringRule = 'AB'
            const m = parser(stringRule)
            const mr = m("", [65,67])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[67]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minursRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minursRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [50])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[50]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [45,50])
            const result = JSON.stringify(mr)
            if (result !== '[{"tag":"minus","sequence":[45,{"sequence":[50]}]},true,[]]') { throw result }
        },
        () => {
            const emptyRule = ''
            const minusRule = range('--')
            const optionalMinusRule = { 'none': emptyRule, 'minus': minusRule}
            const digitRule = range('09')
            const numberRule = [optionalMinusRule, digitRule]
            const m = parser(numberRule)
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,null]') { throw result } //if remainder is null it means failed
        },
        () => {
            const m = parser(option('a'))

            const isSuccess = (/** @type {MatchResult} */mr) => mr[1] && mr[2]?.length === 0
            /** @type {(s: string, success: boolean) => void} */
            const expect = (s, success) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                assertEq(isSuccess(mr), success, mr)
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

            const m = parser(value)

            /** @type {(mr: MatchResult) => boolean} */
            const isSuccess = mr => mr[1] && mr[2]?.length === 0
            /** @type {(s: string, success: boolean) => void} */
            const expect = (s, success) => {
                const mr = m('value', toArray(stringToCodePointList(s)))
                assertEq(isSuccess(mr), success, mr)
            }

            expect('', false)
            expect('[]', true)
            expect('[a]', true)
            expect('[a, a]', true)
            expect('{a}', true)
        },
        () => {
            const m = parser(deterministic())

            /** @type {(mr: MatchResult) => boolean} */
            const isSuccess = (mr) => mr[1] && mr[2]?.length === 0
            /** @type {(s: string, success: boolean) => void} */
            const expect = (s, success) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                assertEq(isSuccess(mr), success, mr)
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
    longInput: [
        () => {
            // Long right-recursive repetition: one `repeat0Plus` chain across the
            // whole input. This is the shape that overflowed the JS call stack
            // when the matcher recursed once per consumed code point.
            const rule = repeat0Plus(set(' \n\r\t'))
            const m = parser(rule)
            const [, success, remainder] = m(toData(rule)[1], toArray(stringToCodePointList(' '.repeat(10000))))
            assertEq(success, true)
            assertEq(remainder?.length, 0)
        },
        () => {
            // Deep non-repetition nesting: 5000 bracket levels in the JSON-like
            // test grammar — a shape a repetition-specific fix would not cover.
            const m = parser(deterministic())
            const n = 5000
            const cp = toArray(stringToCodePointList('['.repeat(n) + ']'.repeat(n)))
            const [, success, remainder] = m('', cp)
            assertEq(success, true)
            assertEq(remainder?.length, 0)
        },
    ],
    logicalEof: [
        () => {
            // EOF dispatches below every ordinary symbol, so its cut point is
            // `-2` — the stored endpoint codes never reach the dispatch map.
            const dm = dispatchMap(toData(eof)[0])
            assertEq(JSON.stringify(dm), '{"":{"rangeMap":[[null,-2],[{"rules":[]},-1]]}}')
        },
        () => {
            // The matcher synthesizes one EOF after the physical input, so an
            // `eof` terminal matches empty input. It adds no AST leaf, and the
            // remainder stays physical: empty, not `null`.
            const m = parser(eof)
            assertEq(JSON.stringify(m('', [])), '[{"sequence":[]},true,[]]')
        },
        () => {
            // Callers pass physical symbols only, so EOF is not available
            // before the end of the input.
            const m = parser(eof)
            assertEq(JSON.stringify(m('', [65])), '[{"sequence":[]},false,[65]]')
        },
        () => {
            // Non-empty input: the terminal consumes the synthesized EOF after
            // the last code point.
            const m = parser([range('AA'), eof])
            assertEq(JSON.stringify(m('', [65])), '[{"sequence":[65,{"sequence":[]}]},true,[]]')
        },
        () => {
            // Exactly one EOF is synthesized: the second `eof` terminal has
            // nothing to consume, so the match runs out of input — the `null`
            // remainder this backend reports for that.
            const m = parser([eof, eof])
            assertEq(JSON.stringify(m('', [])), '[{"sequence":[{"sequence":[]}]},true,null]')
        },
        () => {
            // EOF as one alternative among ordinary terminals.
            const m = parser({ a: range('AA'), e: eof })
            assertEq(JSON.stringify(m('', [])), '[{"tag":"e","sequence":[]},true,[]]')
            assertEq(JSON.stringify(m('', [65])), '[{"tag":"a","sequence":[65]},true,[]]')
        },
    ],
    repeat: [
        () => {
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const dm = dispatchMap(repeatData[0])
            const result = JSON.stringify(dm)
            if (result !== '{"ws":{"emptyTag":true,"rangeMap":[]},"a":{"rangeMap":[[null,64],[{"rules":[]},65]]},"repa":{"rangeMap":[[null,64],[{"rules":[""]},65]]},"":{"rangeMap":[[null,64],[{"rules":[""]},65]]}}') { throw result }
        },
        () => {
            // A `repeat` rule dispatches on its item's first set and continues
            // with the item's own chain followed by itself — the right-recursive
            // chain the fold removed from the data, rebuilt here because this
            // backend inlines a nullable item's first set into whatever encloses
            // it and so cannot carry the repetition anywhere else.
            const rule = repeat0Plus(range('AF'))
            const [ruleSet, entry] = toData(rule)
            assertEq(JSON.stringify(ruleSet[entry]), '"0"')
            assertEq(
                JSON.stringify(dispatchMap(ruleSet)[entry]),
                '{"emptyTag":true,"rangeMap":[[null,64],[{"rules":["r"]},70]]}')
        },
        () => {
            // A repetition of itself has no first set to dispatch on, and asking
            // for one would not terminate. `toData` never folds such a rule; a
            // hand-written rule set can still hold one.
            /** @type {RuleSet} */
            const ruleSet = { repeated: 'repeated' }
            assertEq(
                JSON.stringify(dispatchMap(ruleSet)),
                '{"repeated":{"emptyTag":true,"rangeMap":[]}}')
        },
    ],
    repeatParser: [
        () => {
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,null]') { throw result }
        },
        () => {
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[]}]},true,null]') { throw result }
        },
        () => {
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65,65,65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[65,{"sequence":[65,{"sequence":[]}]}]}]},true,null]') { throw result }
        },
        () => {
            /** @type {readonly [RuleSet, string]} */
            const repeatData = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [66])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},false,[66]]') { throw result }
        }
    ],
    throw: {
        ambiguousVariantDispatch: () => {
            // Two alternatives covering the same code point — dispatch merge throws.
            const conflictRule = { 'a': range('AA'), 'b': range('AA') }
            dispatchMap(toData(conflictRule)[0])
        }
    },
    // Regression: `emptyTagMap` must stay correct for cyclic rule references.
    // A naive single-pass, memoized derivation that marks a rule nullable as
    // a placeholder *before* recursing into its own children (to break the
    // cycle) over-approximates nullability here, and made `dispatchMap`
    // falsely report a first/first conflict for this grammar even though it
    // has none — `value` only ever nests inside brackets or is the literal
    // `a`, and `ws` is genuinely optional on both sides of it.
    cyclicNullability: () => {
        const ws = option(' ')
        const value = () => ({ array: ['[', value, ']'], leaf: 'a' })
        const m = parser([ws, value, ws]) // must not throw 'can not merge'

        /** @type {(s: string, success: boolean) => void} */
        const expect = (s, success) => {
            const mr = m('', toArray(stringToCodePointList(s)))
            assertEq(mr[1] && mr[2]?.length === 0, success, mr)
        }

        expect('a', true)
        expect(' a ', true)
        expect('[a]', true)
        expect('[[a]]', true)
        expect(' [[a]] ', true)
        expect('b', false)
    },
}
