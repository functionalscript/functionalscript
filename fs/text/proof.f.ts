import { flat, utf8, utf8ToString, type Block } from './module.f.ts'
import { join } from '../types/string/module.f.ts'
import { unwrap } from '../types/nullable/module.f.ts'

export const proof = {
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
        const v = unwrap(utf8('Hello world!'))
        const r = utf8ToString(v)
        if (r !== 'Hello world!') { throw r }
    }
}
