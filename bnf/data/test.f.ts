import { stringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { range } from '../module.f.ts'
import { classic, deterministic } from '../testlib.f.ts'
import { dispatchMap, toData } from './module.f.ts'

export default {
    toData: [
        () => {
            const c = toData(classic())
            const d = toData(deterministic())
        },
        () => {
            const stringRule = 'true'
            const result = stringify(sort)(toData(stringRule))
            if (result != '[{"":["0","1","2","3"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917},""]') { throw result }
        },
        () => {
            const terminalRangeRule = range('AF')
            const result = stringify(sort)(toData(terminalRangeRule))
            if (result != '[{"":1090519110},""]') { throw result } //1090519110 = 65 * 2^24 + 70
        },
        () => {
            const sequenceRangeRule = [range('AF'), range('af')]
            const result = stringify(sort)(toData(sequenceRangeRule))
            if (result != '[{"":["0","1"],"0":1090519110,"1":1627390054},""]') { throw result }
        },
        () => {
            const lazyRule = () => 'true'
            const result = stringify(sort)(toData(lazyRule))
            if (result != '[{"":1946157172,"0":1912602738,"1":1962934389,"2":1694498917,"lazyRule":["","0","1","2"]},"lazyRule"]') { throw result }
        },
        () => {
            const varintRule = { true: 'true', false: 'false'}
            const result = stringify(sort)(toData(varintRule))
            const expected = '[{"":{"false":"5","true":"0"},"0":["1","2","3","4"],"1":1946157172,"2":1912602738,"3":1962934389,"4":1694498917,"5":["6","7","8","9","4"],"6":1711276134,"7":1627390049,"8":1811939436,"9":1929379955},""]'
            if (result != expected) { throw [result, expected] }
        },        
        () => {
            const lazyRule = () => 'true'
            const lazyRule0 = () => 'false'            
            const result = stringify(sort)(toData([lazyRule, lazyRule0]))
            const expected = '[{"":["lazyRule","lazyRule0"],"0":1946157172,"1":1912602738,"2":1962934389,"3":1694498917,"4":1711276134,"5":1627390049,"6":1811939436,"7":1929379955,"lazyRule":["0","1","2","3"],"lazyRule0":["4","5","6","7","3"]},""]'
            if (result != expected) { throw [result, expected] }
        },
    ],
    variantTest: () => {
        const varintRule = { a: 'a', b: 'b'}
        const result = stringify(sort)(toData(varintRule))
        if (result != '[{"":{"a":"0","b":"2"},"0":["1"],"1":1627390049,"2":["3"],"3":1644167266},""]') { throw result }
    },
    dispatch: [
        () => {
            const terminalRangeRule = range('AF')
            const data = toData(terminalRangeRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result != '{"":{"rangeMap":[[null,64],[{"rules":[]},70]]}}') { throw result }       
        },
        () => {
            const stringRule = 'AB'
            const data = toData(stringRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result != '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"rules":[{"rangeMap":[[null,65],[{"rules":[]},66]]}]},65]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const data = toData(emptyRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result != '{"":{"emptyTag":true,"rangeMap":[]}}') { throw result }
        },
        () => {
            const variantRule = { 'a': range('AA'), 'b': range('BB')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result != '{"0":{"rangeMap":[[null,64],[{"rules":[]},65]]},"1":{"rangeMap":[[null,65],[{"rules":[]},66]]},"":{"rangeMap":[[null,64],[{"tag":"a","rules":[]},65],[{"tag":"b","rules":[]},66]]}}') { throw result }
        },
        () => {
            const emptyRule = ''
            const variantRule = { 'e': emptyRule, 'a': range('AA')}
            const data = toData(variantRule)
            const dm = dispatchMap(data[0])
            const result = JSON.stringify(dm)
            if (result != '{"0":{"emptyTag":true,"rangeMap":[]},"1":{"rangeMap":[[null,64],[{"rules":[]},65]]},"":{"emptyTag":"e","rangeMap":[[null,64],[{"tag":"a","rules":[]},65]]}}') { throw result }
        },
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
