import { flat, msbUtf8, msbUtf8ToString, type Block } from './module.f.ts'
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
        const v = msbUtf8('Hello world!')
        const r = msbUtf8ToString(v)
        if (r !== 'Hello world!') { throw r }
    }
}
