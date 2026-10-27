/** Compatibility types for shared FAST lazy cell planning. @module */

import type { MemoCell as SharedMemoCell, MemoLayout as SharedMemoLayout, MemoPlan as SharedMemoPlan, RecipePlan as SharedRecipePlan } from '../../../../../js/ast/memo/cells/types.ts'

export type MemoCell = SharedMemoCell
export type MemoLayout = SharedMemoLayout
export type MemoPlan = SharedMemoPlan
export type RecipePlan = SharedRecipePlan
