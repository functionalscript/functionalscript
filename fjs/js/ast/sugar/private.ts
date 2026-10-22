/** Implementation details of resolved-source normalization. @module */

import type { Binding, BindingId, BindingScope, Block, Operator, Statement, Value } from '../types.ts'
import type { SourceValue } from './source.ts'

export type Environment = readonly (readonly [BindingId, Value])[]
export type Context = {
    readonly bindings: readonly Binding[]
    readonly scopes: readonly BindingScope[]
}
export type Established = {
    readonly environment: Environment
    readonly statements: readonly Statement[]
}
export type Normalized = { readonly block: Block; readonly environment: Environment }
export type Work =
    | { readonly kind: 'expand'; readonly value: SourceValue; readonly rest: Work }
    | { readonly kind: 'operator'; readonly value: Operator<SourceValue>; readonly operands: readonly SourceValue[]; readonly rest: Work }
    | null
export type Results = { readonly value: Value; readonly rest: Results } | null
export type ReferenceTask =
    | { readonly kind: 'value'; readonly value: Value }
    | { readonly kind: 'block'; readonly block: Block }

/** This pass emits value regions; a statement region is never constructed. */
export type NormalizedStatement = Exclude<Statement, readonly ['block', readonly BindingId[], Block]>
/** Source returns become yields until the ordinary function boundary closes. */
export type RegionExit = Exclude<Block['exit'], readonly ['return', unknown, Value]>
