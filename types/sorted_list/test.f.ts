import { find, merge } from './module.f.ts'
import { stringify, type Unknown } from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { toArray, countdown, length } from '../list/module.f.ts'
import { flip } from '../function/module.f.ts'
import { cmp } from '../number/module.f.ts'

const str: (a: readonly Unknown[]) => string
    = stringify(sort)

const reverseCmp = flip(cmp)

export default {
    sortedMergre: [
        () => {
            const result = str(toArray(merge(cmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = str(toArray(merge(cmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const list = countdown(n)
            const result = merge(reverseCmp)(list)(list)
            const len = length(result)
            if (len != n) { throw result }
        }
    ],
    find: [
        () => {
            const result = find(cmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 0) { throw result }
        },
        () => {
            const result = find(cmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = find(cmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = find(cmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 80) { throw result }
        }
    ]
}
