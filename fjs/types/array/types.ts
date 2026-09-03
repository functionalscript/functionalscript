/**
 * Types for JavaScript immutable arrays.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../ts/types.ts'

type _FixedArray<N extends number, T, R extends readonly T[]> =
    N extends R['length'] ? R : _FixedArray<N, T, readonly [...R, T]>

type _Index<N extends number, R extends readonly unknown[]> =
    R['length'] extends N
        ? never
        : R['length'] | _Index<N, readonly [...R, unknown]>

export type Index<N extends number> =
    number extends N ? number : N extends number ? _Index<N, readonly []> : never

/** A tuple for a natural-number literal; non-natural literals intentionally fail to resolve. */
export type FixedArray<N extends number, T> =
    number extends N ? readonly T[] : _FixedArray<N, T, readonly []>

export type KeyOf<T extends readonly unknown[]> = Index<T['length']>

type _X0 = Assert<Equal<KeyOf<readonly number[]>, number>>
type _X1 = Assert<Equal<KeyOf<readonly [true]>, 0>>
type _X2 = Assert<Equal<KeyOf<readonly [true] | readonly [false, false]>, 0 | 1>>
type _X3 = Assert<Equal<FixedArray<number, true>, readonly true[]>>
type _X4 = Assert<Equal<FixedArray<2, true>, readonly [true, true]>>
// type _X5 = Assert<Equal<FixedArray<-1, true>, readonly [true, true]>>
type _XMax = FixedArray<998, true>

type _Option<X extends readonly unknown[]> = { readonly [K in keyof X]?: X[K] }

export type OptionArray<N extends number, T> = _Option<FixedArray<N, T>>

type _ArrayFrom<
    Max extends number,
    T,
    R extends readonly T[],
> =
    R['length'] extends Max
        ? R
        : R | _ArrayFrom<Max, T, readonly [...R, T]>

/**
 * {@link BoundedArray} for bounds that are each a single `number` type: what
 * that type distributes each of its two bounds over. `R` is the walk up to
 * `Min`, and is an accumulator rather than an argument a caller supplies.
 */
type _Bounded<
    Min extends number,
    Max extends number,
    T,
    R extends readonly T[] = readonly [],
> =
    R['length'] extends Min
        ? number extends Max
            ? readonly [...R, ...T[]]
            // `R` is `Min` long here, so a `Max`-long tuple holds it as a
            // prefix exactly when `Max` is at least `Min`. Without the check a
            // `Min` above `Max` walks upwards past a `Max` it can never reach.
            : FixedArray<Max, T> extends readonly [...R, ...unknown[]]
                ? _ArrayFrom<Max, T, R>
                : never
        : _Bounded<Min, Max, T, readonly [...R, T]>

/**
 * Every length from `Min` to `Max`, as the union of those fixed-length arrays;
 * `Max` as `number` leaves the tail open-ended.
 *
 * Both bounds are distributed before the walk above recurses on them. Either
 * one may be a union — `BoundedArray<1, 2 | 3, T>` is two lengths asked for at
 * once — and a bound is compared rather than destructured, so nothing
 * distributes it on the way in: the walk would stop at the first member it
 * matched and silently drop the rest.
 */
export type BoundedArray<
    Min extends number,
    Max extends number,
    T,
> =
    // Both are naked type parameters in a checked position, which is what makes
    // the conditional distribute; the `never` branches are unreachable, since
    // each is constrained to `number` already.
    Min extends number
        ? Max extends number ? _Bounded<Min, Max, T> : never
        : never

type _X00 = Assert<Equal<BoundedArray<0, 0, true>, readonly []>>
type _X01 = Assert<Equal<BoundedArray<0, 1, true>, readonly []|readonly[true]>>
type _X02 = Assert<Equal<BoundedArray<0, 2, true>, readonly []|readonly[true]|readonly[true, true]>>
type _X11 = Assert<Equal<BoundedArray<1, 1, true>, readonly [true]>>
type _X12 = Assert<Equal<BoundedArray<1, 2, true>, readonly [true]|readonly[true, true]>>
type _X13 = Assert<Equal<BoundedArray<1, 3, true>, FixedArray<1, true>|FixedArray<2, true>|FixedArray<3, true>>>
type _X22 = Assert<Equal<BoundedArray<2, 2, true>, readonly [true, true]>>
type _X2_ = Assert<Equal<
    BoundedArray<2, number, true>,
    readonly [true, true, ...readonly true[]]>
>
type _XXMax = BoundedArray<0, 48, true>

// A union bound is every length it names, not the first one matched.
type _XU_Max = Assert<Equal<
    BoundedArray<1, 2 | 3, true>,
    readonly [true] | readonly [true, true] | readonly [true, true, true]>
>
type _XU_Min = Assert<Equal<
    BoundedArray<1 | 2, 3, true>,
    readonly [true] | readonly [true, true] | readonly [true, true, true]>
>

// A `Min` above `Max` describes no array at all.
type _X32 = Assert<Equal<BoundedArray<3, 2, true>, never>>

// An unknown `Min` bounds nothing below `Max`.
type _X_3 = Assert<Equal<
    BoundedArray<number, 3, true>,
    readonly [] | readonly [true] | readonly [true, true] | readonly [true, true, true]>
>

type _Tail<
    Max extends number,
    T,
    R extends readonly unknown[],
    O extends readonly T[] = readonly [],
> =
    number extends Max ? readonly [...O, ...T[]] :
    R['length'] extends Max
        ? _Option<O>
        : _Tail<Max, T, readonly [...R, unknown], readonly [...O, T]>

export type RangeArray<
    Min extends number,
    Max extends number,
    T,
> =
    FixedArray<Min, T> extends infer R extends readonly T[]
        ? readonly [...R, ..._Tail<Max, T, R>]
        : never

type _Y00 = Assert<Equal<RangeArray<0, 0, true>, readonly[]>>
type _Y01 = Assert<Equal<RangeArray<0, 1, true>, readonly[true?]>>
type _Y02 = Assert<Equal<RangeArray<0, 2, true>, readonly[true?, true?]>>
type _Y11 = Assert<Equal<RangeArray<1, 1, true>, readonly[true]>>
type _Y12 = Assert<Equal<RangeArray<1, 2, true>, readonly[true, true?]>>
type _Y13 = Assert<Equal<RangeArray<1, 3, true>, readonly[true, true?, true?]>>
type _Y22 = Assert<Equal<RangeArray<2, 2, true>, readonly[true, true]>>
type _Y2_ = Assert<Equal<
    RangeArray<2, number, true>,
    readonly [true, true, ...readonly true[]]>
>
type _YXMax = RangeArray<0, 999, true>

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]
