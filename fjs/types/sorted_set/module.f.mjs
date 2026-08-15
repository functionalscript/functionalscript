/**
 * A sorted set, implemented as a sorted array.
 *
 * @module
 *
 * @note
 *
 * All input arrays must be pre-sorted according to the provided comparison function (`Cmp<T>`).
 * The correctness of these functions depend on this requirement.
 *
 * @example
 *
 * ```js
 * import { union, intersect, has } from './module.f.mjs'
 *
 * const cmp = (a: number) => (b: number) => a < b ? -1 : a > b ? 1 : 0
 *
 * const setA = [1, 3, 5]
 * const setB = [3, 4, 5]
 *
 * const unionSet = union(cmp)(setA)(setB) // [1, 3, 4, 5]
 *
 * const intersectionSet = intersect(cmp)(setA)(setB) // [3, 5]
 *
 * has(cmp)(3)(setA) // true
 * has(cmp)(2)(setA) // false
 * ```
 *
 * @import { Cmp } from '../function/compare/types.ts'
 * @import { SortedSet } from './types.ts'
 */

import { toArray } from "../list/module.f.mjs"
import { merge, intersect as listIntersect, find } from '../sorted_list/module.f.mjs'

export const union =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {(a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>}
     */
    cmp => a => b => toArray(merge(cmp)(a)(b))

export const intersect =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {(a: SortedSet<T>) => (b: SortedSet<T>) => SortedSet<T>}
     */
    cmp => a => b => toArray(listIntersect(cmp)(a)(b))

export const has =
    /**
     * @template T
     * @param {Cmp<T>} cmp
     * @returns {(value: T) => (set: SortedSet<T>) => boolean}
     */
    cmp => value => set => find(cmp)(value)(set) === value

/** @type {(s: string) => string} */
const lengthPrefixed = s => `${s.length}:${s}`

/**
 * A canonical key for a set of strings: equal sets always produce the same
 * key, and unequal sets never produce the same one. Useful wherever a set has
 * to index a `StringMap` — the subset construction in `fjs/fsm`, say.
 *
 * Each element is written length-prefixed (`3:abc`) and the parts are
 * concatenated. Joining on a separator would **not** be canonical: elements
 * are arbitrary strings, so `['a,b']` and `['a', 'b']` would both produce
 * `a,b` and two different sets would share one key. A length prefix is
 * readable back — take the digits, the `:`, then exactly that many code
 * units — so the encoding is injective without an escaping table.
 *
 * The key is canonical for the *set* only because `SortedSet` is sorted:
 * element order is fixed by the set's own invariant, not by this function.
 *
 * @type {(set: SortedSet<string>) => string}
 */
export const toKey = set => set.map(lengthPrefixed).join('')
