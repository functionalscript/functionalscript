/** The state-independent interface shared by EDAG interpreters. @module */

import type { Exp } from '../types.ts'
import type { Array, Function, Values } from '../value/types.ts'
import type { ValueResult } from '../value/control/types.ts'
import type { Invoke, Outcome } from '../value/call/types.ts'

/**
 * Established bindings of one module or represented function invocation.
 * `self` is the function being invoked, what its body's `['self']` reads —
 * the invoked value itself, so two reads are one function by identity —
 * and absent at a module's scope.
 */
export type Context = {
    readonly frame: Values
    readonly args: Values
    readonly fixed?: Values
    readonly rest?: Array
    readonly self?: Function
}

/** A successful or thrown language value together with the resulting VM state. */
export type Evaluation<S> = readonly [S, ValueResult]

/**
 * An evaluation in tail position: a value, a throw, or the call left for the
 * executor to make in the invocation's place, with the resulting VM state.
 */
export type Tail<S> = readonly [S, Outcome]

/**
 * Operands are raw expressions or table references, according to the VM.
 * `operand` answers an operand's value; `tail` answers one in tail position,
 * where a call is left for the executor rather than made.
 * `expression` retains a function's body as EDAG without evaluating it;
 * `invoke` keeps the VM's execution model through calls and coercions.
 */
export type Evaluator<E, S> = {
    readonly context: Context
    readonly operand: (e: E, state: S) => Evaluation<S>
    readonly tail: (e: E, state: S) => Tail<S>
    readonly expression: (e: E) => Exp
    readonly invoke: Invoke
}
