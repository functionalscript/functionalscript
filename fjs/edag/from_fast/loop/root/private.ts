import type { Block, Function as FastFunction, Loop, Value, Statement, Exit } from '../../../../js/ast/types.ts'
import type { List } from '../../../../types/list/types.ts'

export type TerminalBlock = { readonly statements: List<Statement>; readonly exit: Extract<Exit, readonly ['return' | 'throw', ...unknown[]]> }

export type Task =
    | { readonly kind: 'done'; readonly block: TerminalBlock }
    | { readonly kind: 'call'; readonly run: () => Task }
    | { readonly kind: 'bind'; readonly first: Task; readonly next: (block: TerminalBlock) => Task }

export type Frame = { readonly next: (block: TerminalBlock) => Task; readonly rest: Frame | null }
export type Normal = (values: readonly Value[]) => Task
export type Owner = { readonly fn: FastFunction; readonly loop: Loop | null; readonly self: Value; readonly ordinary: ReadonlyMap<Block, boolean> }

export type Visit = readonly ['enter', Block] | readonly ['finish', Block, readonly Block[]]
export type Link<T> = { readonly first: T; readonly tail: Link<T> | null }
