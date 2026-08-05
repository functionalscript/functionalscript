import { at } from './module.f.ts'
import type { Map, StringMap } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

type E<A, B> = A extends B ? B extends A ? true : false : false

// `[T]` keeps the conditional from distributing, so `never` stays `never`.
type IsNever<T> = [T] extends [never] ? true : false

type _MapIsOptional = E<Map<bigint>, { readonly[k in string]?: bigint }>
type _FiniteIsRequired = E<StringMap<'a'|'b', bigint>, { readonly a: bigint; readonly b: bigint }>
type _OpenKeySetIsNever = IsNever<StringMap<string, bigint>>

export const proof = {
    stringMap: {
        mapIsOptional: true as _MapIsOptional,
        finiteIsRequired: true as _FiniteIsRequired,
        openKeySetIsNever: true as _OpenKeySetIsNever,
    },
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        assertEq(value, null)
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        assertEq(value, 42)
    }
}
