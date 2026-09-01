/**
 * Types for JavaScript immutable arrays.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../ts/types.ts'

type _Tuple<N extends number, T, R extends readonly T[]> =
    N extends R['length'] ? R : _Tuple<N, T, readonly [...R, T]>

type _Index<N extends number, R extends readonly unknown[]> =
    R['length'] extends N
        ? never
        : R['length'] | _Index<N, readonly [...R, unknown]>

export type Index<N extends number> =
    number extends N ? number : N extends number ? _Index<N, readonly []> : never

export type Tuple<N extends number, T> =
    number extends N ? readonly T[] : _Tuple<N, T, readonly []>

export type KeyOf<T extends readonly unknown[]> = Index<T['length']>

type _X0 = Assert<Equal<KeyOf<readonly number[]>, number>>
type _X1 = Assert<Equal<KeyOf<readonly [true]>, 0>>
type _X2 = Assert<Equal<KeyOf<readonly [true] | readonly [false, false]>, 0 | 1>>
type _X3 = Assert<Equal<Tuple<number, true>, readonly true[]>>
type _X4 = Assert<Equal<Tuple<2, true>, readonly [true, true]>>

export type Array1_5<T> =
    Tuple<1, T> | Tuple<2, T> | Tuple<3, T> | Tuple<4, T> | Tuple<5, T>

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]
