/** Lexical snapshots and deferred dependency edges for shared memo cells. @module */

import type { BindingId, Block, Definition, Loop } from '../../../../../js/ast/types.ts'
import type { Link } from '../../../private.ts'

export type _Root = {
    readonly binding: BindingId
    /** External lazy entries have no source declaration in this owner. */
    readonly source: {
        readonly definition: Definition
        readonly insideLoop: boolean
    } | null
    readonly dependencies: readonly _Root[]
}

export type _Scope = ReadonlyMap<BindingId, _Root | null>

export type _Occurrence = { readonly block: Block; readonly normal: boolean }

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
