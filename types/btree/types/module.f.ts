import type { Array1, Array2 } from '../../array/module.f.ts'

export type Leaf1<T> = Array1<T>

export type Leaf2<T> = Array2<T>

export type Branch3<T> = readonly[TNode<T>, T, TNode<T>]

export type Branch5<T> = readonly[TNode<T>, T, TNode<T>, T, TNode<T>]

export type TNode<T> = Leaf1<T> | Leaf2<T> | Branch3<T> | Branch5<T>

export type Tree<T> = TNode<T> | null

export type Branch1<T> = readonly[TNode<T>]

export type Branch7<T> = readonly[...Branch5<T>, T, TNode<T>]
