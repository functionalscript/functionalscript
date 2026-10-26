/** Work items for the helper-boundary lexical walk. @module */

import type { BindingId, Block, Value } from '../types.ts'

export type _Context = {
    readonly bound: readonly BindingId[]
}

export type _Task =
    | (_Context & { readonly kind: 'value'; readonly value: Value })
    | (_Context & { readonly kind: 'block'; readonly block: Block })

export type _Link<T> = { readonly first: T; readonly tail: _Link<T> | null }
