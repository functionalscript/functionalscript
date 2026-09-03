/**
 * Shared type definitions for persistent B-tree modules.
 *
 * @module
 */

import type { FixedArray } from '../../array/types.ts'

export type Leaf1<T> = FixedArray<1, T>

export type Leaf2<T> = FixedArray<2, T>

export type Branch3<T> = readonly [TNode<T>, T, TNode<T>]

export type Branch5<T> = readonly [TNode<T>, T, TNode<T>, T, TNode<T>]

export type TNode<T> = Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>

export type Tree<T> = TNode<T> | null

export type Branch1<T> = readonly [TNode<T>]

export type Branch7<T> = readonly [...Branch5<T>, T, TNode<T>]
