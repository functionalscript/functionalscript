import { repeat } from './module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'

export const proof = {
    zero: () => assertStructurallySame(repeat(0)('x'), []),
    one: () => assertStructurallySame(repeat(1)('x'), ['x']),
    even: () => assertStructurallySame(repeat(4)('x'), ['x', 'x', 'x', 'x']),
    odd: () => {
        const value = { x: 1 }
        const result = repeat(13)(value)
        assertEq(result.length, 13)
        assert(result.every(item => item === value))
    },
    dense: () => {
        const result = repeat(4)(undefined)
        assertStructurallySame(result, [undefined, undefined, undefined, undefined])
        assertEq(Object.keys(result).length, 4)
    },
    fresh: () => {
        const zero = repeat(0)
        const one = repeat(1)
        assert(zero('x') !== zero('x'))
        assert(one('x') !== one('x'))
    },
    lengths: () => {
        // FixedArray intentionally admits only natural-number literals.
        for (const n of [-2, -0.5, -Infinity, -0]) {
            assertStructurallySame(repeat(n)('x'), [])
        }
        for (const n of [0.5, 1.5, 2.5, 5e-324]) {
            assertEq(repeat(n)('x').length, Math.ceil(n))
        }
    },
    throw: {
        nan: () => repeat(NaN),
        infinity: () => repeat(Infinity),
    },
}
