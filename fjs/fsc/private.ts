/**
 * Implementation-private types of `fjs compile`'s JSON writer: the state its
 * walk threads through a value.
 *
 * @module
 */

import type { List } from '../types/list/types.ts'
import type { Unknown } from '../djs/types.ts'

/**
 * The containers the walk has entered so far. A container met a second
 * time is one JSON cannot write, so the set is the whole state the walk
 * carries, and it is threaded rather than shared: every step returns the
 * set it leaves behind.
 */
export type _Seen = ReadonlySet<object>

/** What a step of the walk yields: the set it leaves behind, and what it wrote. */
export type _Written<T> = readonly [_Seen, T]

/** One item of a container: what precedes its value — a member's key and colon, nothing for an element — and the value. */
export type _Item = readonly [List<string>, Unknown]
