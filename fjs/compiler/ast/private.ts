/**
 * Implementation-private types for AST reachability.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { AstConst, AstFrameRef, AstModuleRef } from './types.ts'

/**
 * Which of a lazy operator's conditionally established operands a walk
 * counts — the right operand of `&&`, `||` and `??`, and both arms of `?:`:
 * none, for what the EDAG establishes unconditionally, or every one, for
 * what a body names anywhere.
 */
export type _Lazy = (operands: readonly AstConst[]) => readonly AstConst[]

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
 * The sweep of a body from its value back: which entries a reference has
 * reached, as a set of indices spelled as a bigint, and every reference the
 * entries make.
 */
export type _Sweep = {
    /** The entries a reference reaches, by bit: the value's among them where the value is read. */
    readonly read: bigint
    /** Every reference the body makes, each entry's in the body's order, resolved to the node it names. */
    readonly refs: List<_RefNode>
}
