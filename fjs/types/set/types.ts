/** Type-level API of the persistent set. @module */

import type { PersistentMap } from '../map/types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../ts/types.ts'
import type { add, empty, fromValues, has, size, values } from './module.f.js'

/** A persistent SameValueZero set in first-insertion order. */
export type PersistentSet<T> = PersistentMap<T, true>

type _Empty = Assert<Equal<typeof empty, PersistentSet<never>>>
type _Values = Assert<Equal<ReturnType<typeof values<number>>, readonly number[]>>
type _Size = Assert<Equal<ReturnType<typeof size<number>>, number>>
type _FromValues = Assert<Equal<ReturnType<typeof fromValues<number>>, PersistentSet<number>>>
type _Add = Assert<Equal<ReturnType<typeof add<number>>, (set: PersistentSet<number>) => PersistentSet<number>>>
type _Has = Assert<Equal<ReturnType<typeof has<number>>, (set: PersistentSet<number>) => boolean>>
