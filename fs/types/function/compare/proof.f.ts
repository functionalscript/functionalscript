import { cmp, min, max } from './module.f.ts'
import { assert } from '../../../asserts/module.f.ts'

export const proof = () => {
    {
        const result = cmp(true)(false)
        assert(result === 1, result)
        const _ = true < false
    }
    {
        const result = cmp(1)(2)
        assert(result === -1, result)
        const _ = 1 < 2
    }
    {
        const result = cmp(2n)(-10n)
        assert(result === 1, result)
        const _ = 2n < -10n
    }
    {
        const result = cmp("hello")("hello")
        assert(result === 0, result)
        const _ = "hello" < "hello"
    }
    {
        // const result = cmp(true)("hello") // compilation error
        const a: string | number = "hello"
        const b: string | number = 5
        // const _ = cmp(a)(b) // compilation error
        const _ = cmp(a)("hello") // ??? TypeScript changes a type definition of `a`.
        // const f = (a: string|number, b: string|number) => cmp(a)(b) // compilation error
        // const f = (a: number, b: string|number) => cmp(a)(b) // compilation error
    }
    {
        assert(min(3)(5) === 3, 'min(3)(5)')
        assert(min(7)(2) === 2, 'min(7)(2)')
        assert(min(3n)(13n) === 3n, 'min(3n)(13n)')
        assert(min("a")("b") === "a", 'min("a")("b")')
        // const _ = min(1)("a") // compilation error
    }
    {
        assert(max(3)(5) === 5, 'max(3)(5)')
        assert(max(7)(2) === 7, 'max(7)(2)')
        assert(max(3n)(13n) === 13n, 'max(3n)(13n)')
        assert(max("a")("b") === "b", 'max("a")("b")')
        // const _ = max(1)("a") // compilation error
    }
}
