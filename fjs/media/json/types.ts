/**
 * JSON value types, derived from the rtti schemas in `module.f.mjs` — the
 * schema is the single source of truth, no hand-written types to keep in sync.
 *
 * @module
 */

import type { Ts } from '../../types/rtti/ts/types.ts'
import type { Entry as ObjectEntry } from '../../types/object/types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'

export type Primitive = Ts<typeof import('./module.f.mjs').primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Entry = ObjectEntry<Unknown>

/** @internal */
export type _Unknown = Assert<Equal<Unknown, Ts<typeof import('./module.f.mjs').unknown>>>
