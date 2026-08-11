import { at } from './module.f.mjs'
/** @import { OptionalMap, RequiredMap, StringMap } from './types.ts' */
import { assertEq } from '../../asserts/module.f.mjs'
/** @import { Assert } from '../../asserts/types.ts' */
/** @import { Equal } from '../ts/types.ts' */

/** @typedef {Assert<Equal<StringMap<bigint>, { readonly [k in string]?: bigint }>>} _StringMapIsOptional */

/** @typedef {Assert<Equal<OptionalMap<'a'|'b', bigint>, { readonly a?: bigint; readonly b?: bigint }>>} _OptionalIsPartial */

/** @typedef {Assert<Equal<RequiredMap<'a'|'b', bigint>, { readonly a: bigint; readonly b: bigint }>>} _RequiredIsRequired */

/** @typedef {Assert<Equal<RequiredMap<string, bigint>, never>>} _RequiredOverAnyStringIsNever */

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
