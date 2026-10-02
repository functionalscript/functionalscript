/**
 * A persistent B-tree before and after a step: type keys, see what the last
 * one changed — and everything it did not.
 *
 * **Nothing here changes in place**, so inserting a key builds a new tree and
 * leaves the old one as it was. That would be expensive if the new tree were
 * a copy, and it is not: only the path from the root to the change is built
 * again, and every other subtree is the same object in both versions.
 *
 * **The demo is a [versions demo](../../website/demo/versions/module.f.mjs)**,
 * which draws both versions as one graph, a shared subtree once; this module
 * says only what a B-tree is. Its nodes are compared as objects, since that
 * is how a B-tree shares. Every leaf of a B-tree is equally deep, so the
 * leaves line up in the last column, and a column reads in order of its
 * nodes' average keys.
 *
 * @module
 *
 * @import { TNode, Tree } from './types/types.ts'
 * @import { Preset, Row, Structure } from '../../website/demo/versions/types.ts'
 */

import { set } from './set/module.f.mjs'
import { remove } from './remove/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { versionsDemo } from '../../website/demo/versions/module.f.mjs'

/**
 * A node's keys, each a row of its own, and its subtrees, each an edge
 * from a corner of its right side: the first from the top, the last from
 * the bottom, a middle one from the middle. Nothing is named: the number
 * of keys and of edges already says which of the four kinds a node is.
 *
 * @type {(node: TNode<number>) => readonly Row<TNode<number>>[]}
 */
const rowsOf = node => {
    switch (node.length) {
        case 1: { return [{ label: '', inline: String(node[0]) }] }
        case 2: {
            const [v0, v1] = node
            return [{ label: '', inline: String(v0) }, { label: '', inline: String(v1) }]
        }
        case 3: {
            const [l, v, r] = node
            return [{ to: l, corner: 'top' }, { label: '', inline: String(v) }, { to: r, corner: 'bottom' }]
        }
        case 5: {
            const [l, v0, m, v1, r] = node
            return [
                { to: l, corner: 'top' }, { label: '', inline: String(v0) },
                { to: m, corner: 'middle' }, { label: '', inline: String(v1) },
                { to: r, corner: 'bottom' },
            ]
        }
    }
}

/** @type {(node: TNode<number>) => number} */
const average = node => {
    const keys = rowsOf(node).flatMap(row => 'inline' in row ? [Number(row.inline)] : [])
    return keys.reduce((a, b) => a + b, 0) / keys.length
}

/** @type {Structure<Tree<number>, TNode<number>>} */
const structure = {
    empty: null,
    insert: key => set(cmp(key))(() => key),
    remove: key => remove(cmp(key)),
    root: tree => tree,
    shape: () => ({ rows: rowsOf, title: () => '', order: average, layout: 'leaves' }),
}

/**
 * 10, 20, … up to `n` tens: keys with room between them, so a reader can
 * insert one anywhere.
 *
 * @type {(n: number) => readonly number[]}
 */
const tensUpTo = n => Array.from({ length: n }, (_, i) => (i + 1) * 10)

/**
 * The presets the drop-down offers, each one press from what its name
 * says. The proofs follow each hint and check what it claims.
 *
 * @type {readonly Preset[]}
 */
export const presets = [
    ['Insert into a leaf', tensUpTo(7), 80, 'Press Insert to add 80: only the path to the leaf 70 is built again, and the rest is shared.'],
    ['Empty tree', [], 10, 'Press Insert to add 10, then keep inserting 20, 30, … to watch the tree grow from a single leaf.'],
    ['Split a leaf', tensUpTo(8), 90, 'Press Insert to add 90: the leaf 70 80 is full, so it splits and 80 moves up into its parent.'],
    ['Grow a level', tensUpTo(14), 150, 'Press Insert to add 150: the split runs all the way up to the root, and the tree grows a level.'],
    ['Remove and merge', tensUpTo(7), 70, 'Press Remove to take out 70: its leaf empties and merges with its sibling, and the tree shrinks a level.'],
    ['Remove a missing key', tensUpTo(7), 90, 'Press Remove to take out 90: it is not in the tree, so nothing changes and every node is shared.'],
    ['Big tree', tensUpTo(31), 320, 'Press Insert to add 320: only the five nodes on its path are built again, and the other 26 are shared.'],
]

const versions = versionsDemo({
    structure,
    name: 'btree',
    noun: 'tree',
    intro: 'Every step builds a new tree and leaves the old one as it was, but only the path from the root to the change is built again: everything else is shared by both versions.',
    presets,
})

export const demo = versions.demo
export const _load = versions.load
export const _press = versions.press
export const _graphOf = versions.graphOf
export const _census = versions.census
