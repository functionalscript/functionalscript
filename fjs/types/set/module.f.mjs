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

/** The set with nothing in it. @type {PersistentSet<never>} */
export const empty = []

export const has =
    /**
     * Whether the set holds the value, by `Set`'s equality.
     *
     * @template T
     * @param {T} value
     * @returns {(set: PersistentSet<T>) => boolean}
     */
    value => set => set.some(entry => entry !== null && entry.has(value))

export const add =
    /**
     * The set with the value in it: the same set where it already was, and
     * otherwise the value carried into the first empty entry, every full
     * entry on the way merged into what is carried.
     *
     * @template T
     * @param {T} value
     * @returns {(set: PersistentSet<T>) => PersistentSet<T>}
     */
    value => set => {
        if (has(value)(set)) { return set }
        /** @type {ReadonlySet<T>} */
        let carry = new Set([value])
        let i = 0
        while (i < set.length) {
            const entry = set[i]
            if (entry === null) { break }
            carry = new Set([...entry, ...carry])
            i += 1
        }
        return [...set.slice(0, i).map(() => null), carry, ...set.slice(i + 1)]
    }

export const size =
    /**
     * How many values the set holds.
     *
     * @template T
     * @param {PersistentSet<T>} set
     * @returns {number}
     */
    set => set.reduce((n, entry) => n + (entry === null ? 0 : entry.size), 0)

export const values =
    /**
     * The values the set holds, in no particular order.
     *
     * @template T
     * @param {PersistentSet<T>} set
     * @returns {readonly T[]}
     */
    set => set.flatMap(entry => entry === null ? [] : [...entry])
