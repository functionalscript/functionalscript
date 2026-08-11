/**
 * Types for the CLI command dispatch table.
 *
 * @module
 */

import type { NodeOp, NodeProgramOptions } from '../effects/node/types.ts'
import type { Effect } from '../effects/types.ts'

/** @internal */
export type _Handler<O extends NodeOp> = (options: NodeProgramOptions) => Effect<O, number>

export type Command<O extends NodeOp> = {
    readonly names: readonly string[]
    readonly description: string
    readonly handler: _Handler<O> | Commands<O>
}

export type Commands<O extends NodeOp> = readonly Command<O>[]
