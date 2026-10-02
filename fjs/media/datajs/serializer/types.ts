/**
 * Type-level API of the DataJS writer: the flat graph a value is read into
 * before a document is written from it.
 *
 * A document denotes a DAG, so the writer cannot spell a value as it walks
 * it. A node reachable more than once has to become a `const`, a `const`
 * has to precede every use of it, and neither is a question the walk can
 * answer while it is still walking. Reading the caller's value into the
 * nodes below first is what turns both into questions about data: which
 * node is referred to more than once, and whether every reference points
 * backwards. Each is a function over this shape in
 * [`module.f.mjs`](./module.f.mjs), proved against it directly.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { Primitive } from '../types.ts'

/**
 * A value in the graph: a leaf, written where it stands, or a reference to
 * a container node.
 *
 * `R` is how a reference is spelled, and it is spelled twice. While the
 * caller's value is being read a reference is the host object itself,
 * because that is the only name a container has before the read has
 * finished; once the graph is linked it is an index into `nodes`, because
 * that is a name the rules below can compare.
 */
export type _Value<R, L = Primitive> = readonly ['leaf', L] | readonly ['ref', R]

/**
 * A container node: an array's elements, or an object's members in the
 * order the object carries them, which is the order the specification makes
 * observable — array-index keys first by numeric value, then the rest in
 * first-occurrence order.
 */
export type _Node<R, L = Primitive> =
    | { readonly kind: 'array', readonly items: readonly _Value<R, L>[] }
    | { readonly kind: 'object', readonly members: readonly _Member<R, L>[] }

/** One member: the key as the object carries it, and the member's value. */
export type _Member<R, L = Primitive> = readonly [string, _Value<R, L>]

/** A container node as it was read, paired with the host object it was read from. */
export type _Read<L = Primitive> = readonly [object, _Node<object, L>]

/**
 * The linked graph. `nodes` is in post-order — a node comes after every
 * node it refers to — so a reference is always an index smaller than the
 * index of the node holding it. That is what makes the document's
 * declare-before-use rule satisfiable by writing the consts in this order,
 * and a reference pointing the other way is what a cycle looks like here.
 */
export type _Graph<L = Primitive> = {
    readonly nodes: readonly _Node<number, L>[]
    readonly root: _Value<number, L>
}

/** A leaf as a document spells it, or why the document cannot: the rule a tree document is written under. */
export type _Leaf = (value: Primitive) => Result<List<string>, string>
