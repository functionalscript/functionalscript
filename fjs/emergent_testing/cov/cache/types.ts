/** Local Git-backed coverage success storage. @module */

import type { NodeOp } from '../../../effects/node/types.ts'
import type { Effect, IoChannel } from '../../../effects/types.ts'
import type { Unknown } from '../../../media/json/types.ts'

/** One canonical manifest, hashed once while preparing the coverage plan. */
export type Entry = {
    readonly manifest: Unknown
    readonly key: string
    readonly path: string
    readonly payload: string
    readonly byteLength: number
}

/** Batched reads and successful additions to a repository's build-cache branch. */
export type Cache = {
    readonly root: string
    readonly prepare: (manifest: Unknown) => Effect<NodeOp, Entry, IoChannel>
    readonly lookup: (entries: readonly Entry[]) => Effect<NodeOp, readonly boolean[], IoChannel>
    readonly saveMany: (entries: readonly Entry[]) => Effect<NodeOp, void, IoChannel>
}
