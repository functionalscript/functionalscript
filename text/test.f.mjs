import _, * as T from './module.f.mjs'
import { join } from '../types/string/module.f.cjs'

export default () => {
    /** @type {T.Block} */
    const text = [
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
