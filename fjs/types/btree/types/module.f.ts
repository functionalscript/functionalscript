/**
 * Shared type definitions for persistent B-tree modules.
 *
 * @module
 */
import type { Array1, Array2 } from '../../array/module.f.ts'

export type Leaf1<T> = Array1<T>

export type Leaf2<T> = Array2<T>

export type Branch3<T> = readonly[TNode<T>, T, TNode<T>]

export type Branch5<T> = readonly[TNode<T>, T, TNode<T>, T, TNode<T>]

export type TNode<T> = Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>

export type Tree<T> = TNode<T> | null

export type Branch1<T> = readonly[TNode<T>]

export type Branch7<T> = readonly[...Branch5<T>, T, TNode<T>]

/**
 * Demotes a single-child branch root to its only child.
 *
 * After an insert or remove the root may temporarily hold exactly one child
 * (a `Branch1`). In that case the tree is one level taller than necessary;
 * returning the child directly restores the correct height. If the root has
 * more than one child it is returned unchanged.
 */
export const collapseRoot
    : <T>(b: Branch1<T> | Branch3<T> | Branch5<T>) => TNode<T>
    = b => b.length === 1 ? b[0] : b
