/**
 * A persistent set with `Set`'s equality and a logarithmic add.
 *
 * `new Set([...prev, value])` is the immutable idiom for adding to a set,
 * and it copies the whole set on every add, which is quadratic over a
 * sequence of them. This set keeps `Set`'s equality — `SameValueZero`, so
 * objects by identity — and amortizes the add to a logarithm by holding the
 * elements in `Set`s whose sizes are the bits of the set's size, merged
 * like a binary counter carries ([`./types.ts`](./types.ts)). Membership
 * asks each of those `Set`s, of which there are at most `log2(n) + 1`.
 *
 * ```js
 * import { add, empty, has } from './module.f.mjs'
 *
 * const a = {}
 * const set = add(a)(add(1)(empty))
 * has(a)(set)   // true
 * has({})(set)  // false, another object
 * add(a)(set) === set  // true: adding what is there is the same set
 * ```
 *
 * @module
 *
 * @import { PersistentSet } from './types.ts'
 */

import { runs, step } from '../../common/monoid/module.f.mjs'
import { flatMap, map, someBy, toArray } from '../list/module.f.mjs'
import { sum } from '../number/module.f.mjs'

/** The set with nothing in it. @type {PersistentSet<never>} */
export const empty = null

/**
 * The union of two disjoint `Set`s: the merge that carries one run into the
 * next.
 *
 * @type {<T>(a: ReadonlySet<T>) => (b: ReadonlySet<T>) => ReadonlySet<T>}
 */
const union = a => b => new Set([...a, ...b])

export const has =
    /**
     * Whether the set holds the value, by `Set`'s equality.
     *
     * @template T
     * @param {T} value
     * @returns {(set: PersistentSet<T>) => boolean}
     */
    value => set => someBy((/** @type {ReadonlySet<T>} */ run) => run.has(value))(runs(set))

export const add =
    /**
     * The set with the value in it: the same set where it already was, and
     * otherwise the value pushed onto the run stack as a one-element `Set`,
     * carried like a binary counter.
     *
     * @template T
     * @param {T} value
     * @returns {(set: PersistentSet<T>) => PersistentSet<T>}
     */
    value => set => has(value)(set) ? set : step(union)(new Set([value]))(set)

export const size =
    /**
     * How many values the set holds.
     *
     * @template T
     * @param {PersistentSet<T>} set
     * @returns {number}
     */
    set => sum(map((/** @type {ReadonlySet<T>} */ run) => run.size)(runs(set)))

export const values =
    /**
     * The values the set holds, in no particular order.
     *
     * @template T
     * @param {PersistentSet<T>} set
     * @returns {readonly T[]}
     */
    set => toArray(flatMap((/** @type {ReadonlySet<T>} */ run) => [...run])(runs(set)))
