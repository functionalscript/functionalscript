/** @import { Body } from './types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { callable, isIndex } from './module.f.mjs'
import { factories } from './table.f.mjs'

/** @type {Body} */
const pair = (fixed, rest) => [fixed, rest]

export const proof = {
    metadata: () => {
        for (const n of [0, 1, 32, 1000]) { assert(isIndex(n)) }
        for (const n of [-0, -1, 0.5, NaN, Infinity, -Infinity]) { assert(!isIndex(n)) }
    },
    factories: () => {
        for (const [length, factory] of factories.entries()) {
            const f = factory(pair)
            assertEq(f.length, length)
            assert(f !== factory(pair))
            for (const n of [0, 1, length, length + 2]) {
                const args = Array.from({ length: n }, (_, i) => i === 0 ? -0 : i === n - 1 ? undefined : i)
                const expected = [Array.from({ length }, (_, i) => args[i]), args.slice(length)]
                assertStructurallySame(f(...args), expected)
                assertStructurallySame(callable(length, pair)(...args), expected)
            }
        }
    },
    throw: {
        negative: () => callable(-1, pair),
        negativeZero: () => callable(-0, pair),
        fractional: () => callable(1.5, pair),
        infinite: () => callable(Infinity, pair),
        nan: () => callable(NaN, pair),
        uncovered: () => callable(factories.length, pair),
    },
}
