/** Work items of the stack-safe source-pattern planner. @module */

import type { BindingElement, BindingProperty, BindingTarget } from '../../../../compiler/parser/syntax/types.ts'
import type { ModuleTokenWithMetadata } from '../../../../compiler/tokenizer/types.ts'
import type { ExpansionPlan } from '../source.ts'
import type { Stack as StackOf } from '../../../../types/stack_walk/types.ts'

export type Source = ExpansionPlan['reads'][number]['source']
export type Read = ExpansionPlan['reads'][number]
export type Pending =
    | { readonly target: BindingTarget; readonly source: Source }
    | { readonly element: BindingElement; readonly source: Source }
    | { readonly property: BindingProperty; readonly parent: number | ModuleTokenWithMetadata }
export type Stack = StackOf<Pending>
