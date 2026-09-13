/**
 * TypeScript counterparts of the DataJS data model: JSON's containers over
 * the leaves the format adds — `bigint` and `undefined` beside JSON's, with
 * `NaN` and the infinities values of `number` — as `spec/datajs/README.md`
 * has it. The compiler, `fjs/fsc`, has no value model of its own: what it
 * denotes is a value of this one.
 *
 * `TreeObject`'s index signature is optional, so `{ a: undefined }` and `{}`
 * are one type here: only the runtime enumerator tells a member holding
 * `undefined` from an absent one, and the reader builds the first as a
 * present property.
 *
 * @module
 */

import type { Primitive as JsonPrimitive, Tree, TreeObject, TreeArray } from '../json/types.ts'

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Tree<Primitive>

export type Object = TreeObject<Primitive>

export type Array = TreeArray<Primitive>
