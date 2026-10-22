/** Implementation details of normalized FAST graph construction. @module */

import type { BindingId, Block, Value } from '../../js/ast/types.ts'
import type { Stack } from '../../common/monoid/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Exp } from '../types.ts'
import type { Environment, Transfer } from './types.ts'

export type Binding = Environment[number]

export type Link<T> = { readonly first: T; readonly tail: Link<T> | null }

export type Task<T> =
    | { readonly kind: 'done'; readonly value: T }
    | { readonly kind: 'call'; readonly run: () => Task<T> }
    | { readonly kind: 'bind'; readonly first: Task<unknown>; readonly next: (value: unknown) => Task<T> }

/** New lexical chunks override enclosing bindings; entries retain transfer order. */
export type Scope = {
    readonly index: Stack<ReadonlyMap<BindingId, Binding>>
    readonly entries: List<Binding>
}

export type ExitOwner =
    | { readonly kind: 'default' }
    | { readonly kind: 'scalar'; readonly self: Exp }
    | { readonly kind: 'custom'; readonly transfer: Transfer }

export type Node = readonly ['value', Value] | readonly ['block', Block]

export type Summary = {
    readonly references: readonly BindingId[]
    readonly required: readonly BindingId[]
    readonly reached: readonly BindingId[]
}

export type Summaries = ReadonlyMap<Node[1], Summary>
export type Visit = readonly ['enter', Node] | readonly ['finish', Node, readonly Node[]]

export type Context = {
    readonly scope: Scope
    readonly transfer: ExitOwner
    readonly summaries: Summaries
}
