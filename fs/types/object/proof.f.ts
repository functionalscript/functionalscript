import { at } from './module.f.ts'
import type { StringMap } from './module.f.ts'
import { assert } from '../../asserts/module.f.ts'

type E<A, B> = A extends B ? B extends A ? true : false : false

type _InfiniteIsOptional = E<StringMap<string, bigint>, { readonly[k in string]?: bigint }>
type _FiniteIsRequired = E<StringMap<'a'|'b', bigint>, { readonly a: bigint; readonly b: bigint }>

export const proof = {
    stringMap: {
        infiniteIsOptional: true as _InfiniteIsOptional,
        finiteIsRequired: true as _FiniteIsRequired,
    },
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        assert(value === null, value)
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        assert(value === 42, value)
    }
}
