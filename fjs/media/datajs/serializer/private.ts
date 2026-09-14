/**
 * Implementation-private types of the DataJS writer: what reading the
 * caller's value carries from one container to the next.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { PersistentSet } from '../../../types/set/types.ts'
import type { _Member, _Read, _Value } from './types.ts'

/**
 * The read so far: every container entered, and every container finished in
 * the order it finished.
 *
 * `started` is what makes a container met twice a reference to one node
 * rather than two nodes of equal shape, and it holds a container from
 * before its members are read, so the read never re-enters one and
 * terminates on a cyclic value rather than refusing it here — `link` is
 * where a cycle is refused, over the finished graph. It is a persistent
 * set with a logarithmic add, since one is added per container and
 * `new Set([...prev, value])` would copy every container so far each time.
 */
export type _Walk = {
    readonly started: PersistentSet<object>
    readonly finished: List<_Read>
}

/** What the read leaves behind: the walk, and the value it read the root as. */
export type _Step = readonly [_Walk, _Value<object>]

/**
 * A container being read: the own properties the read will follow, in
 * observable order, the index of the one being read, and the members read
 * before it — a list, since appending to an array per member would copy the
 * whole prefix each time.
 */
export type _Frame = {
    readonly value: object
    readonly kind: 'array' | 'object'
    readonly properties: readonly (readonly [string, PropertyDescriptor])[]
    readonly index: number
    readonly done: List<_Member<object>>
}

/** The containers suspended around the value being read, innermost on top. */
export type _Stack = { readonly top: _Frame, readonly rest: _Stack } | null

/** What to do next: read a value of the caller's, or hand a value read to the frame on top. */
export type _Todo = readonly ['enter', unknown] | _Value<object>

/** The next thing to do, or the refusal that ends the read. */
export type _Next = Result<_Todo, string>

/** The read in progress: the suspended containers, the walk so far, and what to do next. */
export type _State = readonly [stack: _Stack, walk: _Walk, next: _Next]
