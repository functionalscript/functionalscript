import type { Assert } from '../asserts/types.ts'
import type { Ts } from '../types/rtti/ts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { primitive } from './rtti.f.mjs'

export type Exp =
    | Types
    // Operators
    | Args
    | PropertyAccessor
    | Own
    | Comma

export type ExpArray = readonly Exp[]

// Types:

export type Primitive = boolean | null | undefined | number | string | bigint

export type Array = readonly['[]', ExpArray]

export type Object = readonly['{}', readonly Property[]]

export type Property = readonly[Exp, Exp]

export type Types =
    | Primitive
    | Array
    | Object

// Operators:

export type Args = readonly['args']

export type PropertyAccessor = readonly['.', readonly[Exp, Exp]]

export type Own = readonly['own', Exp, Exp]

export type Comma = readonly[',', ExpArray]
