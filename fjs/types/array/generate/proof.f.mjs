import { generate } from './module.f.js'
import { assert, assertEq, assertStructurallySame, todo } from '../../../asserts/module.f.js'

export const proof = /** @type {const} */ ({
    empty: () => assertStructurallySame(generate(0, todo), []),
    negativeZero: () => assertStructurallySame(generate(-0, todo), []),
    singleton: () => assertStructurallySame(generate(1, i => i + 10), [10]),
    indices: () => assertStructurallySame(generate(5, i => i * i), [0, 1, 4, 9, 16]),
    arguments: () => assertStructurallySame(generate(3, (...args) => args), [[0], [1], [2]]),
    dense: () => {
        const result = generate(3, () => undefined)
        assertStructurallySame(result, [undefined, undefined, undefined])
        assertEq(Object.keys(result).length, 3)
    },
    objects: () => {
        const result = generate(2, i => ({ i }))
        assertStructurallySame(result, [{ i: 0 }, { i: 1 }])
        assert(result[0] !== result[1])
    },
    fresh: () => assert(generate(0, todo) !== generate(0, todo)),
    arrayFrom: () => {
        for (const n of [0, 1, 2, 13, 16, 0x100]) {
            assertStructurallySame(generate(n, i => i + 1), Array.from({ length: n }, (_, i) => i + 1))
        }
    },
    throw: {
        negative: () => generate(-1, i => i),
        negativeFraction: () => generate(-0.5, i => i),
        fraction: () => generate(1.5, i => i),
        nan: () => generate(NaN, i => i),
        infinity: () => generate(Infinity, i => i),
        negativeInfinity: () => generate(-Infinity, i => i),
        oversized: () => generate(0x1_0000_0000, i => i),
        callback: () => generate(3, i => i === 1 ? todo() : i),
    },
})
