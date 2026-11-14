/**
 * Persistent SameValueZero sets, in first-insertion order. Reference lookup
 * uses RefMap through the shared map; primitive lookup uses its ordered map.
 * Adding an existing value returns the original set. Both signed zeros are
 * stored as positive zero, as in JavaScript's Set.
 *
 * @module
 * @import { PersistentSet } from './types.ts'
 */

import { empty as noEntries, mapEntries, mapHas, mapSet, size as mapSize } from '../map/module.f.js'

/** The set with nothing in it. @type {PersistentSet<never>} */
export const empty = noEntries

/** Whether the set holds the value, by SameValueZero. @type {<T>(value: T) => (set: PersistentSet<T>) => boolean} */
export const has = value => set => mapHas(set, value)

/** Add a value, returning the same set where it is already present. @type {<T>(value: T) => (set: PersistentSet<T>) => PersistentSet<T>} */
export const add = value => set => has(value)(set) ? set : mapSet(set, value, true)

/** How many values the set holds. @type {<T>(set: PersistentSet<T>) => number} */
export const size = mapSize

/** The values, in first-insertion order. @type {<T>(set: PersistentSet<T>) => readonly T[]} */
export const values = set => mapEntries(set).map(([value]) => value)

/**
 * Stable deduplication of an array, retaining the first encounter of each value.
 * @template T
 * @param {readonly T[]} values
 * @returns {PersistentSet<T>}
 */
export const fromValues = values => {
    /** @type {PersistentSet<T>} */
    let set = empty
    for (const value of values) { set = add(value)(set) }
    return set
}
