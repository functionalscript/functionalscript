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
