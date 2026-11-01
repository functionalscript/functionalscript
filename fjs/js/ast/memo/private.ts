/** Loop memo normalization worklists. @module */

import type { BindingId, Block, Exit, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../types.ts'
import type { List } from '../../../types/list/types.ts'
import type { MemoLayout } from './cells/types.ts'

export type _LoopOwner = { readonly source: LoopTarget; readonly target: LoopTarget }
/** Each getter owns a fixed prefix; narrower calls preserve their caller's suffix. */
export type _Recipe = { readonly binding: BindingId; readonly width: number }
export type _Context = { readonly plan: MemoLayout; readonly aliases: ReadonlyMap<BindingId, number>; readonly selfAliases: readonly BindingId[]; readonly sourceSelf: BindingId | null; readonly recipes: readonly _Recipe[]; readonly memo: BindingId; readonly owners: List<_LoopOwner>; readonly operand: boolean; readonly sourceOwner: FunctionTarget | null; readonly recipeOwner: FunctionTarget | null; readonly completions: boolean }
export type _Value = { readonly statements: List<Statement>; readonly value: Value; readonly memo: BindingId; readonly usesMemo: boolean }
export type _Values = { readonly statements: List<Statement>; readonly values: readonly Value[]; readonly memo: BindingId; readonly usesMemo: boolean }
export type _Block = { readonly block: Block; readonly memo: BindingId; readonly normal: boolean; readonly usesMemo: boolean }
export type _Exit = { readonly statements: List<Statement>; readonly exit: Exit; readonly memo: BindingId; readonly normal: boolean; readonly usesMemo: boolean }
export type _Loop = { readonly statements: List<Statement>; readonly exit: readonly ['loop', Loop] | null; readonly memo: BindingId; readonly usesMemo: boolean; readonly changed: boolean }
