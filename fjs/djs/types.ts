/**
 * DJS's own value model: `Primitive`, `Unknown`, `Object`, and `Array`,
 * layered on top of JSON's `Primitive` with `bigint` and `undefined` added.
 */

import type {
    Primitive as JsonPrimitive,
    Tree,
    TreeMapEntries,
} from '../media/json/types.ts'
import type { Assert } from '../asserts/types.ts'
import type { Equal } from '../types/ts/types.ts'
import type { ReadFile, Write, WriteFile } from '../effects/node/types.ts'

export type Object = { readonly[k in string]?: Unknown }

export type Array = readonly Unknown[]

export type Primitive = JsonPrimitive | bigint | undefined

export type Unknown = Primitive | Object | Array

/**
 * DJS's containers are spelled out above rather than derived, the same way
 * JSON's are. This pins them against `Tree<P>`: the two descriptions of the
 * same recursive shape must not drift apart, and the alias below is only
 * sound while they agree.
 */
type _Unknown = Assert<Equal<Unknown, Tree<Primitive>>>

/**
 * How the serializer orders an object's entries — `sort` for canonical
 * output, `identity` to keep insertion order. The same alias JSON and
 * extended JSON instantiate, at DJS's leaf set.
 */
export type _MapEntries = TreeMapEntries<Primitive>

/** The effect operations `compile` performs: file I/O and error output. */
export type _CompileOp = ReadFile | WriteFile | Write
