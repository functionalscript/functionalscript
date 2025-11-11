import { /*unsafeCmp,*/ cmp } from './module.f.ts'

export default {
    /*
    unsafe: () => {
        const result = unsafeCmp(true)(false)
        if (result !== 1) { throw result }
    },
    */
    cmp: () => {
        {
            const m = cmp(1)(2)
            type M = typeof m
        }
        {
            const m = cmp(1)("")
            type M = typeof m
        }
    }
}
