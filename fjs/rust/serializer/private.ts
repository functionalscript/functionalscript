/** Rendering context; placement and transfer selection are already complete. @module */

import type { Primitive } from '../../media/datajs/types.ts'
import type { BindingId, LoopTarget, Step } from '../../js/ast/types.ts'
import type { Block, Function, Statement, Value } from '../../js/ast/prepare/types.ts'
import type { Options, Printed } from './types.ts'
import type { List } from '../../types/list/types.ts'
import type { PersistentMap } from '../../types/map/types.ts'

export type _StaticValue = Primitive | _Descriptor
export type _ContainerLiteral = Extract<Value, readonly ['array' | 'object', unknown]>
export type _ContainerVisit = { readonly kind: 'container'; readonly value: _ContainerLiteral; readonly id: BindingId | null }
export type _ContainerItem = _StaticValue | { readonly id: null; readonly definition: _Definition }
export type _Container =
    | { readonly kind: 'Array'; readonly items: readonly _ContainerItem[] }
    | { readonly kind: 'Object'; readonly fields: readonly (readonly [string, _ContainerItem])[] }
export type _Definition = _Container | { readonly kind: 'Function'; readonly fn: Function }
export type _Descriptor = { readonly id: BindingId; readonly definition: _Definition }
export type _StaticBindings = PersistentMap<BindingId, _StaticValue>

export type _Context = Options & {
    readonly captures?: _StaticBindings | undefined
    readonly moduleInit?: boolean
    readonly native?: boolean
    readonly bindings: readonly (readonly [BindingId, Printed<string>])[]
    readonly ownership?: undefined | {
        readonly aliases: PersistentMap<BindingId, BindingId>
        readonly moves: PersistentMap<BindingId, Statement | null>
    }
    readonly owner?: Statement
    readonly names?: _Names
    readonly ready?: readonly PersistentMap<unknown, _Output>[]
}

export type _Names = {
    readonly containers: PersistentMap<Value, _Container>
    readonly staticBindings: _StaticBindings
    readonly staticFunctions: PersistentMap<Function, _StaticBindings>
    readonly literals: PersistentMap<string | bigint, number>
    readonly bindings: PersistentMap<BindingId, string>
    readonly loops: PersistentMap<LoopTarget, string>
}

/** A suspended spelling operation; each child is completed before its parent. */
export type _Task =
    | { readonly kind: 'value'; readonly context: _Context; readonly value: Value; readonly result: boolean }
    | { readonly kind: 'block'; readonly callable?: Function; readonly context: _Context; readonly block: Block; readonly result: boolean; readonly functionBody: boolean; readonly valueBlock: boolean }
    | { readonly kind: 'statement'; readonly context: _Context; readonly statement: Statement; readonly members?: readonly Function[] }
    | { readonly kind: 'steps'; readonly context: _Context; readonly step: Step<Value> | undefined; readonly property: boolean; readonly member: boolean }

export type _Output = Printed<string | readonly string[]>
export type _Frame = {
    readonly task: _Task
    readonly children: readonly _Task[]
    readonly index: number
    readonly values: List<_Output>
}
