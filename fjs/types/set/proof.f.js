/** @import { PersistentSet } from './types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { generate } from '../array/generate/module.f.js'
import { add, empty, fromValues, has, size, values } from './module.f.js'

export const proof = /** @type {const} */ ({
    empty: () => {
        assertEq(size(empty), 0)
        assert(!has(1)(empty))
        assertStructurallySame(values(empty), [])
        assert(fromValues([]) === empty)
    },
    stableOrder: () => {
        const set = fromValues([3, 1, 3, 2, 1, 4])
        assertStructurallySame(values(set), [3, 1, 2, 4])
        assertEq(size(set), 4)
        assert(add(3)(set) === set)
        assert(add(4)(set) === set)
        assertStructurallySame(values(add(0)(set)), [3, 1, 2, 4, 0])
    },
    persistent: () => {
        const one = add(1)(empty)
        const two = add(2)(one)
        assertEq(size(one), 1)
        assert(!has(2)(one))
        assert(has(2)(two))
        assertStructurallySame(values(one), [1])
        assertStructurallySame(values(two), [1, 2])
    },
    equality: () => {
        const a = /** @type {const} */ ({ index: 1 })
        const alike = /** @type {const} */ ({ index: 1 })
        const array = /** @type {const} */ ([])
        const fn = () => 1
        /** @type {unknown} */
        const absent = { index: 1 }
        /** @type {readonly unknown[]} */
        const input = [a, a, alike, array, fn, fn, undefined, null, false, true, 1, 1n, '1', NaN, NaN, -0, 0]
        const set = fromValues(input)
        assertEq(size(set), 13)
        assertStructurallySame(values(set), [a, alike, array, fn, undefined, null, false, true, 1, 1n, '1', NaN, 0])
        for (const value of input) { assert(has(value)(set)); assert(add(value)(set) === set) }
        assert(!has(absent)(set))
        assert(Object.is(values(set)[12], 0))
        const zero = fromValues([-0, 0])
        assertEq(size(zero), 1)
        assert(Object.is(values(zero)[0], 0))
    },
    large: () => {
        const input = generate(20_000, i => i)
        const set = fromValues([...input, ...input])
        assertEq(size(set), input.length)
        assertStructurallySame(values(set), input)
        assert(has(19_999)(set))
        assert(!has(20_000)(set))
    },
})
