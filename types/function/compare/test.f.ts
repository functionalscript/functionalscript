import { cmp } from './module.f.ts'

export default {
    /*
    unsafe: () => {
        const result = unsafeCmp(true)(false)
        if (result !== 1) { throw result }
    },
    */
    cmp: () => {
        {
            const result = cmp(true)(false)
            if (result !== 1) { throw result }
        }
        {
            const result = cmp(1)(2)
            if (result !== -1) { throw result }
        }
        {
            const result = cmp(2n)(-10n)
            if (result !== 1) { throw result }
        }
        {
            const result = cmp("hello")("hello")
            if (result !== 0) { throw result }
        }
        {
            // const result = cmp(true)("hello") // compilation error
        }
    }
}
