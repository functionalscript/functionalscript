import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { concat } from './module.f.js'

export const proof = /** @type {const} */ ({
    host: () => {
        /** @type {readonly (readonly [readonly unknown[], readonly unknown[]])[]} */
        const cases = [
            [[], []],
            [[1, 2], []],
            [[], [undefined]],
            [[1], [[], [2, 3], 4, [5], []]],
            [[[1]], [[[2]], 'abc', { 0: 'x', length: 1 }]],
            [[NaN, -0], [null, false, 0n, 1n, '', undefined]],
        ]
        for (const [self, items] of cases) {
            assertStructurallySame(concat(self, ...items), self.concat(...items))
        }
    },
    fresh: () => {
        const item = /** @type {const} */ ({ value: 1 })
        const fn = () => 2
        const self = /** @type {const} */ ([item, fn])
        const result = concat(self)
        assertEq(result === self, false)
        assertEq(result[0], item)
        assertEq(result[1], fn)
        assertEq(concat([]) === concat([]), false)
    },
    oneLevel: () => {
        const first = /** @type {const} */ ([1])
        const second = /** @type {const} */ ([2])
        const self = /** @type {const} */ ([first])
        const items = /** @type {const} */ ([second])
        const result = concat(self, items)
        assertStructurallySame(result, [[1], [2]])
        assertEq(result[0], first)
        assertEq(result[1], second)
        assertStructurallySame(self, [[1]])
        assertStructurallySame(items, [[2]])
    },
    noCoercion: () => {
        const value = /** @type {const} */ ({
            valueOf: () => { throw 'valueOf must not run' },
            toString: () => { throw 'toString must not run' },
        })
        const result = concat([], value, 'ab')
        assertEq(result.length, 2)
        assertEq(result[0], value)
        assertEq(result[1], 'ab')
    },
})
