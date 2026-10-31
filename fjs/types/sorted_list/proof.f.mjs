import { find, intersect, merge } from './module.f.mjs'
import { stringifySorted } from '../../media/json/module.f.mjs'
import { countdown, length } from '../list/module.f.js'
import { toArray } from '../list/alt/module.f.js'
import { flip } from '../function/module.f.js'
import { cmp } from '../number/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'

const reverseCmp = flip(cmp)

export const proof = /** @type {const} */ ({
    sortedMergre: [
        () => {
            const result = stringifySorted(toArray(merge(cmp)([2, 3, 4])([1, 3, 5])))
            assertEq(result, '[1,2,3,4,5]')
        },
        () => {
            const result = stringifySorted(toArray(merge(cmp)([1, 2, 3])([])))
            assertEq(result, '[1,2,3]')
        },
        () => {
            const n = 10_000
            const list = countdown(n)
            const result = merge(reverseCmp)(list)(list)
            const len = length(result)
            assert(len == n, result)
        }
    ],
    intersect: () => {
        assertStructurallySame(toArray(intersect(cmp)([1, 3, 4, 5])([2, 3, 5, 6])), [3, 5])
        assertStructurallySame(toArray(intersect(cmp)([])([1, 2])), [])
        assertStructurallySame(toArray(intersect(cmp)([1, 2])([])), [])
    },
    find: [
        () => {
            const result = find(cmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assertEq(result, 0)
        },
        () => {
            const result = find(cmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assertEq(result, null)
        },
        () => {
            const result = find(cmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assertEq(result, null)
        },
        () => {
            const result = find(cmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assertEq(result, 80)
        },
        () => {
            assertEq(find(cmp)(100)([0, 10, 20]), null)
            assertEq(find(cmp)(0)([]), null)
        }
    ]
})
