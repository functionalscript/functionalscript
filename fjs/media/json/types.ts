import type { Ts } from '../../types/rtti/ts/types.ts'
import type { Entry as ObjectEntry } from '../../types/object/types.ts'
import type { List } from "../../types/list/types.ts"

import { primitive } from "./rtti.f.mjs"

export type Primitive = Ts<typeof primitive>

export type Unknown = Object | Array | Primitive

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Entry = ObjectEntry<Unknown>

type Entries = List<Entry>

export type MapEntries = (entries: Entries) => Entries
