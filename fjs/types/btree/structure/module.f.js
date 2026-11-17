/**
 * What a B-tree of numbers is to a drawing of it: how to build one, and the
 * rows each node draws as. The [B-tree demo](../demo.f.js) and the
 * [compaction game](../../../website/playground/btree/module.f.js) both draw
 * their trees with this {@link structure}, and start from {@link tensUpTo}.
 *
 * **It is drawn as a table**: every key in a row of its own, in key order,
 * and a node as tall as its whole subtree, its keys in their rows and a
 * blank cell beside each child, so every arrow runs straight across.
 *
 * @module
 *
 * @import { TNode, Tree } from '../types/types.ts'
 * @import { Row, Structure } from '../../../website/demo/versions/types.ts'
 */

import { set } from '../set/module.f.js'
import { remove } from '../remove/module.f.js'
import { cmp, sum } from '../../number/module.f.js'
import { generate } from '../../array/module.f.js'
import { hasEntry } from '../../object/entry/module.f.js'

/** @type {(key: number) => Row<TNode<number>>} */
const keyRow = key => ({ label: '', inline: String(key), key })

/**
 * A node's rows, in key order: its subtrees and its keys, each key alone
 * in a row. Drawn as a table, a subtree's row is as tall as the subtree,
 * so every key of the tree has a row of its own and every arrow runs
 * straight across. A node has no title: its keys and its arrows say which
 * of the four kinds it is.
 *
 * @type {(node: TNode<number>) => readonly Row<TNode<number>>[]}
 */
const rowsOf = node => {
    switch (node.length) {
        case 1: { return [keyRow(node[0])] }
        case 2: {
            const [v0, v1] = node
            return [keyRow(v0), keyRow(v1)]
        }
        case 3: {
            const [l, v, r] = node
            return [{ to: l }, keyRow(v), { to: r }]
        }
        default: {
            const [l, v0, m, v1, r] = node
            return [{ to: l }, keyRow(v0), { to: m }, keyRow(v1), { to: r }]
        }
    }
}

/** @type {(node: TNode<number>) => number} */
const average = node => {
    const keys = rowsOf(node).flatMap(row => hasEntry(row, 'inline') ? [Number(row.inline)] : [])
    return sum(keys) / keys.length
}

/** @type {Structure<Tree<number>, TNode<number>>} */
export const structure = {
    empty: null,
    insert: key => set(cmp(key))(() => key),
    remove: key => remove(cmp(key)),
    root: tree => tree,
    shape: () => ({ rows: rowsOf, title: () => '', order: average, layout: 'table' }),
}

/**
 * 10, 20, … up to `n` tens: keys with room between them, so a reader can
 * insert one anywhere.
 *
 * @type {(n: number) => readonly number[]}
 */
export const tensUpTo = n => generate(n, i => (i + 1) * 10)
