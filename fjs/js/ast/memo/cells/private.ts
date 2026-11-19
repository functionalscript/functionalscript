/** Lexical snapshots and deferred dependency edges for shared memo cells. @module */

import type { PersistentMap } from '../../../../types/map/types.ts'
import type { BindingId, Block, Definition, Exit, Loop, Value } from '../../types.ts'
import type { List } from '../../../../types/list/types.ts'
import type { _Link as Link } from '../../control/private.ts'
import type { Task } from '../../task/types.ts'

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

export type _Scope = PersistentMap<BindingId, _Root>

export type _LoopInfo = {
    /** Stable occurrence identity while its body is prepared. */
    readonly source: Loop
    readonly loop: Loop
    readonly roots: readonly _Root[]
    /** Lifetime transport crosses eager operands; targeted transfers do not. */
    readonly ancestors: Link<Loop> | null
    readonly owners: Link<Loop> | null
    readonly transfers: readonly _Transfer[]
}

export type _Transfer = Extract<Exit, readonly ['return' | 'break' | 'continue', ...unknown[]]>

/** Definitions owned by the current caller or recipe; lazy initializers stay opaque. */
export type _Owned = {
    readonly roots: List<_Root>
    readonly definitions: List<readonly [Definition, _Root]>
    readonly loops: List<_LoopInfo>
    readonly pruned: boolean
}

export type _OwnedValue = { readonly value: Value; readonly owned: _Owned }
export type _OwnedValues = { readonly values: readonly Value[]; readonly owned: _Owned }
export type _OwnedBlock = { readonly block: Block; readonly normal: boolean; readonly owned: _Owned }

/** Static dependency origins while inspecting deferred bodies for crossings. */
export type _DeferredBinding = { readonly roots: readonly _Root[]; readonly depth: number }
export type _DeferredScope = PersistentMap<BindingId, _DeferredBinding>
export type _DeferredSummary = {
    readonly dependencies: readonly _Root[]
    readonly crossed: boolean
    readonly selected: List<_Root>
}
export type _DeferredBlock = { readonly summary: _DeferredSummary; readonly normal: boolean }

/** The recursive eager-region walkers passed across value/block boundaries. */
export type _OwnedBlockTask = (source: Block, scope: _Scope, ancestors: Link<Loop> | null, owners: Link<Loop> | null) => Task<_OwnedBlock>
export type _OwnedValueTask = (source: Value, scope: _Scope, ancestors: Link<Loop> | null) => Task<_OwnedValue>

/** Deferred walkers retain lexical origins without evaluating their recipes. */
export type _DeferredBlockTask = (source: Block, scope: _DeferredScope, depth: number) => Task<_DeferredBlock>
export type _DeferredValueTask = (source: Value, scope: _DeferredScope, depth: number) => Task<_DeferredSummary>
