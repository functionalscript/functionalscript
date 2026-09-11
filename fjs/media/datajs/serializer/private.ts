/**
 * Implementation-private types of the DataJS writer: what reading the
 * caller's value carries from one container to the next.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { _Read, _Value } from './types.ts'

/**
 * The read so far: every container entered, and every container finished in
 * the order it finished.
 *
 * `started` is what makes a container met twice a reference to one node
 * rather than two nodes of equal shape, and it holds a container from
 * before its members are read, so the read never re-enters one and
 * terminates on a cyclic value rather than refusing it here — `link` is
 * where a cycle is refused, over the finished graph.
 */
export type _Walk = {
    readonly started: ReadonlySet<object>
    readonly finished: List<_Read>
}

/** One step of the read: the walk it leaves behind, and the value it read. */
export type _Step = readonly [_Walk, _Value<object>]
