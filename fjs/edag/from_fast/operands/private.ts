/** Owning return lifting across plain value regions. @module */

import type { Block, FunctionTarget, LoopTarget, Statement, Value } from '../../../js/ast/types.ts'
import type { List } from '../../../types/list/types.ts'

export type _Context = {
    readonly owner: FunctionTarget
    readonly operand: boolean
    readonly loops: List<LoopTarget>
}

export type _Region = {
    readonly block: Block
    readonly normal: boolean
    readonly returns: boolean
    readonly lifted: boolean
    readonly callee: boolean
}

export type _Value = {
    readonly statement: Statement | null
    readonly value: Value
    readonly normal: boolean
    readonly callee: boolean
}
