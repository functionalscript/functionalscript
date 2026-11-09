/** Cache operations around an isolated native coverage process. @module */

import type { Effect, IoChannel } from '../../../effects/types.ts'
import type { NodeOp } from '../../../effects/node/types.ts'
import type { Entry } from '../cache/types.ts'

export type Command = {
    readonly directory: string
    readonly files: readonly string[]
    readonly args: readonly string[]
}

export type CoverageCache = {
    readonly root?: string
    /** Materialize each manifest and its storage identity during planning. */
    readonly prepare: (command: Command) => Effect<NodeOp, readonly Entry[], IoChannel>
    /** One batch lookup, with one result for each entry in input order. */
    readonly lookup: (entries: readonly Entry[]) => Effect<NodeOp, readonly boolean[], IoChannel>
    /** Checks the captured bytes and resolutions without rebuilding the graph. */
    readonly validate: (command: Command) => Effect<NodeOp, boolean, IoChannel>
    readonly saveMany: (entries: readonly Entry[]) => Effect<NodeOp, void, IoChannel>
    readonly sync: () => Effect<NodeOp, void, IoChannel>
}

export type Outcome = 'passed' | 'failed' | 'cached'

/** A directory's admission and hits, captured before any coverage child runs. */
export type Planned = {
    readonly command: Command
    readonly entries: readonly Entry[] | null
    readonly cached: boolean
}

/** Successful inputs are returned to the caller for one end-of-run batch. */
export type RunResult = {
    readonly outcome: Outcome
    readonly entries: readonly Entry[]
}
