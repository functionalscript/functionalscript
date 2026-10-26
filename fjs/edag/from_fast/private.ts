/** Implementation details of normalized FAST graph construction. @module */

import type { BindingId, Block, FunctionTarget, Value } from '../../js/ast/types.ts'
import type { Stack } from '../../common/monoid/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Exp } from '../types.ts'
import type { Environment, Lowered, Transfer } from './types.ts'

export type Binding = Environment[number]

export type Link<T> = { readonly first: T; readonly tail: Link<T> | null }

/** New lexical chunks override enclosing bindings; entries retain transfer order. */
export type Scope = {
    readonly index: Stack<ReadonlyMap<BindingId, Binding>>
    readonly entries: List<Binding>
    readonly lazy: List<BindingId>
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
    readonly entry: readonly BindingId[]
    readonly returns: boolean
    readonly normal: boolean
}

export type Summaries = ReadonlyMap<Node[1], Summary>
export type Visit = readonly ['enter', Node] | readonly ['finish', Node, readonly Node[]]

export type Context = {
    readonly scope: Scope
    readonly transfer: ExitOwner
    readonly summaries: Summaries
    readonly functionTarget: FunctionTarget | null
    /** Eager descendants have already been planned by this region's owner. */
    readonly memoPrepared: boolean
}

/** Region control keeps normal joins separate from terminal evaluations. */
export type _Control = { readonly normal: boolean; readonly node: _ControlNode }
export type _ControlNode =
    | { readonly kind: 'normal'; readonly values: readonly Lowered[] }
    | { readonly kind: 'terminal'; readonly value: Lowered }
    | { readonly kind: 'if'; readonly test: Lowered; readonly then: _Control; readonly otherwise: _Control }
    | { readonly kind: 'prefix'; readonly anchors: readonly Exp[]; readonly next: _Control }
    | { readonly kind: 'join'; readonly body: _Control; readonly next: _Control }
