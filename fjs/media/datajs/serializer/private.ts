/**
 * Implementation-private types of the DataJS writer: what reading the
 * caller's value carries from one container to the next. A leaf is carried
 * as the leaf rule the read runs under kept it, `L`: its chunks for a tree
 * document, itself for a DataJS document.
 *
 * @module
 */

import type { List } from '../../../types/list/types.ts'
import type { Step } from '../../../types/stack_walk/types.ts'
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
export type _Walk<L> = {
    readonly started: PersistentSet<object>
    readonly finished: List<_Read<L>>
}

/** What the read leaves behind: the walk, and the value it read the root as. */
export type _Step<L> = readonly [_Walk<L>, _Value<object, L>]

/**
 * A container being read: the own properties the read will follow, in
 * observable order, the index of the one being read, and the members read
 * before it — a list, since appending to an array per member would copy the
 * whole prefix each time.
 */
export type _Frame<L> = {
    readonly value: object
    readonly kind: 'array' | 'object'
    readonly properties: readonly (readonly [string, PropertyDescriptor])[]
    readonly index: number
    readonly done: List<_Member<object, L>>
}

/**
 * What one value or one resumed frame comes to: the walk so far, and what to
 * do next — read a member of the caller's inside a frame, hand a value read
 * to the frame on top, or end the read with the refusal.
 */
export type _Visit<L> = readonly [_Walk<L>, Step<unknown, _Frame<L>, _Value<object, L>, string>]
