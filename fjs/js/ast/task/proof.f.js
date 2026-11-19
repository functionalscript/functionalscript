/** @import { Task } from './types.ts' */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { bind, call, done, run } from './module.f.js'

export const proof = /** @type {const} */ ({
    results: () => {
        const value = /** @type {const} */ ({ result: 7 })
        assertEq(run(done(value)), value)
        assertStructurallySame(run(bind(done(3), value => done(/** @type {const} */ (['answer', value])))), ['answer', 3])
    },
    continuationOrder: () => {
        const first = bind(call(() => done(2)), value => call(() => done(value + 3)))
        assertEq(run(bind(first, value => done(value * 4))), 20)
    },
    deepContinuations: () => {
        /** @type {(depth: number) => Task<number>} */
        const descend = depth => call(() => depth === 0 ? done(0) : bind(descend(depth - 1), value => done(value + 1)))
        assertEq(run(descend(50_000)), 50_000)
    },
})
