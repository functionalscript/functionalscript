import { classic, deterministic } from '../testlib.f.ts'
import { toData } from './module.f.ts'

export default {
    toData: () => {
        const c = toData(classic())
        const d = toData(deterministic())
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
