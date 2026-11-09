/** Cache operations around an isolated native coverage process. @module */

import type { Effect, IoChannel } from '../../../effects/types.ts'
import type { NodeOp } from '../../../effects/node/types.ts'
import type { Unknown } from '../../../media/json/types.ts'

export type Command = {
    readonly directory: string
    readonly files: readonly string[]
    readonly args: readonly string[]
}

export type CoverageCache = {
    readonly root?: string
    /** Extracts manifests from the graph captured when the cache opened. */
    readonly prepare: (command: Command) => Effect<NodeOp, readonly Unknown[], IoChannel>
    /** Checks the captured bytes and resolutions without rebuilding the graph. */
    readonly validate: (command: Command) => Effect<NodeOp, boolean, IoChannel>
    readonly has: (manifest: Unknown) => Effect<NodeOp, boolean, IoChannel>
    readonly saveMany: (manifests: readonly Unknown[]) => Effect<NodeOp, void, IoChannel>
    readonly sync: () => Effect<NodeOp, void, IoChannel>
}

export type Outcome = 'passed' | 'failed' | 'cached'

/** Successful inputs are returned to the caller for one end-of-run batch. */
export type RunResult = {
    readonly outcome: Outcome
    readonly manifests: readonly Unknown[]
}
