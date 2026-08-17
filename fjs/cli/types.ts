/**
 * Types for the CLI command dispatch table.
 *
 * @module
 */

import type { NodeOp, NodeProgramOptions } from '../effects/node/types.ts'
import type { RawEffect } from '../effects/types.ts'

type Handler<O extends NodeOp> = (options: NodeProgramOptions) => RawEffect<O, number>

export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: Handler<O> | Commands<O>
}

export type Commands<O extends NodeOp> = readonly Command<O>[]
