/**
 * Shared type definitions for persistent B-tree modules.
 *
 * @module
 */
/** @import { Tuple } from '../../array/module.f.mjs' */

/**
 * @template T
 * @typedef {Tuple<1, T>} Leaf1
 */

/**
 * @template T
 * @typedef {Tuple<2, T>} Leaf2
 */

/**
 * @template T
 * @typedef {readonly[TNode<T>, T, TNode<T>]} Branch3
 */

/**
 * @template T
 * @typedef {readonly[TNode<T>, T, TNode<T>, T, TNode<T>]} Branch5
 */

/**
 * @template T
 * @typedef {Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>} TNode
 */

/**
 * @template T
 * @typedef {TNode<T> | null} Tree
 */

/**
 * @template T
 * @typedef {readonly[TNode<T>]} Branch1
 */

/**
 * @template T
 * @typedef {readonly[...Branch5<T>, T, TNode<T>]} Branch7
 */

/**
 * Demotes a single-child branch root to its only child.
 *
 * After an insert or remove the root may temporarily hold exactly one child
 * (a `Branch1`). In that case the tree is one level taller than necessary;
 * returning the child directly restores the correct height. If the root has
 * more than one child it is returned unchanged.
 *
 * @type {<T>(b: Branch1<T> | Branch3<T> | Branch5<T>) => TNode<T>}
 */
export const collapseRoot = b => b.length === 1 ? b[0] : b
