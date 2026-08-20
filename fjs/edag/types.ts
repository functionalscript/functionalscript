import type { Assert } from '../asserts/types.ts'
import type { Ts } from '../types/rtti/ts/types.ts'
import type { Equal } from '../types/ts/types.ts'
// import type { args, array, exp, object, primitive, property, propertyAccessor } from './rtti.f.mjs'

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Args

// primitive

export type Primitive = undefined | null | boolean | number | string | bigint

// array

type Array = readonly['[]', readonly Exp[]]

// type _ArrayAssert = Assert<Equal<Array, Ts<typeof array>>>

// property

export type Property = readonly[Exp, Exp]

// type _PropertyAssert = Assert<Equal<Property, Ts<typeof property>>>

// object

export type Object = readonly['{}', readonly Property[]]

// type _ObjectAssert = Assert<Equal<Object, Ts<typeof object>>>

// args

export type Args = readonly['args']

// type _ArgsAssert = Assert<Equal<Args, Ts<typeof args>>>

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Exp]

// type _PropertyAccessorAssert = Assert<Equal<PropertyAccessor, Ts<typeof propertyAccessor>>>
