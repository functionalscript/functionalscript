import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { exitValues, freeBindings, freeLoopBindings } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    compatibility: () => {
        const block = /** @type {const} */ ({ statements: [], exit: ['yield', []] })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {const} */ ({ target, parameters: [], initial: [], results: [],
            body: { statements: [], exit: ['break', target, []] },
        })
        assertEq(exitValues(block.exit), block.exit[1])
        assertStructurallySame(freeBindings(block), [])
        assertStructurallySame(freeLoopBindings(loop), [])
    },
})
