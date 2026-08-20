import type { Assert } from '../asserts/types.ts'
import type { Ts } from '../types/rtti/ts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { array, exp, object, primitive, property } from './rtti.f.mjs'

// exp

export type Exp = Ts<typeof exp>

type _Exp =
    | Primitive
    | Array
    | Object
type _ExpAssert = Assert<Equal<Exp, _Exp>>

// primitive

export type Primitive = Ts<typeof primitive>

type _Primitive = undefined | null | boolean | number | string | bigint
type _PrimitiveAssert = Assert<Equal<Primitive, _Primitive>>

// array

export type Array = Ts<typeof array>

type _Array = readonly['[]', readonly Exp[]]
type _ArrayAssert = Assert<Equal<Array, _Array>>

// property

export type Property = Ts<typeof property>

type _Property = readonly[Exp, Exp]
type _PropertyAssert = Assert<Equal<Property, Property>>

// object

export type Object = Ts<typeof object>

type _Object = readonly['{}', readonly Property[]]
type _ObjectAssert = Assert<Equal<Object, _Object>>
