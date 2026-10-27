/** Worklist contracts for graph conversion; no target spelling lives here. @module */
import type { BindingId, Function as FastFunction, FunctionTarget } from '../../js/ast/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'

export type Work = () => Work | null
export type Done<T> = (value: T) => Work | null
export type _FunctionBody = Pick<FastFunction, 'parameters' | 'rest' | 'self' | 'body'> & {
    /** Preserve the established function owner after generic tail elimination. */
    readonly named: boolean
}
export type Context = {
    readonly target: FunctionTarget
    readonly parameters: readonly BindingId[]
    readonly rest: BindingId
    readonly self: BindingId
    readonly captures: readonly BindingId[]
    readonly loop: BindingId
    readonly result: BindingId
    /** Operand roots whose local owners stay after earlier operand work. */
    readonly regions: readonly number[]
    readonly functions: OrderedMap<_FunctionBody>
}
