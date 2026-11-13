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
 * @import { Monoid } from '../../common/monoid/types.ts'
 * @import { PersistentSet } from './types.ts'
 */

import { runs, step } from '../../common/monoid/module.f.js'
import { flatMap, map, someBy } from '../list/module.f.js'
import { toArray } from '../list/alt/module.f.js'
import { sum } from '../number/module.f.js'

/** The set with nothing in it. @type {PersistentSet<never>} */
export const empty = null

/**
 * The union of two disjoint `Set`s, under which a run weighs its size. One
 * monoid serves every element type, since none of it reads an element.
 *
 * @type {Monoid<ReadonlySet<unknown>>}
 */
const union = {
    identity: new Set(),
    operation: a => b => new Set([...a, ...b]),
    weight: s => s.size,
}

/**
 * Pushes a run onto the stack, merging the two runs beneath it by
 * {@link union} wherever the second is no larger than it. The step is built
 * once, here, and the cast gives it back the element type that {@link union}
 * does without.
 *
 * @type {<T>(run: ReadonlySet<T>) => (set: PersistentSet<T>) => PersistentSet<T>}
 */
const carry = /** @type {<T>(run: ReadonlySet<T>) => (set: PersistentSet<T>) => PersistentSet<T>} */ (step(union))

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
     * carried like a binary counter one push late, so the stack is at most
     * twice the binary length of the size.
     *
     * @template T
     * @param {T} value
     * @returns {(set: PersistentSet<T>) => PersistentSet<T>}
     */
    value => set => has(value)(set) ? set : carry(new Set([value]))(set)

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
