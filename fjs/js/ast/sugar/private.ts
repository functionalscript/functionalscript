/** Implementation details of resolved-source normalization. @module */

import type { Binding, BindingId, BindingScope, Block, LoopTarget, Operator, Statement, Value } from '../types.ts'
import type { LogicalTag, SourceValue } from './source.ts'

export type Environment = readonly (readonly [BindingId, Value])[]
export type Context = {
    readonly bindings: readonly Binding[]
    readonly scopes: readonly BindingScope[]
    readonly loop: { readonly target: LoopTarget; readonly sources: readonly BindingId[] } | null
    readonly breakRegion: Context['loop']
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
export type Work =
    | { readonly kind: 'expand'; readonly value: SourceValue; readonly rest: Work }
    | { readonly kind: 'operator'; readonly value: Operator<SourceValue>; readonly operands: readonly SourceValue[]; readonly rest: Work }
    | { readonly kind: 'logical'; readonly tag: LogicalTag; readonly operands: readonly SourceValue[]; readonly rest: Work }
    | null
export type Results = { readonly value: Value; readonly rest: Results } | null
export type ReferenceTask =
    | { readonly kind: 'value'; readonly value: Value }
    | { readonly kind: 'block'; readonly block: Block }

/** This pass emits value regions; a statement region is never constructed. */
export type NormalizedStatement = Exclude<Statement, readonly ['block', readonly BindingId[], Block]>
