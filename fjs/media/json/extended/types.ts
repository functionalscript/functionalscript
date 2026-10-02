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
import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../../types/ts/types.ts'
import type { List } from '../../../types/list/types.ts'
import type { serialize, stringify } from './module.f.mjs'

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

// `serialize` and `stringify` are destructured from `codec` rather than
// annotated where they are exported, so their public signatures are pinned
// here instead.
type _Serialize = Assert<Equal<typeof serialize, (sort: _MapEntries) => (value: Unknown) => List<string>>>

type _Stringify = Assert<Equal<typeof stringify, (sort: _MapEntries) => (value: Unknown) => string>>
