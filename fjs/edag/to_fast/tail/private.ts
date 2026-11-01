/** Private terminal evaluation results. @module */

import type { BindingId, Block, Statement, Value } from '../../../js/ast/types.ts'

export type _Result = { readonly block: Block; readonly changed: boolean }
export type _Recipe = Extract<Statement, readonly ['define', ...unknown[]]>
export type _Plan = { readonly block: Block; readonly recipes: readonly _Recipe[] }
export type _Use = { readonly binding: BindingId; readonly owner: BindingId | null; readonly tail: boolean }
export type _UseTask =
    | { readonly kind: 'block'; readonly block: Block; readonly owner: BindingId | null; readonly tail: boolean }
    | { readonly kind: 'statement'; readonly statement: Statement; readonly owner: BindingId | null }
    | { readonly kind: 'value'; readonly value: Value; readonly owner: BindingId | null; readonly tail: boolean }
