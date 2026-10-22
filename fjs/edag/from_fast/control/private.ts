/** Work items for the helper-boundary lexical walk. */

import type { BindingId, Block, Value } from '../../../js/ast/types.ts'

export type Context = {
    readonly bound: readonly BindingId[]
}

export type Task =
    | (Context & { readonly kind: 'value'; readonly value: Value })
    | (Context & { readonly kind: 'block'; readonly block: Block })
