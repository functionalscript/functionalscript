import type { Assert } from "../../asserts/types.ts"
import type { Ts } from "../../types/rtti/ts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { primitive, unknown } from "./module.f.mjs"

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

type _Unknown = Assert<Equal<Unknown, Ts<typeof unknown>>>
