/**
 * A persistent B-tree after a step: type keys, or click one in the tree,
 * see what the last step built — and everything it shares with the tree
 * before.
 *
 * **Nothing here changes in place**, so inserting a key builds a new tree and
 * leaves the old one as it was. That would be expensive if the new tree were
 * a copy, and it is not: only the path from the root to the change is built
 * again, and every other subtree is the same object in both versions.
 *
 * **The demo is a [versions demo](../../website/demo/versions/module.f.js)**,
 * which draws the new version and marks what the old one holds too; this
 * module says only what a B-tree is. Its nodes are compared as objects, since that
 * is how a B-tree shares. **It is drawn as a table**: every key in a row
 * of its own, in key order, and a node as tall as its whole subtree, its
 * keys in their rows and a blank cell beside each child, so every arrow
 * runs straight across. Every leaf of a B-tree is equally deep, so the
 * leaves line up in the last column.
 *
 * **Generate builds a random tree**: the keys 10, 20, … up to the count,
 * inserted in an order the browser picks — how a level of the
 * [compaction game](../../website/playground/btree/module.f.js) starts.
 *
 * **A click on a key removes it and inserts it again.** The keys stay the
 * same, but the shape may not: a remove that empties a leaf merges or
 * borrows, and the insert that follows can split somewhere else. It is the
 * one move of the [compaction game](../../website/playground/btree/module.f.js),
 * which draws its tree with the same [structure](./structure/module.f.js).
 *
 * @module
 *
 * @import { Preset } from '../../website/demo/versions/types.ts'
 */

import { versionsDemo } from '../../website/demo/versions/module.f.js'
import { structure, tensUpTo } from './structure/module.f.js'

/**
 * The presets the drop-down offers, each one press from what its name
 * says. The proofs follow each hint and check what it claims.
 *
 * @type {readonly Preset[]}
 */
export const presets = [
    ['Insert into a leaf', tensUpTo(7), 80, 'Press Insert to add 80: only the path to the leaf 70 is built again, and the rest is shared.', 'insert-into-a-leaf'],
    ['Empty tree', [], 10, 'Press Insert to add 10, then keep inserting 20, 30, … to watch the tree grow from a single leaf.', 'empty-tree'],
    ['Split a leaf', tensUpTo(8), 90, 'Press Insert to add 90: the leaf 70 80 is full, so it splits and 80 moves up into its parent.', 'split-a-leaf'],
    ['Grow a level', tensUpTo(14), 150, 'Press Insert to add 150: the split runs all the way up to the root, and the tree grows a level.', 'grow-a-level'],
    ['Remove and merge', tensUpTo(7), 70, 'Press Remove to take out 70: its leaf empties and merges with its sibling, and the tree shrinks a level.', 'remove-and-merge'],
    ['Remove a missing key', tensUpTo(7), 90, 'Press Remove to take out 90: it is not in the tree, so nothing changes and every node is shared.', 'remove-a-missing-key'],
    ['Move a key', tensUpTo(10), 40, 'Click 40 in the tree: it is removed and inserted again, and the tree comes back with the same keys in one node fewer.', 'move-a-key'],
    ['Move a key back', tensUpTo(10), 50, 'Click 50 in the tree: removing it empties its leaf, and inserting it again builds the same shape back, so nothing changes.', 'move-a-key-back'],
    ['Big tree', tensUpTo(31), 320, 'Press Insert to add 320: only the five nodes on its path are built again, and the other 26 are shared.', 'big-tree'],
]

const versions = versionsDemo({
    structure,
    name: 'btree',
    noun: 'tree',
    intro: 'Every step builds a new tree and leaves the old one as it was, but only the path from the root to the change is built again: everything else is shared by both versions. Click a key in the tree to remove it and insert it again.',
    presets,
    random: { max: 100, count: 26, keys: tensUpTo },
})

export const demo = versions.demo
export const _load = versions.load
export const _press = versions.press
export const _move = versions.move
export const _generate = versions.generate
export const _graphOf = versions.graphOf
export const _census = versions.census
