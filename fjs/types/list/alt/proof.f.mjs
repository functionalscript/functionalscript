/**
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { List } from '../types.ts'
 */

import { toArray } from './module.f.mjs'
import { concat, countdown, map } from '../module.f.mjs'
import { stringifySorted } from '../../../media/json/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.js'

/** @type {(list: List<Unknown>) => string} */
const str = list => stringifySorted(toArray(list))

export const proof = {
    empty: () => {
        assertEq(str(null), '[]')
        assertEq(str(() => () => null), '[]')
    },
    /** An array, or a thunk's array, comes back itself. */
    array: () => {
        const a = [1, 2, 3]
        assert(toArray(a) === a)
        assert(toArray(() => a) === a)
        assertEq(str([]), '[]')
    },
    cons: () => {
        assertEq(str({ first: 1, tail: { first: 2, tail: () => [3] } }), '[1,2,3]')
        assertEq(str(map((/** @type {number} */ x) => x + 1)([1, 2])), '[2,3]')
    },
    concat: () => {
        assertEq(str(concat([1, 2])([3])), '[1,2,3]')
        assertEq(str(concat([1])([2, 3])), '[1,2,3]')
        assertEq(str(concat(null)([1])), '[1]')
        /** @type {List<number>} */
        const none = []
        assertEq(str(concat(concat([1])({ first: 2, tail: null }))(concat(none)([3]))), '[1,2,3]')
    },
    /** Items are copied `log2(n)` times at most, so this takes milliseconds. */
    long: () => {
        const n = 20_000
        const result = toArray(countdown(n))
        assertEq(result.length, n)
        assertEq(result[0], n - 1)
        assertEq(result[n - 1], 0)
    },
    /** A concatenation nested `n` deep, as the DataJS parser builds one, is walked without recursion. */
    deep: () => {
        const n = 8_000
        /** @type {List<number>} */
        let left = null
        /** @type {List<number>} */
        let right = null
        for (let i = 0; i < n; ++i) {
            left = concat(left)([i])
            right = concat([i])(right)
        }
        const l = toArray(left)
        assertEq(l.length, n)
        assertEq(l[0], 0)
        assertEq(l[n - 1], n - 1)
        const r = toArray(right)
        assertEq(r.length, n)
        assertEq(r[0], n - 1)
        assertEq(r[n - 1], 0)
    },
}
