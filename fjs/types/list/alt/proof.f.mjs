/**
 * @import { Unknown } from '../../../media/json/types.ts'
 * @import { List } from '../types.ts'
 */

import { toArray } from './module.f.js'
import { concat, countdown, map } from '../module.f.js'
import { stringifySorted } from '../../../media/json/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'

/** @type {(list: List<Unknown>) => string} */
const str = list => stringifySorted(toArray(list))

export const proof = /** @type {const} */ ({
    empty: () => {
        assertEq(str(null), '[]')
        assertEq(str(() => () => null), '[]')
    },
    /** An array, or a thunk's array, comes back itself. */
    array: () => {
        /** @type {readonly number[]} */
        const a = [1, 2, 3]
        assert(toArray(a) === a)
        assert(toArray(() => a) === a)
        assertEq(str([]), '[]')
    },
    soleChunk: () => {
        const a = /** @type {const} */ ([1, 2, 3])
        assert(toArray(concat(null)(a)) === a)
        assert(toArray(concat(() => null)(() => a)) === a)
        assert(toArray(concat(() => a)(() => null)) === a)
    },
    emptyArray: () => {
        const a = /** @type {const} */ ([])
        assert(toArray(a) === a)
        assert(toArray(() => a) === a)
        assert(toArray(concat(() => null)(a)) === a)
    },
    freshEmpty: () => {
        assert(toArray(null) !== toArray(null))
        assert(toArray(() => null) !== toArray(() => null))
        const a = /** @type {const} */ ([])
        const b = /** @type {const} */ ([])
        const chunks = concat(a)(b)
        const result = toArray(chunks)
        assertStructurallySame(result, [])
        assert(result !== a)
        assert(result !== b)
        assert(result !== toArray(chunks))
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
    chunks: () => {
        /** @type {readonly number[]} */
        const a = [1, 2]
        /** @type {readonly number[]} */
        const b = [3, 4]
        /** @type {readonly number[]} */
        const empty = []
        const result = toArray(concat(empty)(concat(a)(concat(empty)(concat(b)(empty)))))
        assertStructurallySame(result, [1, 2, 3, 4])
        assert(result !== a)
        assert(result !== b)
    },
    unequalChunks: () => assertStructurallySame(
        toArray(concat([1])(concat([2, 3, 4])([5, 6]))),
        [1, 2, 3, 4, 5, 6]),
    skewedChunks: () => {
        const large = Array.from({ length: 256 }, (_, i) => i)
        assertStructurallySame(toArray(concat([-1])(concat(large)([-2]))), [-1, ...large, -2])
    },
    decreasingChunks: () => assertStructurallySame(
        toArray(concat([0, 1, 2, 3, 4, 5, 6, 7])(concat([8, 9, 10, 11])(concat([12, 13])([14])))),
        Array.from({ length: 15 }, (_, i) => i)),
    nullish: () => {
        /** @type {readonly (number | null | undefined)[]} */
        const first = [null, undefined]
        assertStructurallySame(
            toArray(concat(first)({ first: 0, tail: [undefined, null] })),
            [null, undefined, 0, undefined, null])
    },
    /** Materializing a long lazy cons list retains every item in order. */
    long: () => {
        const n = /** @type {const} */ (20_000)
        const result = toArray(countdown(n))
        assertEq(result.length, n)
        assertEq(result[0], n - 1)
        assertEq(result[n - 1], 0)
    },
    /** A concatenation nested `n` deep, as the DataJS parser builds one, is walked without recursion. */
    deep: () => {
        const n = /** @type {const} */ (8_000)
        /** @type {List<number>} */
        let left = null
        /** @type {List<number>} */
        let right = null
        for (let i = 0; i < n; i += 1) {
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
})
