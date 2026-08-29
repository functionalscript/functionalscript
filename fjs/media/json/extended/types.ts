/**
 * TypeScript counterparts of the extended JSON data model: ordinary JSON's
 * containers with `bigint` added to the primitive leaf set.
 *
 * This is a runtime representation, not a new syntax: an extended value's
 * serialized form is ordinary valid JSON text, with no `123n` literal, tagged
 * object, or quoted-integer convention.
 *
 * @module
 */

import type { Primitive as JsonPrimitive, Tree, TreeObject, TreeArray, TreeMapEntries } from '../types.ts'

/**
 * `null | boolean | string | number | bigint`.
 *
 * `bigint` carries JSON's bare integer syntax exactly, whatever its
 * magnitude; `number` carries decimal and exponent syntax, and the one bare
 * integer that `bigint` cannot represent — negative zero.
 */
export type Primitive = JsonPrimitive | bigint

export type Unknown = Tree<Primitive>

export type Object = TreeObject<Primitive>

export type Array = TreeArray<Primitive>

export type _MapEntries = TreeMapEntries<Primitive>
