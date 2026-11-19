import { assertEq } from '../../../asserts/module.f.js'
import { size } from './module.f.js'

export const proof = /** @type {const} */ ({
    // A leaf of any kind is one node, `null` among them.
    leaf: () => {
        for (const value of [0, 'text', true, null, undefined, 7n, () => 0]) { assertEq(size(value), 1) }
    },
    // A container is one node more than what it holds.
    array: () => {
        assertEq(size([]), 1)
        assertEq(size([1, 2, 3]), 4)
        assertEq(size([[1], [2, [3]]]), 7)
    },
    object: () => {
        assertEq(size({}), 1)
        assertEq(size({ a: 1, b: [2, 3] }), 5)
    },
    // A shared value is counted where it stands, each time.
    shared: () => {
        /** @type {readonly number[]} */
        const pair = [1, 2]
        assertEq(size([pair, pair]), 7)
    },
})
