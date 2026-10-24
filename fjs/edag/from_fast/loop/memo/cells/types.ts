/** Caller-owned deferred recipes selected for normal helper transport. @module */

import type { BindingId, Loop, Value } from '../../../../../js/ast/types.ts'

export type MemoCell = {
    readonly binding: BindingId
    readonly initializer: Value
}

export type MemoPlan = {
    readonly cells: readonly MemoCell[]
    readonly aliases: ReadonlyMap<BindingId, number>
    readonly loops: ReadonlySet<Loop>
}
