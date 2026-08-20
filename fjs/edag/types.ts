export type { Check } from "../types/rtti/ts/types.ts"

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Args
    | PropertyAccessor
    | Call
    | PropertyCall

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

// call

export type Call = readonly['()', Exp, Exp]

// propertyCall

export type PropertyCall = readonly['.()', Exp, Exp, Exp]
