import { flat, type Block } from './module.f.ts'
import { join } from '../types/string/module.f.ts'

export default () => {
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
}
