/**
 * Types for the DJS transpiler.
 *
 * @module
 */

import type { Unknown } from '../types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'
import type { ParseError } from '../parser/types.ts'

/** The evaluated DJS value produced for one successfully transpiled module. */
export type djsResult = { djs: Unknown }

/**
 * State threaded through the recursive transpilation of a DJS module graph.
 *
 * - `complete`: modules that have been fully parsed and evaluated, keyed by path.
 * - `stack`: import chain currently being resolved (used to detect circular dependencies).
 * - `error`: the first parse error encountered, or `null` while everything is clean.
 */
export type ParseContext = {
    readonly complete: OrderedMap<djsResult>
    readonly stack: List<string>
    readonly error: ParseError | null
}
