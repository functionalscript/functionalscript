import { assertEq } from '../../../../../asserts/module.f.js'
import { empty as emptyMap } from '../../../../../types/map/module.f.js'
import { empty as emptySet } from '../../../../../types/set/module.f.js'
import { _hasReturn, memoCells, recipeCells } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    compatibility: () => {
        const block = /** @type {const} */ ({ statements: [], exit: ['yield', []] })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const plan = /** @type {const} */ ({ cells: [], definitions: emptyMap, loops: emptySet })
        assertEq(_hasReturn(0, owner), false)
        assertEq(memoCells(block), null)
        assertEq(recipeCells(0, plan, emptyMap).value, 0)
    },
})
