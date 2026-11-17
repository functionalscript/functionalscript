/**
 * The B-tree a drawing is given: it inserts and removes as the B-tree does,
 * and each of the four kinds of node draws as its keys and its subtrees in
 * key order.
 */

import { structure, tensUpTo } from './module.f.js'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { hasEntry } from '../../object/entry/module.f.js'

/** A tree of the keys, inserted in order. @type {(keys: readonly number[]) => import('../types/types.ts').Tree<number>} */
const treeOf = keys => keys.reduce((tree, key) => structure.insert(key)(tree), structure.empty)

const { rows, title, order, layout } = structure.shape({ before: null, after: null })

/** A row's key, or `null` for a subtree's row. @type {(row: import('../../../website/demo/versions/types.ts').Row<unknown>) => unknown} */
const keyOf = row => hasEntry(row, 'key') ? row.key : null

export const proof = {
    tensUpTo: () => {
        assertStructurallySame(tensUpTo(0), [])
        assertStructurallySame(tensUpTo(3), [10, 20, 30])
    },
    // an empty tree has no root; a tree is its own root
    root: () => {
        assertEq(structure.root(structure.empty), null)
        const tree = treeOf([10])
        assertEq(structure.root(tree), tree)
    },
    // insert and remove are the B-tree's, by the key itself
    insertAndRemove: () => {
        assertStructurallySame(treeOf([10, 20]), [10, 20])
        assertStructurallySame(structure.remove(10)(treeOf([10, 20])), [20])
        // a key the tree does not hold removes nothing
        const tree = treeOf([10, 20])
        assertEq(structure.remove(30)(tree), tree)
    },
    // each kind of node: a key alone in a row, a subtree where it sits
    // between the keys
    rows: {
        leaf1: () => assertStructurallySame(rows([10]), [{ label: '', inline: '10', key: 10 }]),
        leaf2: () => assertStructurallySame(rows([10, 20]).map(keyOf), [10, 20]),
        branch3: () => {
            const node = /** @type {const} */ ([[10], 20, [30]])
            assertStructurallySame(rows(node), [{ to: node[0] }, { label: '', inline: '20', key: 20 }, { to: node[2] }])
        },
        branch5: () => {
            const node = /** @type {const} */ ([[10], 20, [30], 40, [50]])
            assertStructurallySame(rows(node).map(keyOf), [null, 20, null, 40, null])
        },
    },
    // a node has no title, is ordered by the mean of its own keys, and the
    // whole is laid out as a table
    shape: () => {
        assertEq(title([10]), '')
        assertEq(order([10, 30]), 20)
        assertEq(order([[10], 20, [30], 40, [50]]), 30)
        assertEq(layout, 'table')
    },
}
