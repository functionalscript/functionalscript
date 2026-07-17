import { find, merge } from './module.f.ts'
import { stringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { toArray, countdown, length } from '../list/module.f.ts'
import { flip } from '../function/module.f.ts'
import { cmp } from '../number/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const str: (a: readonly Unknown[]) => string
    = stringify(sort)

const reverseCmp = flip(cmp)

export const proof = {
    sortedMergre: [
        () => {
            const result = str(toArray(merge(cmp)([2, 3, 4])([1, 3, 5])))
            assert(result === '[1,2,3,4,5]', result)
        },
        () => {
            const result = str(toArray(merge(cmp)([1, 2, 3])([])))
            assert(result === '[1,2,3]', result)
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
            assert(result === 0, result)
        },
        () => {
            const result = find(cmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assert(result === null, result)
        },
        () => {
            const result = find(cmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assert(result === null, result)
        },
        () => {
            const result = find(cmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            assert(result === 80, result)
        }
    ]
}
