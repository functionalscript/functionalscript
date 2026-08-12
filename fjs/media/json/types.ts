/**
 * TypeScript counterparts of the JSON data model: `Primitive`, `Unknown`,
 * `Object`, and `Array`.
 *
 * `Unknown` is written by hand rather than derived, so that the recursion
 * reads directly, and is then pinned against the rtti schemas in the sibling
 * [`./rtti/module.f.mjs`](./rtti/module.f.mjs) with
 * `Assert<Equal<Unknown, Ts<typeof unknown>>>`. The pin is what keeps the two
 * descriptions of the same data model from drifting apart.
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type { Ts } from "../../types/rtti/ts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { primitive, unknown } from "./rtti/module.f.mjs"

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

type _Unknown = Assert<Equal<Unknown, Ts<typeof unknown>>>
