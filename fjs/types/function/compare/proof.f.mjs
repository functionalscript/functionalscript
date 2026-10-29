import { bsearch, cmp, index3, index5, min, max } from './module.f.js'
import { assertEq } from '../../../asserts/module.f.js'

export const proof = () => {
    {
        for (const key of [0, 1, 2]) { assertEq(index3(cmp(key))(1), key) }
        for (const key of [1, 2, 3, 4, 5]) { assertEq(index5(cmp(key))([2, 4]), key - 1) }
    }
    {
        assertEq(bsearch(0)(() => 0), 0)
        for (const [key, expected] of [[-1, 0], [0, 0], [1, 1], [2, 1], [3, 2], [8, 4], [9, 5]]) {
            assertEq(bsearch(5)(mid => cmp(key)(mid * 2)), expected)
        }
    }
    {
        const result = cmp(true)(false)
        assertEq(result, 1)
        const _ = true < false
    }
    {
        const result = cmp(1)(2)
        assertEq(result, -1)
        const _ = 1 < 2
    }
    {
        const result = cmp(2n)(-10n)
        assertEq(result, 1)
        const _ = 2n < -10n
    }
    {
        const result = cmp("hello")("hello")
        assertEq(result, 0)
        const _ = "hello" < "hello"
    }
    {
        // const result = cmp(true)("hello") // compilation error
        /** @type {string | number} */
        const a = "hello"
        /** @type {string | number} */
        const b = 5
        // const _ = cmp(a)(b) // compilation error
        const _ = cmp(a)("hello") // ??? TypeScript changes a type definition of `a`.
        // const f = (a: string|number, b: string|number) => cmp(a)(b) // compilation error
        // const f = (a: number, b: string|number) => cmp(a)(b) // compilation error
    }
    {
        assertEq(min(3)(5), 3, 'min(3)(5)')
        assertEq(min(7)(2), 2, 'min(7)(2)')
        assertEq(min(3n)(13n), 3n, 'min(3n)(13n)')
        assertEq(min("a")("b"), "a", 'min("a")("b")')
        // const _ = min(1)("a") // compilation error
    }
    {
        assertEq(max(3)(5), 5, 'max(3)(5)')
        assertEq(max(7)(2), 7, 'max(7)(2)')
        assertEq(max(3n)(13n), 13n, 'max(3n)(13n)')
        assertEq(max("a")("b"), "b", 'max("a")("b")')
        // const _ = max(1)("a") // compilation error
    }
}
