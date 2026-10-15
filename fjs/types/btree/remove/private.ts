/**
 * Implementation-private types for B-tree removal.
 *
 * @module
 */

import type { Branch1, Branch3, Branch5, Leaf1, Leaf2 } from '../types/types.ts'
import type { Path } from '../find/types.ts'

export type _Leaf01<T> = null | Leaf1<T>

export type _RemovePath<T> = {
    readonly first: _Leaf01<T>,
    readonly tail: Path<T>
}

export type _Branch<T> = Branch1<T> | Branch3<T> | Branch5<T>

export type _Merge<A, T> = (a: A) => (n: Branch3<T>) => Branch1<T> | Branch3<T>

/**
 * Orients the tuples a merge reads and builds: identity for the left child,
 * reversal for the right one. Each shape is a palindrome, so reversing it keeps
 * its type.
 */
export type _Side = {
    readonly l2: <A>(x: Leaf2<A>) => Leaf2<A>
    readonly b3: <A, B>(x: readonly [A, B, A]) => readonly [A, B, A]
    readonly b5: <A, B>(x: readonly [A, B, A, B, A]) => readonly [A, B, A, B, A]
}
