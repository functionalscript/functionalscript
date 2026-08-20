import type { Assert } from '../asserts/types.ts'
import type { Ts } from '../types/rtti/ts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { array, exp, primitive } from './rtti.f.mjs'

//

export type Exp = Ts<typeof exp>

type _Exp = Primitive
type _ExpAssert = Assert<Equal<Exp, _Exp>>

//

export type Array = Ts<typeof array>

type _Array = readonly['[]', readonly Exp[]]
type _ArrayAssert = Assert<Equal<Array, _Array>>

//

export type Primitive = Ts<typeof primitive>

type _Primitive = undefined | null | boolean | number | string | bigint
type _PrimitiveAssert = Assert<Equal<Primitive, _Primitive>>
