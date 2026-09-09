/**
 * TypeScript counterparts of the DataJS data model: JSON's containers over
 * the leaves the format adds — `bigint` and `undefined` beside JSON's, with
 * `NaN` and the infinities values of `number` — as `spec/datajs/README.md`
 * has it. The same shape `fjs/djs/types.ts` spells for the wider compiler
 * subset; this one is the interchange format's own.
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
