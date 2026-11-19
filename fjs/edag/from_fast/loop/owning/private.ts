import type { BindingId, Block, FunctionTarget, LoopTarget } from '../../../../js/ast/types.ts'
import type { Task } from '../../../../js/ast/task/types.ts'

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

/** The recursive block walk is an explicit dependency of its operand helpers. */
export type _BlockTask = (block: Block, context: _Context, returnedYield: boolean) => Task<_Result<Block>>
