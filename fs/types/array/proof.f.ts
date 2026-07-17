import { at, first, last, head, tail, splitFirst, splitLast, empty } from './module.f.ts'
import { stringify as jsonStringify } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    stringify: () => {
        const result = stringify([1, 20, 300])
        assert(result === '[1,20,300]', result)
    },
    at: [
        () => {
            const result = at(2)([1, 20, 300])
            assert(result === 300, result)
        },

        () => {
            const result = at(3)([1, 20, 300])
            assert(result === null, result)
        }
    ],
    first: [
        () => {
            const result = first([1, 20, 300])
            assert(result === 1, result)
        },
        () => {
            const result = first([])
            assert(result === null, result)
        }
    ],
    last: [
        () => {
            const result = last([1, 20, 300])
            assert(result === 300, result)
        },
        () => {
            const result = last([])
            assert(result === null, result)
        }
    ],
    head: [
        () => {
            const result = head([1, 20, 300])
            assert(result !== null, result)
            const str = stringify(result)
            assert(str === '[1,20]', str)
        },
        () => {
            const result = head([])
            assert(result === null, result)
        }
    ],
    tail: [
        () => {
            const result = tail([1, 20, 300])
            const str = stringify(result)
            assert(str === '[20,300]', str)
        },
        () => {
            const result = tail([])
            assert(result === null, result)
        }
    ],

    splitFirst: [
        () => {
            const result = splitFirst([1, 20, 300])
            const str = stringify(result)
            assert(str === '[1,[20,300]]', str)
        },
        () => {
            const result = splitFirst([])
            assert(result === null, result)
        },
    ],
    splitLast: [
        () => {
            const result = splitLast([1, 20, 300])
            const str = stringify(result)
            assert(str === '[[1,20],300]', str)
        },
        () => {
            const result = splitLast([])
            assert(result === null, result)
        }
    ],
    empty: () => {
        const x = empty
        const a: readonly number[] = x
        const b: readonly string[] = x
        const c = [...a, ...b, ...x]
        assert(c.length === 0, c)
    }
}
