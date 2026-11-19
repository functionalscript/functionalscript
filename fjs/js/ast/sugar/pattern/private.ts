/** Work items of the stack-safe source-pattern planner. @module */

import type { BindingElement, BindingProperty, BindingTarget, Node } from '../../../../compiler/parser/syntax/types.ts'
import type { ModuleTokenWithMetadata } from '../../../../compiler/tokenizer/types.ts'
import type { ExpansionPlan } from '../source.ts'
import type { Stack as StackOf } from '../../../../types/stack_walk/types.ts'
import type { List } from '../../../../types/list/types.ts'

export type Source = ExpansionPlan['reads'][number]['source']
export type Read = ExpansionPlan<Node>['reads'][number]
export type Pending =
    | { readonly target: BindingTarget; readonly source: Source; readonly default?: { readonly value: Node } }
    | { readonly element: BindingElement; readonly source: readonly [number, number] }
    | {
        readonly properties: readonly BindingProperty[]
        readonly index: number
        readonly parent: number | ModuleTokenWithMetadata
        readonly excluded: List<string>
    }
export type Stack = StackOf<Pending>
