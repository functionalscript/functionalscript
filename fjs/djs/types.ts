/**
 * DJS's own value model: `Primitive`, `Unknown`, `Object`, and `Array`,
 * layered on top of JSON's `Primitive` with `bigint` and `undefined` added.
 *
 * @module
 */

import type { Primitive as JsonPrimitive } from '../media/json/types.ts'

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array
