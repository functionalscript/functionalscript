/**
 * Implementation-private types for the walk: what each of its two loops
 * carries from one step to the next, which is the loop's own business and
 * no part of what the walk answers.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { TreeEntry } from '../tree/types.ts'
import type { ObjectType, Oid } from '../types.ts'
import type { Target } from './types.ts'

/**
 * One id the peel has still to read, and the type the tag that named it
 * declared for it — `null` at the chain's head, where nothing declared
 * one.
 */
export type _PeelItem = {
    readonly id: Oid
    readonly want: Nullable<ObjectType>
}

/**
 * What the peel carries along the chain: `seen` the ids it has read, so an
 * id it comes back to is refused as the cycle it is, and `target` the
 * object it stopped at, `null` until it stops at one and where it stops at
 * none.
 *
 * `seen` is a map rather than a list because the chain has no bound: a list
 * is scanned and copied whole at every link, which is quadratic in the
 * chain's length, where the map answers and grows in its logarithm.
 */
export type _PeelState = {
    readonly seen: OrderedMap<true>
    readonly target: Nullable<Target>
}

/**
 * One component of a path and whether it is the last, which is what
 * decides whether the entry it names is read as a tree or answered.
 */
export type _PathItem = {
    readonly name: readonly number[]
    readonly last: boolean
}

/**
 * What the path walk carries from one component to the next: `entries` the
 * tree the next component is looked up in, `null` where the path has
 * already run out of tree, and `found` the entry the last component
 * matched.
 */
export type _PathState = {
    readonly entries: Nullable<readonly TreeEntry[]>
    readonly found: Nullable<TreeEntry>
}
