/**
 * Implementation-private types for the AST evaluator.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Array, Unknown } from '../../media/datajs/types.ts'
import type { AstAccess, AstBody, AstConst, AstFrameRef, AstMember, AstModuleRef } from './types.ts'

/** An evaluation in progress: the body, its arguments, and the values so far. */
export type _RunState = {
    readonly body: AstBody
    readonly args: Array
    readonly consts: List<Unknown>
}

/**
 * A reference as the sweep counts it: the `const` or import it rests on,
 * and the keys the accesses on it apply, outermost first — none for a
 * reference to the whole.
 */
/**
 * A way of reading the syntax for references: which of an object's members
 * count, what an access denotes — the value's view selects inside a
 * literal, the written view reads the access as it stands — what a
 * negation's operand leaves behind, and what a lazy operator's
 * conditionally established operands do: the right operand of `&&`, `||`
 * and `??`, and both arms of `?:` — the value's view every one of them,
 * since the value may be any of them, and the written view none, since
 * the EDAG establishes none of them unconditionally — and what a spread's
 * operand contributes, given the walk of an operand: its elements, in the
 * value's view, and the operand as it stands in a view that reads no keys.
 */
export type _View = {
    readonly members: (members: readonly AstMember[]) => readonly AstConst[]
    readonly through: (ast: AstAccess) => AstConst
    readonly negated: (operand: AstConst) => readonly AstConst[]
    readonly lazy: (operands: readonly AstConst[]) => readonly AstConst[]
    readonly spread: (refs: (ast: AstConst) => List<_Ref>, operand: AstConst) => List<_Ref>
}

export type _Ref = {
    readonly ref: _RefNode
    readonly keys: readonly _Key[]
}

/**
 * A key a reference applies: a property's name, or `null` for each element
 * of the array there — what a spread takes from its operand, which
 * elements being known only once the operand is evaluated.
 */
export type _Key = string | null

/**
 * The node a reference rests on: a `const` or an import of the scope, or
 * a slot of a body's frame — which the sweep of the body itself ignores,
 * and the sweep of a scope the body is inlined into follows into the
 * capture the slot holds.
 */
export type _RefNode = AstModuleRef | AstFrameRef

/**
 * The explicit stack `operandsOf` walks a chain of operator/negation/
 * bitwise-not nodes with, in place of recursing through them: the node
 * still to classify, and the rest of the stack under it.
 */
export type _OperandStack = { readonly top: AstConst, readonly rest: _OperandStack } | null

/**
 * The sweep from the export downwards: which entries it has reached, as a
 * set of indices spelled as a bigint, and every reference those entries
 * make.
 */
export type _Reach = {
    readonly reachable: bigint
    readonly refs: List<_Ref>
}

/**
 * The sweep the sharing decision runs: the routes by which the export
 * reaches each entry, under the entry's index — a route the keys of the
 * accesses along it, none for the whole entry — and every reference found
 * along those routes.
 */
export type _Routes = {
    readonly routes: OrderedMap<List<readonly _Key[]>>
    readonly refs: List<_Ref>
}

/**
 * A container node a reference reaches: its group — a `const`'s index, or a
 * module's id — the keys from there, and the import index (null for a const).
 */
export type _Node = {
    readonly group: string
    readonly keys: readonly string[]
    readonly aref: number | null
}
