/**
 * Implementation-private types for `fjs/compiler/edag/module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { AstConst, BinaryTag } from '../ast/types.ts'

/** The nodes a reference can name: one per import, one per entry lowered so far, the arguments of the function being lowered, and a read of each slot of its frame. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
    readonly args: Exp
    readonly frame: readonly Exp[]
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
 * operator/negation/bitwise-not/conditional/throw nodes would otherwise call it
 * through: a node still to lower, an operator whose one operand is already
 * on top of `_LowerResults` and needs negating or complementing, a binary
 * operator whose two operands are — right on top, left under it — or the
 * conditional whose three are, the else arm on top and the condition
 * lowest — or a `throw` whose one value is.
 */
export type _LowerWork =
    | { readonly kind: 'expand', readonly ast: AstConst, readonly rest: _LowerWork }
    | { readonly kind: 'neg', readonly rest: _LowerWork }
    | { readonly kind: 'bitnot', readonly rest: _LowerWork }
    | { readonly kind: 'throw', readonly rest: _LowerWork }
    | { readonly kind: 'binary', readonly tag: BinaryTag, readonly rest: _LowerWork }
    | { readonly kind: 'ternary', readonly rest: _LowerWork }
    | null

/** The values `_LowerWork`'s combine steps read and replace, most recently lowered on top. */
export type _LowerResults = { readonly top: _Lowered, readonly rest: _LowerResults } | null

/**
 * A lowered value and what it floats: the roots an inlined body anchors —
 * its `const`s the value does not reach — carried up through eager
 * positions to the nearest block root, a scope's root or a lazy operand,
 * where the comma establishes them before the value.
 */
export type _Lowered = {
    readonly exp: Exp
    readonly anchors: readonly Exp[]
}

/** The entries of a body lowered so far: each entry's node, and beside each what lowering it floated. */
export type _Entries = {
    readonly nodes: readonly Exp[]
    readonly floated: readonly (readonly Exp[])[]
}

/**
 * A module's full result and its export bindings. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly bindings: readonly (readonly [string, Exp])[]
}
