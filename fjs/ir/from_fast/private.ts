/**
 * What the lowering carries through a function.
 *
 * @module
 */

import type { Result } from '../../types/result/types.ts'
import type { BindingId, Block, Function as FastFunction, Item, LoopTarget, Statement, Value } from '../../js/ast/types.ts'
import type { ConstantOf, OpName, Scope, Term, Type } from '../types.ts'

/**
 * What a binding of FAST stands for: a local of the IR, a term that does
 * nothing, which an argument of an inlined function or a constant gave, a
 * function of the module that the lowering makes, a function that the
 * function defines, a function of the module that it does not export, both
 * inlined, an operator, a name of the L0 view, one of L1's native rows, or,
 * where a constant's term reads the module's bindings, why the lowering
 * refuses a term that reads it.
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
    | readonly ['refused', reason: string]

/** What an import of the module stands for: a name of the L0 view, one of L1's native rows, or why the lowering refuses a term that reads it. */
export type _Import =
    | readonly ['l0', name: string]
    | readonly ['native', name: string]
    | readonly ['refused', reason: string]

/**
 * What a binding that the module defines stands for: one of its functions,
 * the arguments that hold its imports, an operator of the IR that a static
 * function is, a constant, by the value that defines it, an import, or why
 * the lowering refuses a term that reads it.
 */
export type _Global =
    | readonly ['function', FastFunction]
    | readonly ['args']
    | readonly ['op', OpName]
    | readonly ['constant', Value]
    | _Import

/** A module-level definition that the lowering made a constant of: its binding, and the constant or why the lowering refused it. */
export type _Lowered = readonly [BindingId, Result<readonly [name: string, ConstantOf<Term>], string>]

/** What every term of a module sees: the signatures of its functions, the interfaces it imports and the types of the constants that it may read. */
export type _Context = {
    readonly functions: Scope['functions']
    readonly imports: Scope['imports']
    readonly constants: readonly (readonly [name: string, Type])[]
}

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
 * what each binding of FAST stands for there, and what one stands for that
 * the scope does not bind, and the import that a value reads from the
 * arguments of the module: nothing in a function, which reads the module's
 * bindings and imports through its captures, and in a constant's term,
 * which reads them itself, the module's binding and the import. Then how
 * many locals of FAST enclose it, which name the next one, the loops whose
 * bodies hold it, innermost first, the functions that are inlined around
 * it, innermost first, whose `return` must end its body, and what a capture
 * of a function of the module stands for, given the value that it
 * captures.
 */
export type _Scope = {
    readonly ir: Scope
    readonly bindings: readonly (readonly [BindingId, _Meaning])[]
    readonly outer: (b: BindingId) => _Meaning | null
    readonly imported: (v: Value) => _Import | null
    readonly depth: number
    readonly loops: readonly _Loop[]
    readonly inlining: readonly FastFunction[]
    readonly module: (v: Value) => Result<_Meaning, string>
}

/** The cast that a value does before anything else. */
export type _FirstCast = (scope: _Scope, v: Item<Value>) => readonly [string, string] | 'nothing' | null

/** Lower a value in the scope where it stands. */
export type _LowerValue = (scope: _Scope, v: Value) => Result<Term, string>

/** Lower a block, using the recursive value lowering for its values. */
export type _LowerBlock = (lowerValue: _LowerValue, scope: _Scope, b: Block, tail: _Tail) => Result<Term, string>

/** Lower a statement around the continuation in the scope that it leaves. */
export type _LowerStatement = (
    lowerValue: _LowerValue,
    lowerBlock: _LowerBlock,
    scope: _Scope,
    s: Statement,
    tail: _Tail,
    rest: (scope: _Scope) => Result<Term, string>,
) => Result<Term, string>
