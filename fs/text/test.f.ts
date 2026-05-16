import { asUtf8, flat, utf8, utf8ToString, type Block, type Utf8 } from './module.f.ts'
import { vec8, type Vec } from '../types/bit_vec/module.f.ts'
import { join } from '../types/string/module.f.ts'

export default {
    block: () => {
        const text: Block = [
            'a',
            'b',
            () => [
                'c',
                () => ['d'],
            ],
            'e',
        ]
        const result = join('\n')(flat(':')(text))
        if (result !== 'a\nb\n:c\n::d\ne') { throw result }
    },
    encoding: () => {
        const v = utf8('Hello world!')
        const r = utf8ToString(v)
        if (r !== 'Hello world!') { throw r }
    },
    nominal: () => {
        // Utf8 IS a Vec (subtype) so it can be passed where Vec is expected.
        const u: Utf8 = utf8('hi')
        const v: Vec = u
        if (v !== u) { throw [v, u] }
        // A plain Vec needs an explicit assertion to be used as Utf8.
        // Uncommenting the line below would fail TypeScript compilation:
        // const bad: Utf8 = vec8(0x41n)
        const asserted: Utf8 = asUtf8(vec8(0x41n))
        if (utf8ToString(asserted) !== 'A') { throw asserted }
    },
}
