/** Worklist contracts for graph conversion; no target spelling lives here. */
import type { BindingId, FunctionTarget } from '../../js/ast/types.ts'

export type Work = () => Work | null
export type Done<T> = (value: T) => Work | null
export type Context = {
    readonly target: FunctionTarget
    readonly parameters: readonly BindingId[]
    readonly rest: BindingId
    readonly self: BindingId
    readonly captures: readonly BindingId[]
    readonly loop: BindingId
    readonly result: BindingId
}
