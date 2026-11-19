/** Implementation details of resolved-source normalization. @module */

import type { Binding, BindingId, BindingScope, Block, LoopTarget, Operator, Statement, Value } from '../types.ts'
import type { LogicalTag, SourceBlock, SourceValue } from './source.ts'
import type { PersistentMap } from '../../../types/map/types.ts'
import type { Task } from '../task/types.ts'

export type Environment = readonly (readonly [BindingId, Value])[]
export type Context = {
    readonly bindings: readonly Binding[]
    readonly scopes: readonly BindingScope[]
    readonly loop: {
        readonly target: LoopTarget
        readonly sources: readonly BindingId[]
        /** Generated iteration inputs precede source state on an owning continue. */
        readonly continuePrefix?: readonly Value[]
    } | null
    readonly breakRegion: Context['loop']
    readonly writes: PersistentMap<SourceValue | SourceBlock, readonly BindingId[]>
}
export type Established = {
    readonly environment: Environment
    readonly statements: readonly Statement[]
}
export type Normalized = {
    readonly block: Block
    readonly environment: Environment
    readonly normal: boolean
    readonly hasLoopExit: boolean
    readonly hasFunctionExit: boolean
}
/** An expression may establish new immutable versions before yielding its value. */
export type _Evaluated = Established & {
    readonly value: Value
    readonly normal: boolean
}
/** Explicit recursion through source blocks and the stateful expression worklist. */
export type _NormalizeBlock = (source: SourceBlock, environment: Environment, context: Context, retained?: readonly BindingId[]) => Normalized
export type _StateTask = (source: SourceValue, environment: Environment, context: Context) => Task<_Evaluated>
/** A shared operand skeleton contains recipes for resolved source operands. */
export type _Recipes = PersistentMap<BindingId, SourceValue>
export type _EvaluatedValues = Established & {
    readonly values: readonly Value[]
    readonly normal: boolean
}
export type Work =
    | { readonly kind: 'expand'; readonly value: SourceValue; readonly rest: Work }
    | { readonly kind: 'operator'; readonly value: Operator<SourceValue>; readonly operands: readonly SourceValue[]; readonly rest: Work }
    | { readonly kind: 'logical'; readonly tag: LogicalTag; readonly operands: readonly SourceValue[]; readonly rest: Work }
    | null
export type Results = { readonly value: Value; readonly rest: Results } | null
