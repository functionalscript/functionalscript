import { cmp, min, max } from './module.f.ts'

export const proof = () => {
    {
        const result = cmp(true)(false)
        if (result !== 1) { throw result }
        const _ = true < false
    }
    {
        const result = cmp(1)(2)
        if (result !== -1) { throw result }
        const _ = 1 < 2
    }
    {
        const result = cmp(2n)(-10n)
        if (result !== 1) { throw result }
        const _ = 2n < -10n
    }
    {
        const result = cmp("hello")("hello")
        if (result !== 0) { throw result }
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
        if (min(3)(5) !== 3) { throw 'min(3)(5)' }
        if (min(7)(2) !== 2) { throw 'min(7)(2)' }
        if (min(3n)(13n) !== 3n) { throw 'min(3n)(13n)' }
        if (min("a")("b") !== "a") { throw 'min("a")("b")' }
        // const _ = min(1)("a") // compilation error
    }
    {
        if (max(3)(5) !== 5) { throw 'max(3)(5)' }
        if (max(7)(2) !== 7) { throw 'max(7)(2)' }
        if (max(3n)(13n) !== 13n) { throw 'max(3n)(13n)' }
        if (max("a")("b") !== "b") { throw 'max("a")("b")' }
        // const _ = max(1)("a") // compilation error
    }
}
