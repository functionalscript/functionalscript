/** Normal-exit loop memo normalization worklists. @module */

import type { BindingId, Block, Exit, LoopTarget, Statement, Value } from '../../../../js/ast/types.ts'
import type { List } from '../../../../types/list/types.ts'
import type { MemoPlan } from './cells/types.ts'

export type _LoopOwner = { readonly source: LoopTarget; readonly target: LoopTarget }
export type _Context = { readonly plan: MemoPlan; readonly aliases: ReadonlyMap<BindingId, number>; readonly recipes: readonly BindingId[]; readonly memo: BindingId; readonly loop: _LoopOwner | null; readonly operand: boolean }
export type _Value = { readonly statements: List<Statement>; readonly value: Value; readonly memo: BindingId; readonly usesMemo: boolean }
export type _Values = { readonly statements: List<Statement>; readonly values: readonly Value[]; readonly memo: BindingId; readonly usesMemo: boolean }
export type _Block = { readonly block: Block; readonly memo: BindingId; readonly normal: boolean; readonly usesMemo: boolean }
export type _Exit = { readonly statements: List<Statement>; readonly exit: Exit; readonly memo: BindingId; readonly normal: boolean; readonly usesMemo: boolean }
