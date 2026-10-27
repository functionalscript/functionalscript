import { assertEq } from '../../../../asserts/module.f.js'
import { normalizeLazyReturns, normalizeMemo } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    compatibility: () => {
        const block = /** @type {const} */ ({ statements: [], exit: ['yield', []] })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        assertEq(normalizeMemo(block), block)
        assertEq(normalizeLazyReturns(block, owner), block)
    },
})
