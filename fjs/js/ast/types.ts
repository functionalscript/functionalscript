/**
 * Foundation AST: explicit value identities, evaluation regions and transfers.
 * These types describe compiler IR, independently of source admission.
 *
 * @module
 */

import type { BinaryTag, UnaryTag } from '../../compiler/ast/types.ts'
import type { ConstructorId, IntrinsicId, StaticId } from '../../edag/types.ts'
import type { Primitive } from '../../media/datajs/types.ts'

/** Identity is object identity; the index only supplies deterministic presentation. */
export type BindingId = { readonly index: number }
export type FunctionTarget = { readonly kind: 'function'; readonly index: number }
export type LoopTarget = { readonly kind: 'loop'; readonly index: number }

/** A spread has no independent value or evaluation region. */
export type Item<V> = V | readonly ['...', V]
export type Entry<V> = readonly [':', V, V] | readonly ['...', V]
export type Key<V> = string | number | readonly ['Number', V]
export type Step<V> =
    | readonly ['|.', Key<V>]
    | readonly ['|.', Key<V>, Step<V>]
    | readonly ['|()' | '|?.()', readonly Item<V>[]]
    | readonly ['|()' | '|?.()', readonly Item<V>[], Step<V>]
    | readonly ['|!()', readonly Item<V>[]]

/**
 * Existing value operations, parameterized by their operands. Lazy operands
 * stay values in their original region; a block value makes their steps explicit.
 * Logical operations remain only during the baseline migration (epic D removes them).
 */
export type Operator<V> =
    | _Unary<V> | _Binary<V> | _InstanceOf<V> | _Array<V> | _Object<V>
    | _Access<V> | _ContinuedAccess<V> | _GuardedCall<V> | _ContinuedGuardedCall<V>
    | _Call<V> | _Conditional<V> | _Comma<V> | _Leaf

// Tuple interfaces defer recursive operand resolution. The concrete Value union
// names them directly because TypeScript rejects recursive generic union aliases.
export interface _Unary<V> extends Readonly<[UnaryTag | '+', V]> {}
export interface _Binary<V> extends Readonly<[BinaryTag, V, V]> {}
export interface _InstanceOf<V> extends Readonly<['instanceof', V, ConstructorId]> {}
export interface _Array<V> extends Readonly<['array', readonly Item<V>[]]> {}
export interface _Object<V> extends Readonly<['object', readonly Entry<V>[]]> {}
export interface _Access<V> extends Readonly<['.' | '?.', V, Key<V>]> {}
export interface _ContinuedAccess<V> extends Readonly<['.' | '?.', V, Key<V>, Step<V>]> {}
export interface _GuardedCall<V> extends Readonly<['?.()', V, readonly Item<V>[]]> {}
export interface _ContinuedGuardedCall<V> extends Readonly<['?.()', V, readonly Item<V>[], Step<V>]> {}
export interface _Call<V> extends Readonly<['()', V, readonly Item<V>[]]> {}
export interface _Conditional<V> extends Readonly<['?:', V, V, V]> {}
export interface _Comma<V> extends Readonly<[',', readonly V[]]> {}
export interface _Leaf extends Readonly<['entry' | 'hasEntry' | IntrinsicId | StaticId]> {}

/** All references name established immutable values, never source variables. */
export type Value =
    | Primitive
    | readonly ['ref', BindingId]
    | _Unary<Value> | _Binary<Value> | _InstanceOf<Value> | _Array<Value> | _Object<Value>
    | _Access<Value> | _ContinuedAccess<Value> | _GuardedCall<Value> | _ContinuedGuardedCall<Value>
    | _Call<Value> | _Conditional<Value> | _Comma<Value> | _Leaf
    | readonly ['function', Function]
    /** An expression block yields exactly one value; it creates no invocation. */
    | readonly ['block', Block]
    /** Each arm yields one value. */
    | readonly ['if', Value, Block, Block]

export type Definition = readonly ['define', BindingId, Value, 'required' | 'lazy']

/** Inputs and results have independent ordered signatures. */
export type Loop = {
    readonly target: LoopTarget
    readonly parameters: readonly BindingId[]
    readonly initial: readonly Value[]
    readonly results: readonly BindingId[]
    readonly body: Block
}

export type Statement =
    | Definition
    | readonly ['block', readonly BindingId[], Block]
    | readonly ['if', readonly BindingId[], Value, Block, Block]
    | readonly ['loop', Loop]

export type Exit =
    | readonly ['yield', readonly Value[]]
    | readonly ['continue', LoopTarget, readonly Value[]]
    | readonly ['break', LoopTarget, readonly Value[]]
    | readonly ['return', FunctionTarget, Value]
    | readonly ['throw', Value]

/** Every path finishes with an explicit normal or abrupt transfer. */
export type Block = {
    readonly statements: readonly Statement[]
    readonly exit: Exit
}

export type Capture = { readonly binding: BindingId; readonly value: Value }

/** Parameters, rest, self and captures are immutable bindings like local values. */
export type Function = {
    readonly target: FunctionTarget
    readonly parameters: readonly BindingId[]
    readonly rest: BindingId | null
    readonly self: BindingId | null
    readonly captures: readonly Capture[]
    readonly body: Block
}

/**
 * Resolved binding-stage facts, after pattern expansion and before normalization.
 * Declaration kinds remain the source admission owner's separate information.
 */
export type Binding = {
    readonly id: BindingId
    readonly isMutable: boolean
    /** Source functions containing direct resolved reads/writes, excluding frame forwarding. */
    readonly capturedBy: readonly FunctionTarget[]
}

/**
 * Events are emitted while expanding resolved source constructs. Initialization
 * is distinct from assignment; regions include unreachable source branches.
 * A nested function establishes a new capture boundary, whereas a region does not.
 */
export type BindingEvent =
    | readonly ['initialize' | 'read' | 'write', BindingId]
    | readonly ['region', readonly BindingEvent[]]
    | readonly ['function', BindingScope]

export type BindingScope = {
    readonly target: FunctionTarget
    readonly bindings: readonly BindingId[]
    readonly events: readonly BindingEvent[]
}
