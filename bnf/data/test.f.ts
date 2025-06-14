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
            if (result != '[{"":["0","1","2","3"],"0":116,"1":114,"2":117,"3":101},""]') { throw result }
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
