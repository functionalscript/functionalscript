/** Rust spelling of prepared FAST, including the VM names the text uses. @module */

import type { BindingId } from '../../js/ast/types.ts'
import type { Function } from '../../js/ast/prepare/types.ts'

export type Use = readonly [module: 'vm' | 'unstable', name: string]
export type Printed<T> = readonly [value: T, uses: readonly Use[]]
export type Uses = {
    readonly vm: readonly string[]
    readonly unstable: readonly string[]
}
export type Scope = { readonly lines: readonly string[]; readonly uses: Uses }

/** Target runtime spelling and externally chosen function representation. */
export type Options = {
    readonly runtime: string | null
    readonly text: (fn: Function) => string
}

/** A prepared binding rendered as a target expression, for corpus adapters. */
export type External = { readonly binding: BindingId; readonly text: string; readonly uses?: readonly Use[] }
