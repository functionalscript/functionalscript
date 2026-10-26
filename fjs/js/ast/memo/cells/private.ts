/** Lexical snapshots and deferred dependency edges for shared memo cells. @module */

import type { BindingId, Block, Definition, Exit, Loop, Value } from '../../types.ts'
import type { List } from '../../../../types/list/types.ts'
import type { _Link as Link } from '../../control/private.ts'

export type _Root = {
    readonly binding: BindingId
    /** External lazy entries have no source declaration in this owner. */
    readonly source: {
        readonly definition: Definition
        readonly insideLoop: boolean
        readonly loop: Loop | null
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
    /** Stable occurrence identity while its body is prepared. */
    readonly source: Loop
    readonly loop: Loop
    readonly roots: readonly _Root[]
    readonly ancestors: Link<Loop> | null
    readonly transfers: readonly _Transfer[]
}

export type _Transfer = Extract<Exit, readonly ['return' | 'break' | 'continue', ...unknown[]]>

/** Only the current recipe's owned definitions; lazy initializers stay opaque. */
export type _Owned = {
    readonly roots: List<_Root>
    readonly definitions: List<readonly [Definition, _Root]>
    readonly loops: List<_LoopInfo>
    readonly pruned: boolean
}

export type _OwnedValue = { readonly value: Value; readonly owned: _Owned }
export type _OwnedValues = { readonly values: readonly Value[]; readonly owned: _Owned }
export type _OwnedBlock = { readonly block: Block; readonly normal: boolean; readonly owned: _Owned }
