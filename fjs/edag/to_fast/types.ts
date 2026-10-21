/** Invocation values supplied by a separately established graph fragment. */
import type { BindingId } from '../../js/ast/types.ts'

export type Invocation = {
    readonly parameters?: readonly BindingId[]
    readonly rest?: BindingId
    readonly self?: BindingId
    readonly captures?: readonly BindingId[]
    readonly args?: BindingId
}
