/**
 * Resolved source constructs before sugar and assignment normalization.
 * References name source declarations, including writes to their original
 * identity. No generated function, capture frame or immutable version is here.
 *
 * @module
 */

import type { Primitive } from '../../../media/datajs/types.ts'
import type { StaticId } from '../../../edag/types.ts'
import type { AstImport, BinaryTag } from '../../../compiler/ast/types.ts'
import type {
    BindingEvent, BindingId, FunctionTarget, LoopTarget, Operator,
    _Unary, _InstanceOf, _In, _Array, _Object, _Access, _ContinuedAccess,
    _GuardedCall, _ContinuedGuardedCall, _Call, _Conditional, _Comma, _Leaf,
} from '../types.ts'

export type LogicalTag = Extract<BinaryTag, '&&' | '||' | '??'>
/** Source syntax retains its full binary vocabulary until sugar expansion. */
export interface _SourceBinary<V> extends Readonly<[BinaryTag, V, V]> {}
export type SourceOperator<V> = Operator<V> | _SourceBinary<V>

/** Checked pattern reads retain their source identities until expansion. */
export type ExpansionPlan = {
    readonly reads: readonly {
        /** The initializer, an earlier pattern read, or a namespace member. */
        readonly source: null | readonly [number, string | number] | readonly [StaticId]
        /** Array patterns copy the iterable before reading its elements. */
        readonly spread: boolean
    }[]
    readonly ids: readonly BindingId[]
}

export type SourceParameter = {
    readonly plan: ExpansionPlan
    /** A box distinguishes a default of null from the absence of a default. */
    readonly default: { readonly value: SourceValue } | null
}

export type SourceFunction = {
    readonly target: FunctionTarget
    /** The admitted fixed prefix before the first default, preserving length. */
    readonly length: number
    readonly parameters: readonly SourceParameter[]
    readonly rest: ExpansionPlan | null
    /** The declaration this function reads as itself, where applicable. */
    readonly self: BindingId | null
    readonly body: SourceBlock
}

export type SourceValue =
    | Primitive
    | readonly ['ref', BindingId]
    | _Unary<SourceValue> | _SourceBinary<SourceValue> | _InstanceOf<SourceValue> | _In<SourceValue>
    | _Array<SourceValue> | _Object<SourceValue> | _Access<SourceValue> | _ContinuedAccess<SourceValue>
    | _GuardedCall<SourceValue> | _ContinuedGuardedCall<SourceValue> | _Call<SourceValue>
    | _Conditional<SourceValue> | _Comma<SourceValue> | _Leaf
    | readonly ['function', SourceFunction]
    | readonly ['block', SourceBlock]

/** Resolved loops retain source evidence; sugar selects their mutable state. */
export type SourceLoop = {
    readonly target: LoopTarget
    readonly events: readonly BindingEvent[]
    readonly condition: SourceValue
    readonly body: SourceBlock
    /** A classic for's header-scoped update; its block exits normally. */
    readonly step?: SourceBlock
}

/** A switch owns break completion without changing the enclosing continue target. */
export type SourceSwitch = {
    readonly target: LoopTarget
    readonly events: readonly BindingEvent[]
    readonly discriminant: SourceValue
    readonly cases: readonly SourceCase[]
    readonly otherwise: SourceBlock
}

export type SourceStatement =
    | readonly ['initialize', ExpansionPlan, SourceValue]
    | readonly ['write', BindingId, SourceValue]
    /** Prefix and postfix statement increments share literal addition semantics. */
    | readonly ['increment', BindingId]
    /** The implicit target read precedes the operand; sugar chooses any conditional write. */
    | readonly ['compound-write', BindingId, BinaryTag, SourceValue]
    /** Both normal arms precede the next statement; an omitted else is empty. */
    | readonly ['if', SourceValue, SourceBlock, SourceBlock]
    | readonly ['while', SourceLoop]
    | readonly ['switch', SourceSwitch]
    /** Source resolution fixes the innermost loop; sugar supplies its state. */
    | readonly ['break', LoopTarget]
    | readonly ['continue', LoopTarget]
    /** Function exits retain their lexical owner through generated regions. */
    | readonly ['return', FunctionTarget, SourceValue]
    | readonly ['throw', SourceValue]

export type SourceCase = {
    readonly labels: readonly SourceValue[]
    readonly body: SourceBlock
}

/** Terminal source branches keep their lexical regions without invocations. */
export type SourceExit =
    | readonly ['yield', SourceValue]
    | readonly ['return', FunctionTarget, SourceValue]
    | readonly ['throw', SourceValue]
    /** Admitted literal-true loop with no source break to its own target. */
    | readonly ['terminal-loop', SourceLoop]
    | readonly ['if', SourceValue, SourceBlock, SourceBlock]
    | readonly ['switch', SourceValue, readonly SourceCase[], SourceBlock]

export type SourceBlock = {
    readonly statements: readonly SourceStatement[]
    readonly exit: SourceExit
}

/** Empty import lists still establish their module, without binding a name. */
export type SourceImport = AstImport & { readonly binding: BindingId | null }

export type SourceModule = {
    readonly imports: readonly SourceImport[]
    readonly body: SourceBlock
}
