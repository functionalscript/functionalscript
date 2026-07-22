import { assertEq, assertNotNullish } from '../asserts/module.f.ts'
import { flat, utf8, utf8ToString, tryUtf8, type Block } from './module.f.ts'
import { join } from '../types/string/module.f.ts'
import { empty, maxLengthBytes } from '../types/bit_vec/module.f.ts'

const overflowStr = 'a'.repeat(Number(maxLengthBytes) + 1)

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
        assertEq(result, 'a\nb\n:c\n::d\ne')
    },
    encoding: () => {
        const v = utf8('Hello world!')
        const r = utf8ToString(v)
        assertEq(r, 'Hello world!')
    },
    tryUtf8RoundTrip: () => {
        const v = assertNotNullish(tryUtf8('Hello world!'))
        assertEq(v, utf8('Hello world!'))
        assertEq(utf8ToString(v), 'Hello world!')
    },
    tryUtf8Empty: () => {
        assertEq(tryUtf8(''), empty)
    },
    tryUtf8Overflow: {
        // One byte past `maxLengthBytes`; `tryUtf8` should report `null`
        // instead of building an oversized `bigint`, and the throwing `utf8`
        // wrapper should raise on the same input.
        try: () => {
            assertEq(tryUtf8(overflowStr), null)
        },
        throw: () => {
            utf8(overflowStr)
        },
    },
}
