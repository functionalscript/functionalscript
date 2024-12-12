import _ from './module.f.mjs'
import * as compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare
import * as json from '../../json/module.f.mjs'
import object from '../object/module.f.mjs'
const { sort } = object
import * as list from '../list/module.f.mjs'
const { toArray, countdown, length } = list
import * as Map from '../map/module.f.mjs'
import * as f from '../function/module.f.mjs'
const { flip } = f

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

/** @type {<T>(a: T) => (b: T) => Map.Sign} */
const reverseCmp = flip(unsafeCmp)

export default {
    union: [
        () => {
            const result = stringify(toArray(_.union(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[1,2,3,4,5]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.union(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[1,2,3]') { throw result }
        },
        () => {
            const n = 10_000
            const sortedSet = toArray(countdown(n))
            const result = _.union(reverseCmp)(sortedSet)(sortedSet)
            const len = length(result)
            if (len != n) { throw result }
        }
    ],
    intersect: [
        () => {
            const result = stringify(toArray(_.intersect(unsafeCmp)([2, 3, 4])([1, 3, 5])))
            if (result !== '[3]') { throw result }
        },
        () => {
            const result = stringify(toArray(_.intersect(unsafeCmp)([1, 2, 3])([])))
            if (result !== '[]') { throw result }
        }
    ],
    has: [
        () => {
            const result = _.has(unsafeCmp)(0)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(3)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(77)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (result) { throw result }
        },
        () => {
            const result = _.has(unsafeCmp)(80)([0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
            if (!result) { throw result }
        }
    ]
}