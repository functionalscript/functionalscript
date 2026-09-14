/**
 * @import { PersistentSet } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { add, empty, has, size, values } from './module.f.mjs'

/** The set of the first `n` naturals, added in order. @type {(n: number) => PersistentSet<number>} */
const naturals = n => Array.from({ length: n }, (_, i) => i).reduce((set, i) => add(i)(set), /** @type {PersistentSet<number>} */ (empty))

/**
 * The layout invariant: the entry at index `k` holds exactly `2^k` values or
 * nothing, so the entries spell the size in binary.
 *
 * @type {(set: PersistentSet<unknown>) => void}
 */
const wellFormed = set => set.forEach((entry, k) => assert(entry === null || entry.size === 2 ** k, `entry ${k}`))

export const proof = {
    empty: () => {
        assertEq(size(empty), 0)
        assertEq(has(1)(empty), false)
        assertEq(values(empty).length, 0)
    },
    // Adding carries like a binary counter: 1 = `1`, 2 = `10`, 3 = `11`,
    // 4 = `100`, and a value added is a value held, at every size on the
    // way.
    carries: () => {
        const one = add(0)(empty)
        assertStructurallySame(one.map(entry => entry === null ? 0 : entry.size), [1])
        const two = add(1)(one)
        assertStructurallySame(two.map(entry => entry === null ? 0 : entry.size), [0, 2])
        const three = add(2)(two)
        assertStructurallySame(three.map(entry => entry === null ? 0 : entry.size), [1, 2])
        const four = add(3)(three)
        assertStructurallySame(four.map(entry => entry === null ? 0 : entry.size), [0, 0, 4])
        for (let n = 0; n <= 70; n += 1) {
            const set = naturals(n)
            wellFormed(set)
            assertEq(size(set), n)
            assertStructurallySame(values(set).toSorted((a, b) => a - b), Array.from({ length: n }, (_, i) => i))
            for (let i = 0; i < n; i += 1) { assert(has(i)(set), `${i} in ${n}`) }
            assert(!has(n)(set), `${n} not in ${n}`)
        }
    },
    // Persistence: an add leaves the set it was given as it was.
    persistent: () => {
        const three = naturals(3)
        const four = add(3)(three)
        assertEq(size(three), 3)
        assertEq(has(3)(three), false)
        assertEq(has(3)(four), true)
    },
    // Adding what is already there is the same set, not a copy, so the
    // layout stays the size's binary representation.
    present: () => {
        const set = naturals(5)
        assert(add(2)(set) === set)
        assert(add(4)(set) === set)
    },
    // `Set`'s equality: objects by identity, `NaN` equal to itself, `-0`
    // equal to `0`.
    equality: () => {
        const a = {}
        /** @type {(value: unknown) => (set: PersistentSet<unknown>) => PersistentSet<unknown>} */
        const put = add
        /** @type {(value: unknown) => (set: PersistentSet<unknown>) => boolean} */
        const holds = has
        const set = put(NaN)(put(a)(put(0)(empty)))
        assert(holds(a)(set))
        assert(!holds({})(set))
        assert(holds(NaN)(set))
        assert(holds(-0)(set))
        assert(put(-0)(set) === set)
    },
    // The add is a logarithm amortized, not the whole set: 20,000 adds are
    // a few tens of milliseconds where copying the set each time is seconds.
    // Pinned as the invariant at that size rather than as a timing.
    large: () => {
        const n = 20000
        const set = naturals(n)
        wellFormed(set)
        assertEq(size(set), n)
        assertEq(set.length, 15)
        assert(has(n - 1)(set))
        assert(!has(n)(set))
    },
}
