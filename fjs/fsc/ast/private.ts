/**
 * Implementation-private types for the DJS AST evaluator.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { Array, Unknown } from '../../media/datajs/types.ts'
import type { AstAccess, AstBody, AstConst, AstMember, AstModuleRef } from './types.ts'

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
 * the EDAG establishes none of them unconditionally.
 */
export type _View = {
    readonly members: (members: readonly AstMember[]) => readonly AstConst[]
    readonly through: (ast: AstAccess) => AstConst
    readonly negated: (operand: AstConst) => readonly AstConst[]
    readonly lazy: (operands: readonly AstConst[]) => readonly AstConst[]
}

export type _Ref = {
    readonly ref: AstModuleRef
    readonly keys: readonly string[]
}

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
    readonly routes: OrderedMap<List<readonly string[]>>
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
