/**
 * Types for the ordered map data structure.
 */

import type { Tree } from '../btree/types/types.ts'

export type Entry<T> = readonly [string, T]

export type OrderedMap<T> = Tree<Entry<T>>
