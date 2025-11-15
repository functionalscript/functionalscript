import { has, intersect, union } from './module.f.ts'
import { stringify, type Unknown } from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { toArray, countdown, length } from '../list/module.f.ts'
import { flip } from '../function/module.f.ts'
import { cmp } from '../number/module.f.ts'

const str: (a: readonly Unknown[]) => string
    = a => stringify(sort)(a)

const reverseCmp = flip(cmp)

export default {
    example: () => {
        const cmp = (a: number) => (b: number) => a < b ? -1 : a > b ? 1 : 0

        const setA = [1, 3, 5]
        const setB = [3, 4, 5]

        const unionSet = union(cmp)(setA)(setB) // [1, 3, 4, 5]
        if (str(unionSet) !== '[1,3,4,5]') { throw 0 }

        const intersectionSet = intersect(cmp)(setA)(setB) // [3, 5]
        if (str(intersectionSet) !== '[3,5]') { throw 1 }

        if (!has(cmp)(3)(setA)) { throw 2 }
        if (has(cmp)(2)(setA)) { throw 3 }
    },
    union: [
        () => {
            const result = str(toArray(union(cmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = str(toArray(union(cmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const sortedSet = toArray(countdown(n))
            const result = union(reverseCmp)(sortedSet)(sortedSet)
            const len = length(result)
            if (len != n) { throw result }
        }
    ],
    intersect: [
        () => {
            const result = str(toArray(intersect(cmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[3]') { throw result }
        },
        () => {
            const result = str(toArray(intersect(cmp)([1, 2, 3])([])))
            if (result !== '[]') { throw result }
        }
    ],
    has: [
        () => {
            const result = has(cmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        },
        () => {
            const result = has(cmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = has(cmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = has(cmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        }
    ]
}
