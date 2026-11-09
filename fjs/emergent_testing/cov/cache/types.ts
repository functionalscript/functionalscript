/** Local Git-backed coverage success storage. @module */

import type { NodeOp } from '../../../effects/node/types.ts'
import type { Effect, IoChannel } from '../../../effects/types.ts'
import type { Unknown } from '../../../media/json/types.ts'

/** A repository's build-cache branch, containing successful coverage manifests. */
export type Cache = {
    readonly root: string
    readonly has: (manifest: Unknown) => Effect<NodeOp, boolean, IoChannel>
    readonly save: (manifest: Unknown) => Effect<NodeOp, void, IoChannel>
}
