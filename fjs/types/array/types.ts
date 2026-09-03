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

/** A tuple for a natural-number literal; non-natural literals intentionally fail to resolve. */
export type Tuple<N extends number, T> =
    number extends N ? readonly T[] : _Tuple<N, T, readonly []>

export type KeyOf<T extends readonly unknown[]> = Index<T['length']>

type _X0 = Assert<Equal<KeyOf<readonly number[]>, number>>
type _X1 = Assert<Equal<KeyOf<readonly [true]>, 0>>
type _X2 = Assert<Equal<KeyOf<readonly [true] | readonly [false, false]>, 0 | 1>>
type _X3 = Assert<Equal<Tuple<number, true>, readonly true[]>>
type _X4 = Assert<Equal<Tuple<2, true>, readonly [true, true]>>
// type _X5 = Assert<Equal<Tuple<-1, true>, readonly [true, true]>>

type _Option<X extends readonly unknown[]> = { readonly [K in keyof X]?: X[K] }

export type OptionTuple<N extends number, T> = _Option<Tuple<N, T>>

type _Tail<
    Max extends number,
    T,
    R extends readonly unknown[],
    O extends readonly T[] = readonly [],
> =
    number extends Max ? readonly T[] :
    R['length'] extends Max
        ? _Option<O>
        : _Tail<Max, T, readonly [...R, unknown], readonly [...O, T]>

export type Array<
    Min extends number,
    Max extends number,
    T,
> =
    Tuple<Min, T> extends infer R extends readonly T[]
        ? readonly [...R, ..._Tail<Max, T, R>]
        : never

type _X00 = Assert<Equal< Array<0, 0, true>, readonly []>>
type _X01 = Assert<Equal<Array<0, 1, true>, readonly [true?]>>
type _X02 = Assert<Equal<Array<0, 2, true>, readonly [true?, true?]>>
type _X11 = Assert<Equal<Array<1, 1, true>, readonly [true]>>
type _X12 = Assert<Equal<Array<1, 2, true>, readonly [true, true?]>>
type _X13 = Assert<Equal<Array<1, 3, true>, readonly [true, true?, true?]>>
type _X22 = Assert<Equal<Array<2, 2, true>, readonly [true, true]>>
type _X2_ = Assert<Equal<
    Array<2, number, true>,
    readonly [true, true, ...readonly true[]]>
>

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]
