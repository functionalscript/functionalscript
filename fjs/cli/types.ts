/**
 * Types for the CLI command dispatch table.
 */

import type { NodeOp, Program } from '../effects/node/types.ts'

type Handler<O extends NodeOp> = Program<O>

export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: Handler<O> | Commands<O>
}

export type Commands<O extends NodeOp> = readonly Command<O>[]
