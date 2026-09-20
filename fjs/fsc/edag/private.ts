/**
 * Implementation-private types for `fjs/fsc/edag/module.f.mjs` and the
 * graph demo beside it, `./demo.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { AstConst, BinaryTag } from '../ast/types.ts'
import type { Edge, Node } from '../../website/demo/graph/types.ts'

/** The nodes a reference can name: one per import, one per entry lowered so far, and the arguments of the function being lowered. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
    readonly args: Exp
}

/**
 * One link operation in progress: the modules resolved so far under their
 * identities, and the chain being followed, in which a repeated identity is
 * a cycle.
 */
export type _Link = {
    readonly complete: OrderedMap<_Resolved>
    readonly stack: List<string>
}

/** A module's imports being resolved: the link so far, and the EDAGs bound to the imports resolved so far, in their order. */
export type _Binding = {
    readonly context: _Link
    readonly bound: readonly Exp[]
}

/**
 * `lower`'s own explicit stack, in place of the recursion a chain of
 * operator/negation/bitwise-not nodes would otherwise call it through: a
 * node still to lower, an operator whose one operand is already on top of
 * `_LowerResults` and needs negating or complementing, or a binary
 * operator whose two operands are — right on top, left under it.
 */
export type _LowerWork =
    | { readonly kind: 'expand', readonly ast: AstConst, readonly rest: _LowerWork }
    | { readonly kind: 'neg', readonly rest: _LowerWork }
    | { readonly kind: 'bitnot', readonly rest: _LowerWork }
    | { readonly kind: 'binary', readonly tag: BinaryTag, readonly rest: _LowerWork }
    | null

/** The `Exp`s `_LowerWork`'s combine steps read and replace, most recently lowered on top. */
export type _LowerResults = { readonly top: Exp, readonly rest: _LowerResults } | null

/**
 * A module's full result and its default binding. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly default: Exp | undefined
}

/**
 * `demo.f.mjs`'s own walk state: every `Exp` reference seen so far and the
 * node id it was given, the {@link Node}s and {@link Edge}s built from them,
 * and the next id to hand out.
 */
export type _State = {
    readonly refs: readonly (readonly [object, number])[]
    readonly nodes: readonly Node[]
    readonly edges: readonly Edge[]
    readonly next: number
}

/** An `Exp`'s own label and its labeled children, as `_shapeOf` (`./demo.f.mjs`) reads them off before any node exists. */
export type _Shape = {
    readonly kind: string
    readonly label: string
    readonly children: readonly (readonly [string, Exp])[]
}
