/**
 * Prepared FAST: slots and transfers are fixed before target serialization.
 * All identities retain their normalized meaning; generated slots are private.
 *
 * @module
 */

import type { BindingId, FunctionTarget, LoopTarget, _Unary, _Binary, _InstanceOf, _Array, _Object, _Access, _ContinuedAccess, _GuardedCall, _ContinuedGuardedCall, _Call, _Conditional, _Comma, _Leaf } from '../types.ts'
import type { Primitive } from '../../../media/datajs/types.ts'

/** A reference to a memo demands its initializer once in the owning invocation. */
export type Value =
    | Primitive
    | readonly ['ref' | 'demand', BindingId]
    | _Unary<Value> | _Binary<Value> | _InstanceOf<Value> | _Array<Value> | _Object<Value>
    | _Access<Value> | _ContinuedAccess<Value> | _GuardedCall<Value> | _ContinuedGuardedCall<Value>
    | _Call<Value> | _Conditional<Value> | _Comma<Value> | _Leaf
    | readonly ['function', Function]
    | readonly ['block', Block]
    | readonly ['if', Value, Block, Block]

export type Capture = { readonly binding: BindingId; readonly value: Value }

export type Function = {
    readonly target: FunctionTarget
    readonly parameters: readonly BindingId[]
    readonly rest: BindingId | null
    readonly self: BindingId | null
    readonly captures: readonly Capture[]
    readonly body: Block
}

/**
 * Memo storage is allocated here, at the definition's execution point. It is
 * internal storage, not an escaping mutable source binding. Initializers run
 * only on demand; a failed initialization does not mark the value established.
 */
export type Memo = {
    readonly binding: BindingId
    readonly valueSlot: BindingId
    readonly doneSlot: BindingId
    readonly initializer: Block
}

/**
 * The established scalar loop spelling. The slot is private to this statement;
 * `result` is its immutable final value. A renderer can name both alike because
 * the statement owns every write and the slot is unavailable afterward.
 */
export type While = {
    readonly target: LoopTarget
    readonly slot: BindingId
    readonly initial: Value
    readonly condition: Value
    readonly body: Block
    readonly result: BindingId
    readonly mutable: boolean
}

export type Statement =
    | readonly ['define', BindingId, Value]
    /** A mutable local slot, initialized before any read. */
    | readonly ['slot', BindingId, Value, mutable: boolean]
    | readonly ['write', BindingId, Value]
    | readonly ['memo', Memo]
    | readonly ['block', Block]
    | readonly ['if', Value, Block, Block]
    | readonly ['loop', LoopTarget, Block]
    | readonly ['while', While]

/** A prepared block normally finishes with no further values to distribute. */
export type Exit =
    | readonly ['yield', readonly Value[]]
    | readonly ['continue' | 'break', LoopTarget]
    | readonly ['return', FunctionTarget, Value]
    | readonly ['throw', Value]

export type Block = {
    readonly statements: readonly Statement[]
    readonly exit: Exit
}
