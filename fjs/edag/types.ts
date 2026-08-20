import type { Ts } from "../types/rtti/ts/types.ts"
import type { Type } from "../types/rtti/types.ts"
import type { Equal } from "../types/ts/types.ts"

export type Check<A, B extends Type> = Equal<A, Ts<B>>

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Args
    | PropertyAccessor

// primitive

export type Primitive = undefined | null | boolean | number | string | bigint

// array

export type Array = readonly['[]', readonly Exp[]]

// property

export type Property = readonly[Exp, Exp]

// object

export type Object = readonly['{}', readonly Property[]]

// args

export type Args = readonly['args']

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Exp]
