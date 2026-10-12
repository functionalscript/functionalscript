/**
 * Types for the CLI command dispatch table.
 *
 * @module
 */

import type { NodeOp, Program } from '../effects/node/types.ts'

/**
 * A program's entry point: either a `Program` itself or a `Commands` table
 * that `dispatch` routes to one. A module's `main` and a command's `handler`
 * are both this, so `fjs run` accepts a module that exports its table as
 * `main` without wrapping it in `dispatch`.
 */
export type Main<O extends NodeOp> = Program<O> | Commands<O>

export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: Main<O>
}

export type Commands<O extends NodeOp> = readonly Command<O>[]

/** Reference text owned by a CLI command, shared with documentation consumers. */
export type CommandReference = {
    readonly usage: string
    readonly examples: readonly string[]
    readonly note: string
    readonly docs: string
}

/** Built-in commands must carry reference text at every table level. */
export type DocumentedCommand<O extends NodeOp> = Omit<Command<O>, 'handler'> & CommandReference & {
    readonly handler: Program<O> | DocumentedCommands<O>
}

export type DocumentedCommands<O extends NodeOp> = readonly DocumentedCommand<O>[]
