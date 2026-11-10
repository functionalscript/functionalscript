/** Remote synchronization of successful coverage manifests. @module */

import type { Effect, IoChannel } from '../../../effects/types.ts'
import type { NodeOp } from '../../../effects/node/types.ts'

/** Publish one or more local successes and bring other writers' successes in. */
export type Synchronize = () => Effect<NodeOp, void, IoChannel>
