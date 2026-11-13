/**
 * What the lowering carries through a function.
 *
 * @module
 */

import type { BindingId, Function as FastFunction } from '../../js/ast/types.ts'
import type { OpName, Scope } from '../types.ts'

/** What a binding of FAST stands for: a local of the IR, a function of the module, an operator, or a name of the L0 view. */
export type _Meaning =
    | readonly ['local', name: string]
    | readonly ['function', name: string]
    | readonly ['op', OpName]
    | readonly ['l0', name: string]

/**
 * What a binding that the module defines stands for: one of its functions,
 * the arguments that hold its imports, a name of the L0 view, or why the
 * lowering refuses a function that reads it.
 */
export type _Global =
    | readonly ['function', FastFunction]
    | readonly ['args']
    | readonly ['l0', name: string]
    | readonly ['refused', reason: string]

/**
 * The scope of a term: where it stands in the IR, as the checker reads it,
 * what each binding of FAST stands for there, and how many of the IR's
 * locals are the function's parameters.
 */
export type _Scope = {
    readonly ir: Scope
    readonly bindings: readonly (readonly [BindingId, _Meaning])[]
    readonly params: number
}
