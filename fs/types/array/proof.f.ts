import { at, first, last, head, tail, splitFirst, splitLast, empty } from './module.f.ts'
import { stringify as jsonStringify } from '../../json/module.f.ts'
import { sort } from '../object/module.f.ts'

const stringify = jsonStringify(sort)

export default {
    stringify: () => {
        const result = stringify([1, 20, 300])
        if (result !== '[1,20,300]') { throw result }
    },
    at: [
        () => {
            const result = at(2)([1, 20, 300])
            if (result !== 300) { throw result }
        },

        () => {
            const result = at(3)([1, 20, 300])
            if (result !== null) { throw result }
        }
    ],
    first: [
        () => {
            const result = first([1, 20, 300])
            if (result !== 1) { throw result }
        },
        () => {
            const result = first([])
            if (result !== null) { throw result }
        }
    ],
    last: [
        () => {
            const result = last([1, 20, 300])
            if (result !== 300) { throw result }
        },
        () => {
            const result = last([])
            if (result !== null) { throw result }
        }
    ],
    head: [
        () => {
            const result = head([1, 20, 300])
            if (result === null) { throw result }
            const str = stringify(result)
            if (str !== '[1,20]') { throw str }
        },
        () => {
            const result = head([])
            if (result !== null) { throw result }
        }
    ],
    tail: [
        () => {
            const result = tail([1, 20, 300])
            const str = stringify(result)
            if (str !== '[20,300]') { throw str }
        },
        () => {
            const result = tail([])
            if (result !== null) { throw result }
        }
    ],

    splitFirst: [
        () => {
            const result = splitFirst([1, 20, 300])
            const str = stringify(result)
            if (str !== '[1,[20,300]]') { throw str }
        },
        () => {
            const result = splitFirst([])
            if (result !== null) { throw result }
        },
    ],
    splitLast: [
        () => {
            const result = splitLast([1, 20, 300])
            const str = stringify(result)
            if (str !== '[[1,20],300]') { throw str }
        },
        () => {
            const result = splitLast([])
            if (result !== null) { throw result }
        }
    ],
    empty: () => {
        const x = empty
        const a: readonly number[] = x
        const b: readonly string[] = x
        const c = [...a, ...b, ...x]
        if (c.length !== 0) { throw c }
    }
}
