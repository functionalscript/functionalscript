import { at } from './module.f.ts'
import type { OptionalMap, RequiredMap, StringMap } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

type E<A, B> = A extends B ? B extends A ? true : false : false

// `[T]` keeps the conditional from distributing, so `never` stays `never`.
type IsNever<T> = [T] extends [never] ? true : false

type _StringMapIsOptional = E<StringMap<bigint>, { readonly[k in string]?: bigint }>
type _OptionalIsPartial = E<OptionalMap<'a'|'b', bigint>, { readonly a?: bigint; readonly b?: bigint }>
type _RequiredIsRequired = E<RequiredMap<'a'|'b', bigint>, { readonly a: bigint; readonly b: bigint }>
type _RequiredOverAnyStringIsNever = IsNever<RequiredMap<string, bigint>>

export const proof = {
    stringMap: {
        stringMapIsOptional: true as _StringMapIsOptional,
        optionalIsPartial: true as _OptionalIsPartial,
        requiredIsRequired: true as _RequiredIsRequired,
        requiredOverAnyStringIsNever: true as _RequiredOverAnyStringIsNever,
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
