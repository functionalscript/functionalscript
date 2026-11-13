/**
 * Types of the reference map.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../ts/types.ts'
import type { empty } from './module.f.js'

/** What a reference map is keyed by: a reference, never a primitive. */
export type RefMapKey = object | Function

/**
 * A reference map
 * ([proposal](../../../spec/todo/reference-map.md)): a call answers the
 * value `key` has in the map it is called on, and the resulting map.
 * `m(key)` is `[current, m]`, the same map; `m(key, value)` is
 * `[previous, m1]`, a new map with `key` set to `value`, `m` unchanged. A
 * `value` of `undefined` is no value, so the call is a read.
 */
export type RefMap = (key: RefMapKey, value?: unknown) => RefMapResult

/** What a call of a {@link RefMap} answers: the key's value in that map, and the resulting map. */
export type RefMapResult = readonly [unknown, RefMap]

// The empty map is a map.
type _Empty = Assert<Equal<typeof empty, RefMap>>
