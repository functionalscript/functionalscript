/**
 * Implementation-private types for B-tree removal.
 */

import type { Branch1, Branch3, Branch5, Leaf1 } from '../types/types.ts'
import type { Path } from '../find/types.ts'

export type _Leaf01<T> = null | Leaf1<T>

export type _RemovePath<T> = {
    readonly first: _Leaf01<T>,
    readonly tail: Path<T>
}

export type _Branch<T> = Branch1<T> | Branch3<T> | Branch5<T>

export type _Merge<A, T> = (a: A) => (n: Branch3<T>) => Branch1<T> | Branch3<T>
