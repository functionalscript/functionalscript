/**
 * TypeScript counterparts of the JSON data model: `Primitive`, `Unknown`,
 * `Object`, and `Array`, plus the leaf-parameterized `Tree` they instantiate.
 *
 * `Unknown` is written by hand rather than derived, so that the recursion
 * reads directly, and is then pinned against the rtti schemas in the sibling
 * [`./rtti/module.f.mjs`](./rtti/module.f.mjs) with
 * `Assert<Check<Unknown, typeof unknown>>`. The pin is what keeps the two
 * descriptions of the same data model from drifting apart — and it holds the
 * `Tree<Primitive>` spelling to the same data model the schemas describe.
 *
 * @module
 */

import type { Entry as ObjectEntry } from '../../types/object/types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Ts, Check } from '../../rtti/ts/types.ts'
import type { primitive, unknown } from './rtti/module.f.mjs'
import type { List } from '../../types/list/types.ts'

/**
 * A recursive JSON-shaped tree over a leaf type `P`: JSON's container
 * structure with its primitive set left open.
 *
 * The parser and the serializer are written once against this shape and are
 * instantiated per numeric policy — `Tree<Primitive>` is ordinary JSON,
 * `Tree<ExtendedPrimitive>` (see
 * [`./extended/types.ts`](./extended/types.ts)) adds `bigint` to the leaves.
 *
 * `TreeObject`'s index signature is **optional** on purpose: reading an
 * arbitrary key off a JSON-shaped object yields `undefined` when the property
 * is absent, and `undefined` is not a leaf of any of these trees. A required
 * index signature would type every missing property as a value.
 */
export type Tree<P> = P | TreeObject<P> | TreeArray<P>

export type TreeObject<P> = { readonly[k in string]?: Tree<P> }

export type TreeArray<P> = readonly Tree<P>[]

export type Primitive = Ts<typeof primitive>

export type Unknown = Tree<Primitive>

export type Object = TreeObject<Primitive>

export type Array = TreeArray<Primitive>

type _Unknown = Assert<Check<Unknown, typeof unknown>>

export type TreeEntry<P> = ObjectEntry<Tree<P>>

export type TreeEntries<P> = List<TreeEntry<P>>

/**
 * How a serializer orders an object's entries — `sort` for canonical output,
 * `identity` to keep insertion order. It is a per-leaf-type alias only because
 * the entries it reorders carry the tree's own leaves.
 */
export type TreeMapEntries<P> = (entries: TreeEntries<P>) => TreeEntries<P>

export type Entry = TreeEntry<Primitive>

export type _Entries = TreeEntries<Primitive>

export type _MapEntries = TreeMapEntries<Primitive>
