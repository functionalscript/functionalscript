import type { Assert } from "../../asserts/types.ts"
import type { Ts } from "../../types/rtti/ts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import { primitive, unknown } from "./rtti.f.mjs"
import type { Entry as ObjectEntry } from '../../types/object/types.ts'
import type { List } from "../../types/list/types.ts"

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

type _Unknown = Assert<Equal<Unknown, Ts<typeof unknown>>>

export type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

export type MapEntries = (entries: Entries) => Entries
