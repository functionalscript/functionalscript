/**
 * The types the JSON serializer's codec builders are declared with: a leaf's
 * spelling, the dialect-specific arms a leaf configuration may carry, the leaf
 * kinds a configuration accepts, and the codec a leaf spelling becomes.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../../types/ts/types.ts'
import type { List } from '../../../types/list/types.ts'
import type { Tree, TreeMapEntries } from '../types.ts'

/**
 * A leaf's spelling as chunks. Public: every codec names it for its
 * `numberSerialize`.
 */
export type LeafSerializer<V> = (value: V) => List<string>

/**
 * The dialect-specific arms a leaf configuration may carry. Every member is a
 * serializer *function*, `undefined`'s included, so there is one member shape
 * and no second convention for "already a list".
 */
export type _ExtraLeaves = {
    readonly bigint?: LeafSerializer<bigint>
    readonly undefined?: LeafSerializer<undefined>
}

/**
 * The leaf kinds a configuration serializes: the shared four plus each arm `X`
 * carries as a **required** property. An optional key does not count —
 * `{ bigint?: … }` is what a widened configuration looks like when the arm may
 * be absent, and a kind is supported only where its serializer is known to be
 * there.
 *
 * The tests are written `[X] extends [...]`, not `X extends ...`: a naked `X`
 * would distribute over a union configuration such as
 * `{ bigint: LeafSerializer<bigint> } | {}` and admit `bigint` from the first
 * member alone, while the runtime value might be `{}`. Wrapped in a tuple, the
 * conditional asks whether the *whole* union carries the arm.
 */
export type _Leaves<X extends _ExtraLeaves> =
    | null | boolean | number | string
    | ([X] extends [{ readonly bigint: LeafSerializer<bigint> }] ? bigint : never)
    | ([X] extends [{ readonly undefined: LeafSerializer<undefined> }] ? undefined : never)

/**
 * What a leaf spelling becomes once `treeSerialize` walks the containers around
 * it: `serialize` to chunks and `stringify` to text, both ordered by `sort`.
 */
export type Codec<P> = {
    readonly serialize: (sort: TreeMapEntries<P>) => (value: Tree<P>) => List<string>
    readonly stringify: (sort: TreeMapEntries<P>) => (value: Tree<P>) => string
}

type _Shared = null | boolean | number | string

type _NoArms = Assert<Equal<_Leaves<{}>, _Shared>>

type _Bigint = Assert<Equal<_Leaves<{ readonly bigint: LeafSerializer<bigint> }>, _Shared | bigint>>

type _Both = Assert<Equal<
    _Leaves<{ readonly bigint: LeafSerializer<bigint>, readonly undefined: LeafSerializer<undefined> }>,
    _Shared | bigint | undefined
>>

type _Widened = Assert<Equal<_Leaves<_ExtraLeaves>, _Shared>>

type _UnionDoesNotDistribute = Assert<Equal<_Leaves<{ readonly bigint: LeafSerializer<bigint> } | {}>, _Shared>>
