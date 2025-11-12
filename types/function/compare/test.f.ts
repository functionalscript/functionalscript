import { cmp } from './module.f.ts'

export default () => {
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
}
