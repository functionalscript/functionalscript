/**
 * What the lowering carries through a function.
 *
 * @module
 */

import type { BindingId } from '../../js/ast/types.ts'
import type { OpName, Scope } from '../types.ts'

/** What a binding of FAST stands for: a local of the IR, a function of the module, or an operator. */
export type _Meaning =
    | readonly ['local', name: string]
    | readonly ['function', name: string]
    | readonly ['op', OpName]

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
