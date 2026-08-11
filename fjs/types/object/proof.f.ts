import { at } from './module.f.ts'
import type { OptionalMap, RequiredMap, StringMap } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.mjs'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../ts/types.ts'

type _StringMapIsOptional = Assert<Equal<
    StringMap<bigint>,
    { readonly[k in string]?: bigint }>>

type _OptionalIsPartial = Assert<Equal<
    OptionalMap<'a'|'b', bigint>,
    { readonly a?: bigint; readonly b?: bigint }>>

type _RequiredIsRequired = Assert<Equal<
    RequiredMap<'a'|'b', bigint>,
    { readonly a: bigint; readonly b: bigint }>>

type _RequiredOverAnyStringIsNever = Assert<Equal<RequiredMap<string, bigint>, never>>

export const proof = {
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
