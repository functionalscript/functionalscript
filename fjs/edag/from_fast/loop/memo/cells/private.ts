/** Lexical snapshots for the first shared memo boundary. @module */

import type { BindingId, Block, Loop, Value } from '../../../../../js/ast/types.ts'
import type { Link } from '../../../private.ts'

export type _Root = {
    readonly binding: BindingId
    readonly initializer: Value
    readonly insideLoop: boolean
    readonly dependencies: readonly _Root[]
}

export type _Scope = ReadonlyMap<BindingId, _Root | null>

export type _Visit = {
    readonly block: Block
    readonly index: number
    readonly scope: _Scope
    readonly ancestors: Link<Loop> | null
}

export type _LoopInfo = {
    readonly loop: Loop
    readonly roots: readonly _Root[]
    readonly ancestors: Link<Loop> | null
}

export type _TransferVisit = {
    readonly block: Block
    readonly loop: Loop
}
