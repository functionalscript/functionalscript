/** A function group needs paths in both directions within its declaration interval. */
import { assertEq } from '../../asserts/module.f.js'
import { isFunctionGroup } from './module.f.js'

export const proof = {
    mutual: () => {
        const ab = { from: 1, to: 2 }
        const bc = { from: 2, to: 3 }
        const ca = { from: 3, to: 1 }
        assertEq(isFunctionGroup(1, 3, [ab, bc, ca]), true)
        assertEq(isFunctionGroup(1, 3, [ab, bc]), false)
        assertEq(isFunctionGroup(1, 3, [ca]), false)
        assertEq(isFunctionGroup(1, 2, [ab, bc, ca]), false)
        assertEq(isFunctionGroup(2, 3, [ab, bc, ca]), false)
    },
}
