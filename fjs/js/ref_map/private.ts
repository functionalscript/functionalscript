/**
 * Implementation types of the runtime's reference map.
 *
 * @module
 */

import type { RefMapKey } from '../../types/ref_map/types.ts'

/** The pairs a map holds, the newest first: a key, its value, and the pairs set before it. */
export type _Pairs = readonly [key: RefMapKey, value: unknown, rest: _Pairs] | undefined
