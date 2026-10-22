/** State private to common FAST preparation. @module */

import type { BindingId, Block as NormalBlock, Exit as NormalExit, Function as NormalFunction, Loop, LoopTarget, Statement as NormalStatement, Value as NormalValue } from '../types.ts'
import type { Block, Statement, Value } from './types.ts'

export type _Link<T> = { readonly first: T; readonly tail: _Link<T> | null }

/** Suspended immutable computations keep syntax depth off the host stack. */
export type _Task<T> =
    | { readonly tag: 'done'; readonly value: T }
    | { readonly tag: 'call'; readonly run: () => _Task<T> }
    | { readonly tag: 'bind'; readonly first: _Task<unknown>; readonly next: (value: unknown) => _Task<T> }

export type _Node =
    | readonly ['value', NormalValue]
    | readonly ['block', NormalBlock]
    | readonly ['function', NormalFunction]
    | readonly ['loop', Loop]
    | readonly ['statement', NormalStatement]
    | readonly ['exit', NormalExit]

export type _Flow = { readonly next: number; readonly returns: boolean; readonly loops: readonly LoopTarget[] }
export type _Facts = {
    readonly children: readonly _Node[]
    readonly ids: readonly BindingId[]
    readonly returns: boolean
    readonly loops: readonly LoopTarget[]
}
export type _Visit = readonly ['enter', _Node] | readonly ['finish', _Node, _Facts]
export type _Flows = ReadonlyMap<_Node[1], _Flow>

export type _Loop = {
    readonly target: LoopTarget
    readonly parameters: readonly BindingId[]
    readonly results: readonly BindingId[]
}

export type _Context = {
    readonly flows: _Flows
    readonly next: number
    readonly memos: readonly BindingId[]
    readonly loops: readonly _Loop[]
    readonly yields: readonly BindingId[] | null
    readonly reads: readonly (readonly [BindingId, BindingId])[]
}

export type _Prepared<T> = { readonly value: T; readonly next: number }
export type _Statements = _Prepared<readonly Statement[]>
export type _Values = _Prepared<readonly Value[]>
export type _Block = _Prepared<Block>
export type _Value = {
    readonly value: Value
    readonly statements: readonly Statement[]
    readonly next: number
}
