import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { commaJoin0Plus, option, range, repeat0Plus, set } from '../module.f.ts'
import { deterministic } from '../testlib.f.ts'
import { type RuleSet, toData } from '../data/module.f.ts'
import { dispatchMap, type MatchResult, parser, parserRuleSet } from './module.f.ts'

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

            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
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

            const m = parser(value)

            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('value', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
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
            const m = parser(deterministic())

            const isSuccess = (mr: MatchResult) => mr[1] && mr[2]?.length === 0
            const expect = (s: string, success: boolean) => {
                const mr = m('', toArray(stringToCodePointList(s)))
                if (isSuccess(mr) !== success) {
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
    repeat: [
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const dm = dispatchMap(repeatData[0])
            const result = JSON.stringify(dm)
            if (result !== '{"ws":{"emptyTag":true,"rangeMap":[]},"a":{"rangeMap":[[null,64],[{"rules":[]},65]]},"repa":{"rangeMap":[[null,64],[{"rules":[""]},65]]},"":{"rangeMap":[[null,64],[{"rules":[""]},65]]}}') { throw result }
        }
    ],
    repeatParser: [
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[]}]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
            const m = parserRuleSet(repeatData[0])
            const mr = m("", [65,65,65])
            const result = JSON.stringify(mr)
            if (result !== '[{"sequence":[65,{"sequence":[65,{"sequence":[65,{"sequence":[]}]}]}]},true,null]') { throw result }
        },
        () => {
            const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
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
    }
}
