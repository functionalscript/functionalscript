/**
 * Implementation-private types for `fjs/fsc/edag/module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { AstConst, BinaryTag } from '../ast/types.ts'

/** The nodes a reference can name: one per import, one per entry lowered so far, and the arguments of the function being lowered. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
    readonly args: Exp
}

/**
 * One link operation in progress: the modules resolved so far, each under
 * its path and boxed, since an EDAG may be `null` and `at` says `null` for a
 * path it has not seen; and the chain of imports being followed, in which a
 * path met twice is a cycle.
 */
export type _Link = {
    readonly complete: OrderedMap<readonly [Exp]>
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
