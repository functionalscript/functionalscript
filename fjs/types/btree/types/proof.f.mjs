/**
 * @import { Branch1, Branch3, TNode } from './types.ts'
 */

import { collapseRoot } from './module.f.js'
import { assertEq } from '../../../asserts/module.f.mjs'

export const proof = {
    collapseRoot: {
        /** A single-child root is replaced by its child. */
        branch1: () => {
            /** @type {TNode<number>} */
            const child = [1, 2]
            /** @type {Branch1<number>} */
            const root = [child]
            assertEq(collapseRoot(root), child)
        },
        /** A root with more than one child is already the right height. */
        branch3: () => {
            /** @type {Branch3<number>} */
            const root = [[1], 2, [3]]
            assertEq(collapseRoot(root), root)
        },
    },
}
