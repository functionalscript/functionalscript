/**
 * Types for the ordered map data structure.
 *
 * @module
 */

import type { Tree } from '../btree/types/types.ts'

/** A string-keyed entry: a name and its value. */
export type Entry<T> = readonly [string, T]

export type OrderedMap<T> = Tree<Entry<T>>
