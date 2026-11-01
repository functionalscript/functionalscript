import type { BindingId, FunctionTarget, LoopTarget } from '../../../../js/ast/types.ts'

export type _Context = {
    readonly owner: FunctionTarget
    readonly target: LoopTarget
    readonly aliases: readonly BindingId[]
    readonly insideLoop: boolean
    readonly length: number
    readonly rest: boolean
}

export type _Result<T> = {
    readonly value: T
    readonly tail: boolean
    readonly base: boolean
}
