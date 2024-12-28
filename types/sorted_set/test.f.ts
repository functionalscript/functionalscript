import { has, intersect, union } from './module.f.ts'
import { type Sign, unsafeCmp } from '../function/compare/module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { toArray, countdown, length } from '../list/module.f.ts'
import { flip } from '../function/module.f.ts'

const stringify: (a: readonly json.Unknown[]) => string
    = a => json.stringify(sort)(a)

const reverseCmp: <T>(a: T) => (b: T) => Sign
    = flip(unsafeCmp)

export default {
    example: () => {
        const cmp = (a: number) => (b: number) => a < b ? -1 : a > b ? 1 : 0

        const setA = [1, 3, 5]
        const setB = [3, 4, 5]

        const unionSet = union(cmp)(setA)(setB) // [1, 3, 4, 5]
        if (stringify(unionSet) !== '[1,3,4,5]') { throw 0 }

        const intersectionSet = intersect(cmp)(setA)(setB) // [3, 5]
        if (stringify(intersectionSet) !== '[3,5]') { throw 1 }

        if (!has(cmp)(3)(setA)) { throw 2 }
        if (has(cmp)(2)(setA)) { throw 3 }
    },
    union: [
        () => {
            const result = stringify(toArray(union(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(toArray(union(unsafeCmp)([1, 2, 3])([])))
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
            const result = stringify(toArray(intersect(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[3]') { throw result }
        },
        () => {
            const result = stringify(toArray(intersect(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[]') { throw result }
        }
    ],
    has: [
        () => {
            const result = has(unsafeCmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        },
        () => {
            const result = has(unsafeCmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = has(unsafeCmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = has(unsafeCmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        }
    ]
}
