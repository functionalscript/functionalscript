/** Implementation details of normalized FAST graph construction. @module */

import type { BindingId, Exit, Operator, Value } from '../../js/ast/types.ts'
import type { Stack } from '../../common/monoid/types.ts'
import type { List } from '../../types/list/types.ts'
import type { Environment, Lowered } from './types.ts'

export type Binding = Environment[number]

/** Identity-keyed balanced runs, plus the original order for external transfers. */
export type Scope = {
    readonly index: Stack<ReadonlyMap<BindingId, Binding>>
    readonly entries: List<Binding>
}

export type ScopedTransfer = (exit: Exit, scope: Scope) => Lowered

export type Work =
    | { readonly kind: 'expand'; readonly value: Value; readonly rest: Work }
    | { readonly kind: 'operator'; readonly operator: Operator<Value>; readonly operands: readonly Value[]; readonly rest: Work }
    | null

export type Results = { readonly value: Lowered; readonly rest: Results } | null
