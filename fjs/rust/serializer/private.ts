/** Rendering context; placement and transfer selection are already complete. @module */

import type { BindingId, LoopTarget, Step } from '../../js/ast/types.ts'
import type { Block, Statement, Value } from '../../js/ast/prepare/types.ts'
import type { Options, Printed } from './types.ts'
import type { List } from '../../types/list/types.ts'

export type _Context = Options & {
    readonly bindings: readonly (readonly [BindingId, Printed<string>])[]
    readonly names?: _Names
    readonly ready?: readonly ReadonlyMap<unknown, _Output>[]
}

export type _Names = {
    readonly bindings: ReadonlyMap<BindingId, string>
    readonly loops: ReadonlyMap<LoopTarget, string>
}

/** A suspended spelling operation; each child is completed before its parent. */
export type _Task =
    | { readonly kind: 'value'; readonly context: _Context; readonly value: Value; readonly result: boolean }
    | { readonly kind: 'block'; readonly context: _Context; readonly block: Block; readonly result: boolean; readonly functionBody: boolean; readonly valueBlock: boolean }
    | { readonly kind: 'statement'; readonly context: _Context; readonly statement: Statement }
    | { readonly kind: 'steps'; readonly context: _Context; readonly step: Step<Value> | undefined; readonly property: boolean; readonly member: boolean }

export type _Output = Printed<string | readonly string[]>
export type _Frame = {
    readonly task: _Task
    readonly children: readonly _Task[]
    readonly index: number
    readonly values: List<_Output>
}
