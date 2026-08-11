/**
 * Types for B-tree lookup results and paths.
 *
 * @module
 */

import type { Index } from '../../array/types.ts'
import type { List } from '../../list/types.ts'
import type { Branch3, Branch5, Leaf1, Leaf2 } from '../types/types.ts'

type _FirstLeaf1<T> = readonly [Index<3>, Leaf1<T>]

type _FirstBranch3<T> = readonly [1, Branch3<T>]

type _FirstLeaf2<T> = readonly [Index<5>, Leaf2<T>]

type _FirstBranch5<T> = readonly [1 | 3, Branch5<T>]

export type First<T> =
    _FirstLeaf1<T> | _FirstBranch3<T> | _FirstLeaf2<T> | _FirstBranch5<T>

type _PathItem3<T> = readonly [0 | 2, Branch3<T>]

type _PathItem5<T> = readonly [0 | 2 | 4, Branch5<T>]

export type PathItem<T> = _PathItem3<T> | _PathItem5<T>

export type Path<T> = List<PathItem<T>>

export type Result<T> = {
    readonly first: First<T>
    readonly tail: Path<T>
}
