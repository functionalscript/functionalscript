/** Owning return lifting across plain value regions. @module */

import type { Block, FunctionTarget, Item, Key, LoopTarget, Statement, Step, Value } from '../types.ts'
import type { List } from '../../../types/list/types.ts'

export type _Context = {
    readonly owner: FunctionTarget | null
    readonly operand: boolean
    readonly loops: List<LoopTarget>
    readonly permitted: readonly LoopTarget[]
}

export type _ResultMode = 'value' | 'statement' | 'none'

export type _Sequence = {
    readonly statements: readonly Statement[]
    readonly values: readonly Value[]
    readonly normal: boolean
    readonly lifted: boolean
    readonly callee: boolean
    readonly admitted: boolean
}

export type _Region = {
    readonly block: Block
    readonly normal: boolean
    /** Owning returns or explicitly retained physical loop completions. */
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

export type _ChainSource =
    | readonly ['.' | '?.', Value, Key<Value>]
    | readonly ['.' | '?.', Value, Key<Value>, Step<Value>]
    | readonly ['?.()', Value, readonly Item<Value>[]]
    | readonly ['?.()', Value, readonly Item<Value>[], Step<Value>]

/** A terminal forced call joins outside every optional guard. */
export type _ChainEnd = {
    readonly args: readonly Item<Value>[] | null
    readonly member: boolean
    readonly key: Key<Value> | null
}

export type _ChainRegion = {
    readonly block: Block
    readonly normal: boolean
    readonly lifted: boolean
    readonly callee: boolean
}
