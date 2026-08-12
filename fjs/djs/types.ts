import type { Primitive as JsonPrimitive } from '../media/json/types.ts'

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array
