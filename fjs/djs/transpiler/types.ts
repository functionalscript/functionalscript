/**
 * Types for the DJS transpiler.
 */

import type { Unknown } from '../types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'

/** The evaluated DJS value produced for one successfully transpiled module. */
export type djsResult = { djs: Unknown }

/**
 * State threaded through the recursive transpilation of a DJS module graph.
 *
 * - `complete`: modules that have been fully parsed and evaluated, keyed by path.
 * - `stack`: import chain currently being resolved (used to detect circular dependencies).
 *
 * There is no `error` field. It used to hold "the first parse error
 * encountered, or `null` while everything is clean" — a hand-rolled error
 * channel that every step had to set, and that three separate places had to
 * test before doing any work. It is the effect's channel now
 * (`Effect<ReadFile, ParseContext, ParseError>`), so `step` short-circuits and
 * a context that exists is a context that is still good.
 */
export type ParseContext = {
    readonly complete: OrderedMap<djsResult>
    readonly stack: List<string>
}
