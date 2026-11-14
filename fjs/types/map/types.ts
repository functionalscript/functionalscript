/** Types of the persistent, insertion-ordered map. @module */

import type { Tree } from '../btree/types/types.ts'
import type { OrderedMap } from '../ordered_map/types.ts'
import type { RefMap, RefMapKey } from '../ref_map/types.ts'

/** The primitive and reference keys of FunctionalScript; symbols are excluded. */
export type MapKey = undefined | null | boolean | number | bigint | string | RefMapKey

/** A key and its value, in the map's first-insertion order. */
export type MapEntry<K, V> = readonly [key: K, value: V]

/**
 * Reference and primitive indexes point into the same ordered tree. Values
 * live inside slots, so undefined is a value distinct from a missing key.
 * Treat this representation as a handle and use the module's operations.
 */
export type PersistentMap<K, V> = {
    readonly references: RefMap
    readonly primitives: OrderedMap<bigint>
    readonly ordered: Tree<readonly [id: bigint, key: K, value: V]>
    readonly count: number
    readonly next: bigint
}
