import { at, first, last, head, tail, splitFirst, splitLast, empty } from './module.f.ts'
import { stringify as jsonStringify } from '../../media/json/module.f.ts'
import { sort } from '../object/module.f.ts'
import { assertEq, assertNotNullish } from '../../asserts/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    stringify: () => {
        const result = stringify([1, 20, 300])
        assertEq(result, '[1,20,300]')
    },
    at: [
        () => {
            const result = at(2)([1, 20, 300])
            assertEq(result, 300)
        },

        () => {
            const result = at(3)([1, 20, 300])
            assertEq(result, null)
        }
    ],
    first: [
        () => {
            const result = first([1, 20, 300])
            assertEq(result, 1)
        },
        () => {
            const result = first([])
            assertEq(result, null)
        }
    ],
    last: [
        () => {
            const result = last([1, 20, 300])
            assertEq(result, 300)
        },
        () => {
            const result = last([])
            assertEq(result, null)
        }
    ],
    head: [
        () => {
            const result = assertNotNullish(head([1, 20, 300]))
            const str = stringify(result)
            assertEq(str, '[1,20]')
        },
        () => {
            const result = head([])
            assertEq(result, null)
        }
    ],
    tail: [
        () => {
            const result = tail([1, 20, 300])
            const str = stringify(result)
            assertEq(str, '[20,300]')
        },
        () => {
            const result = tail([])
            assertEq(result, null)
        }
    ],

    splitFirst: [
        () => {
            const result = splitFirst([1, 20, 300])
            const str = stringify(result)
            assertEq(str, '[1,[20,300]]')
        },
        () => {
            const result = splitFirst([])
            assertEq(result, null)
        },
    ],
    splitLast: [
        () => {
            const result = splitLast([1, 20, 300])
            const str = stringify(result)
            assertEq(str, '[[1,20],300]')
        },
        () => {
            const result = splitLast([])
            assertEq(result, null)
        }
    ],
    empty: () => {
        const x = empty
        const a: readonly number[] = x
        const b: readonly string[] = x
        const c = [...a, ...b, ...x]
        assertEq(c.length, 0, c)
    }
}
