import { stringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { range } from '../module.f.ts'
import { classic, deterministic } from '../testlib.f.ts'
import { dispatchMap, parser, type RuleSet, toData } from './module.f.ts'

export default {
    toData: [
        () => {
            const c = toData(classic())
            const d = toData(deterministic())
        },
        () => {
            const stringRule = 'true'
            const result = stringify(sort)(toData(stringRule))
            if (result !== '[{"":["0","1","2","3"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917},""]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const result = stringify(sort)(toData(terminalRangeRule))
            if (result !== '[{"":1090519110},""]') { throw result } //1090519110 = 65 * 2^24 + 70
        },
        () => {
            const sequenceRangeRule = [range('AF'), range('af')]
            const result = stringify(sort)(toData(sequenceRangeRule))
            if (result !== '[{"":["0","1"],"0":1090519110,"1":1627390054},""]') { throw result }
        },
        () => {
            const lazyRule = () => 'true'
            const result = stringify(sort)(toData(lazyRule))
            if (result !== '[{"":1946157172,"0":1912602738,"1":1962934389,"2":1694498917,"lazyRule":["","0","1","2"]},"lazyRule"]') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const result = stringify(sort)(toData(varintRule))
            const expected = '[{"":{"false":"5","true":"0"},"0":["1","2","3","4"],"1":1946157172,"2":1912602738,"3":1962934389,"4":1694498917,"5":["6","7","8","9","4"],"6":1711276134,"7":1627390049,"8":1811939436,"9":1929379955},""]'
            if (result !== expected) { throw [result, expected] }
        },        
        () => {
            const lazyRule = () => 'true'
            const lazyRule0 = () => 'false'            
            const result = stringify(sort)(toData([lazyRule, lazyRule0]))
            const expected = '[{"":["lazyRule","lazyRule0"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917,"4":1711276134,"5":1627390049,"6":1811939436,"7":1929379955,"lazyRule":["0","1","2","3"],"lazyRule0":["4","5","6","7","3"]},""]'
            if (result !== expected) { throw [result, expected] }
        },
        () => {
            const emptyRule = ''
            const result = stringify(sort)(toData(emptyRule))
            const expected = '[{"":[]},""]'
            if (result !== expected) { throw [result, expected] }
        },
    ],
    variantTest: () => {
        const varintRule = { a: 'a', b: 'b'}
        const result = stringify(sort)(toData(varintRule))
        if (result !== '[{"":{"a":"0","b":"2"},"0":["1"],"1":1627390049,"2":["3"],"3":1644167266},""]') { throw result }
    },
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
    repeat: [
        // () => {
        //     const repeatData: readonly [RuleSet, string] = [{"":["ws","repa"],"ws":[],"repa":["a",""],"a":1090519105},""]
        //     const dm = dispatchMap(repeatData[0])
        //     const result = JSON.stringify(dm)
        //     if (result !== '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"tag":"a","rules":[]},65],[{"tag":"b","rules":[]},66]]}}') { throw result }
        // }
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
            const terminalRangeRule = range('AF')
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
        }
    ],
    example: () => {
        const grammar = {
            space: 0x000020_000020,
            digit: 0x000030_000039,
            sequence: ['space', 'digit'],
            spaceOrDigit: {
                'whiteSpace': 'space',
                'digit': 'digit',
            }
        }
    }
}
