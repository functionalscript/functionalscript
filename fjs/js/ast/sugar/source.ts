/**
 * Resolved source constructs before sugar and assignment normalization.
 * References name source declarations, including writes to their original
 * identity. No generated function, capture frame or immutable version is here.
 *
 * @module
 */

import type { Primitive } from '../../../media/datajs/types.ts'
import type { StaticId } from '../../../edag/types.ts'
import type { AstImport } from '../../../compiler/ast/types.ts'
import type {
    BindingId, FunctionTarget, LoopTarget,
    _Unary, _Binary, _InstanceOf, _Array, _Object, _Access, _ContinuedAccess,
    _GuardedCall, _ContinuedGuardedCall, _Call, _Conditional, _Comma, _Leaf,
} from '../types.ts'

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
    | _Unary<SourceValue> | _Binary<SourceValue> | _InstanceOf<SourceValue>
    | _Array<SourceValue> | _Object<SourceValue> | _Access<SourceValue> | _ContinuedAccess<SourceValue>
    | _GuardedCall<SourceValue> | _ContinuedGuardedCall<SourceValue> | _Call<SourceValue>
    | _Conditional<SourceValue> | _Comma<SourceValue> | _Leaf
    | readonly ['function', SourceFunction]
    | readonly ['block', SourceBlock]

/** The parser preserves the source scalar loop, including its assignments. */
export type SourceLoop = {
    readonly target: LoopTarget
    readonly variable: BindingId
    readonly condition: SourceValue
    readonly body: SourceBlock
}

export type SourceStatement =
    | readonly ['initialize', ExpansionPlan, SourceValue]
    | readonly ['write', BindingId, SourceValue]
    | readonly ['while', SourceLoop]

export type SourceCase = {
    readonly labels: readonly SourceValue[]
    readonly body: SourceBlock
}

/** Terminal source branches keep their lexical regions without invocations. */
export type SourceExit =
    | readonly ['yield', SourceValue]
    | readonly ['return', FunctionTarget, SourceValue]
    | readonly ['throw', SourceValue]
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
