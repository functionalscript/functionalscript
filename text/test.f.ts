import * as _ from './module.f.mjs'
import * as string from '../types/string/module.f.mjs'
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
