/**
 * Type-level API for `fjs/edag/module.f.mjs`: `Exp`, the union of every EDAG
 * node kind (`Primitive`, `Array`, `Object`, `Args`, `NumberCast`,
 * `PropertyAccessor`, `Call`, `PropertyCall`), each pinned against its rtti
 * schema in the sibling module with `Assert<Check<..., typeof ...>>`.
 */

export type { Check } from "../types/rtti/ts/types.ts"

// exp

export type Exp =
    | Primitive
    | Array
    | Object
    | Args
    | NumberCast
    | PropertyAccessor
    | Call
    | PropertyCall

// primitive

export type Primitive = undefined | null | boolean | number | string | bigint

// array

export type Array = readonly['[]', readonly Exp[]]

// property

export type Property = readonly[':', Exp, Exp]

// object

export type Object = readonly['{}', readonly Property[]]

// args

export type Args = readonly['args']

// Number

export type NumberCast = readonly['Number', Exp]

// Index — shape only; see `index` in `module.f.mjs` for what this doesn't
// cover (e.g. denylisted property names like `constructor`)

export type Index = number | NumberCast | string

// propertyAccessor

export type PropertyAccessor = readonly['.', Exp, Index]

// call

export type Call = readonly['()', Exp, Exp]

// propertyCall

export type PropertyCall = readonly['.()', Exp, Index, Exp]
