/**
 * Implementation-private types of the DataJS reader: the state of the
 * resolution.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { OrderedMap } from '../../../types/ordered_map/types.ts'
import type { Step } from '../../../types/stack_walk/types.ts'
import type { Unknown } from '../types.ts'
import type { Container, Node } from './types.ts'

/**
 * A bound value, in a box: `at` answers `null` for a name the map does not
 * hold, and a `const` may be bound to `null` itself.
 */
export type _Binding = readonly [value: Unknown]

/** The names bound so far, each to its value. */
export type _Env = OrderedMap<_Binding>

/**
 * A container being built: `container[1][index]` is being evaluated, and
 * `done` holds the values of the items before it — a list, since appending
 * to an array per item would copy the whole prefix each time.
 */
export type _Frame = {
    readonly container: Container
    readonly index: number
    readonly done: List<Unknown>
}

/** What to do next: evaluate an item inside a frame, or hand a value — or the error — to the frame on top. */
export type _Step = Step<Node, _Frame, Unknown, string>
