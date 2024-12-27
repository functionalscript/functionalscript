import * as _ from './module.f.ts'
import { type Sign, unsafeCmp } from '../function/compare/module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { toArray, countdown, length } from '../list/module.f.ts'
import { flip } from '../function/module.f.ts'

const stringify
    : (a: readonly json.Unknown[]) => string
    = json.stringify(sort)

const reverseCmp
    : <T>(a: T) => (b: T) => Sign
    = flip(unsafeCmp)

export default {
    sortedMergre: [
        () => {
            const result = stringify(toArray(_.merge(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.merge(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const list = countdown(n)
            const result = _.merge(reverseCmp)(list)(list)
            const len = length(result)
            if (len != n) { throw result }
        }
    ],
    find: [
        () => {
            const result = _.find(unsafeCmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 0) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== null) { throw result }
        },
        () => {
            const result = _.find(unsafeCmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result !== 80) { throw result }
        }
    ]
}
