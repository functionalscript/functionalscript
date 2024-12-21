import * as _ from './module.f.ts'
import * as string from '../types/string/module.f.ts'
const { join } = string

export default () => {
    const text
        : _.Block
        = [
        'a',
        'b',
        () => [
            'c',
            () => ['d'],
        ],
        'e',
    ]
    const result = join('\n')(_.flat(':')(text))
    if (result !== 'a\nb\n:c\n::d\ne') { throw result }
}
