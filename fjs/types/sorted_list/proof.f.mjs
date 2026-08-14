/**
 * @import { Unknown } from '../../media/json/types.ts'
 */

import { find, merge } from './module.f.mjs'
import { stringify } from '../../media/json/module.f.mjs'
import { sort } from '../object/module.f.mjs'
import { toArray, countdown, length } from '../list/module.f.mjs'
import { flip } from '../function/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(a: readonly Unknown[]) => string} */
const str = stringify(sort)

const reverseCmp = flip(cmp)

export const proof = {
    sortedMergre: [
        () => {
            const result = str(toArray(merge(cmp)([2, 3, 4])([1, 3, 5])))
            assertEq(result, '[1,2,3,4,5]')
        },
        () => {
            const result = str(toArray(merge(cmp)([1, 2, 3])([])))
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
        }
    ]
}
