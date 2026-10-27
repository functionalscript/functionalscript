/** Function-local loop completion normalization worklists. @module */

import type { Block, Loop, LoopTarget } from '../../../../js/ast/types.ts'
import type { Link } from '../../private.ts'

export type _Flow = { readonly returns: boolean; readonly breaks: readonly LoopTarget[]; readonly continues: readonly LoopTarget[] }
export type _BlockResult = { readonly block: Block; readonly flow: _Flow }
export type _Visit = { readonly block: Block; readonly children: readonly Block[] | null }
export type _LoopInfo = { readonly loop: Loop; readonly id: number; readonly ancestors: Link<LoopTarget> | null }
export type _InventoryTask =
    | { readonly kind: 'block'; readonly block: Block; readonly ancestors: Link<LoopTarget> | null }
    | { readonly kind: 'loop'; readonly loop: Loop; readonly ancestors: Link<LoopTarget> | null }
export type _TransferCase = { readonly kind: 'break' | 'continue'; readonly info: _LoopInfo }
