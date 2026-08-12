import type { Ts } from "../../types/rtti/ts/types.ts"
import type { primitive } from "./rtti/module.f.mjs"

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]
