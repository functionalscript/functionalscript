/**
 * What the lowering carries through a function.
 *
 * @module
 */

import type { Result } from '../../types/result/types.ts'
import type { BindingId, Function as FastFunction, LoopTarget, Value } from '../../js/ast/types.ts'
import type { OpName, Scope, Term } from '../types.ts'

/**
 * What a binding of FAST stands for: a local of the IR, a term that does
 * nothing, which an argument of an inlined function gave, a function of the
 * module that the lowering makes, a function that the function defines, a
 * function of the module that it does not export, both inlined, an
 * operator, a name of the L0 view, or one of L1's native rows.
 */
export type _Meaning =
    | readonly ['local', name: string]
    | readonly ['term', Term]
    | readonly ['function', name: string]
    | readonly ['inline', FastFunction]
    | readonly ['module', FastFunction]
    | readonly ['op', OpName]
    | readonly ['l0', name: string]
    | readonly ['native', name: string]

/**
 * What a binding that the module defines stands for: one of its functions,
 * the arguments that hold its imports, a name of the L0 view, one of L1's
 * native rows, or why the lowering refuses a function that reads it.
 */
export type _Global =
    | readonly ['function', FastFunction]
    | readonly ['args']
    | readonly ['l0', name: string]
    | readonly ['native', name: string]
    | readonly ['refused', reason: string]

/** A loop whose body holds a term: its target in FAST, its label and the locals of its parameters. */
export type _Loop = readonly [target: LoopTarget, label: string, params: readonly string[]]

/**
 * Where a block's end stands: in a value, which a `yield` gives; at the end
 * of a function's body, where a `return` is the body's value; or at the end
 * of a loop's body, where a `break` of that loop is the loop's value.
 */
export type _Tail = readonly ['value'] | readonly ['return'] | readonly ['loop', LoopTarget]

/**
 * The scope of a term: where it stands in the IR, as the checker reads it,
 * what each binding of FAST stands for there, how many locals of FAST
 * enclose it, which name the next one, the loops whose bodies hold it,
 * innermost first, the functions that are inlined around it, innermost
 * first, whose `return` must end its body, and what a capture of a
 * function of the module stands for, given the value that it captures.
 */
export type _Scope = {
    readonly ir: Scope
    readonly bindings: readonly (readonly [BindingId, _Meaning])[]
    readonly depth: number
    readonly loops: readonly _Loop[]
    readonly inlining: readonly FastFunction[]
    readonly module: (v: Value) => Result<_Meaning, string>
}
