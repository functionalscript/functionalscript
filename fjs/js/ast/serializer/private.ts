/** JavaScript serialization state, containing syntax identities only. @module */

import type { BindingId, LoopTarget } from '../types.ts'
import type { Block, Function as PreparedFunction, Statement, Value } from '../prepare/types.ts'

export type _Syntax = {
    readonly values: readonly Value[]
    readonly loops: readonly LoopTarget[]
}

export type _Context = _Syntax & {
    readonly ids: readonly BindingId[]
    readonly captureAliases: readonly (readonly [PreparedFunction, readonly BindingId[]])[]
    readonly runtime: boolean
    readonly aliases: readonly (readonly [BindingId, BindingId])[]
    readonly binding: BindingId | null
    readonly external: boolean
    readonly rendered?: readonly (readonly [Value, string])[]
}

export type _ScanTask = readonly ['value', Value] | readonly ['block', Block] | readonly ['statement', Statement] | readonly ['function', PreparedFunction]
export type _Scan = _Syntax & { readonly bindings: readonly BindingId[] }
export type _ExpressionTask = readonly ['value', Value] | readonly ['finish', Value, readonly Value[]]

/** An expression renderer, with the caller's minimum precedence. */
export type _Expression = (context: _Context, value: Value, minimum?: number) => string

/** A block renderer and the disposition of a normal result. */
export type _BlockText = (context: _Context, block: Block, normal: 'return' | 'export' | 'none') => string
