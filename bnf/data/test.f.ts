import { stringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { range } from '../module.f.ts'
import { classic, deterministic } from '../testlib.f.ts'
import { toData } from './module.f.ts'

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
    bunTest: () => {
        const a = () => 'a'
        if (a.name !== 'a') { throw a.name }
        //const b = () => 'b'        
        //const result = stringify(sort)(toData([a, b]))
        //const expected = '[{"":["a","b"],"0":1627390049,"1":1644167266,"a":["0"],"b":["1"]},""]'
        //if (result != expected) { throw [result, expected] }                   
    },
    bunTestFail: () => {
        const a = () => 'a'
        const s0 = [a]
        if (s0[0].name !== 'a') { throw s0[0].name }
        // const b = () => 'b'
        // const s = [a, b]
        // const result = stringify(sort)(toData(s))
        // const expected = '[{"":["a","b"],"0":1627390049,"1":1644167266,"a":["0"],"b":["1"]},""]'
        // if (result != expected) { throw [result, expected] }          
    },
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
