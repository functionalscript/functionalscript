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

type _Option<X extends readonly unknown[]> = { readonly [K in keyof X]?: X[K] }

export type OptionArray<N extends number, T> = _Option<FixedArray<N, T>>

/**
 * `BoundedArray` for bounds that are each a single `number` type; `Bounded` is
 * what {@link BoundedArray} distributes over its two unions.
 *
 * The optional tail is not counted up to: it is `FixedArray<Max, T>` with its
 * first `Min` elements matched off, so the recursion is `FixedArray`'s and
 * terminates on the same inputs. `Min` greater than `Max` leaves a `Max`-length
 * tuple that cannot match a `Min`-length prefix, so it resolves to `never`
 * rather than counting upwards forever.
 */
type _Bounded<Min extends number, Max extends number, T> =
    // An unknown `Min` bounds nothing, and a rest element cannot follow another
    // rest element, so neither half can be written as a tuple.
    number extends Min ? readonly T[] :
    number extends Max ? readonly [...FixedArray<Min, T>, ...readonly T[]] :
    FixedArray<Max, T> extends
        readonly [...FixedArray<Min, T>, ...infer Tail extends readonly T[]]
        ? readonly [...FixedArray<Min, T>, ..._Option<Tail>]
        : never

/**
 * `Min` required elements followed by optional ones up to `Max`; `Max` as
 * `number` leaves the tail open-ended.
 *
 * Both bounds are distributed before the walk below recurses on them. Either
 * one may be a union — `BoundedArray<1, 2 | 3, T>` is two lengths asked for at
 * once — and a union carried into the recursion neither distributes on its own
 * (a bound is compared, not destructured, so nothing makes it) nor survives:
 * it would silently drop every member but one, or recurse on a length that is
 * itself a union and never terminate.
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
type _X01 = Assert<Equal<BoundedArray<0, 1, true>, readonly [true?]>>
type _X02 = Assert<Equal<BoundedArray<0, 2, true>, readonly [true?, true?]>>
type _X11 = Assert<Equal<BoundedArray<1, 1, true>, readonly [true]>>
type _X12 = Assert<Equal<BoundedArray<1, 2, true>, readonly [true, true?]>>
type _X13 = Assert<Equal<BoundedArray<1, 3, true>, readonly [true, true?, true?]>>
type _X22 = Assert<Equal<BoundedArray<2, 2, true>, readonly [true, true]>>
type _X2_ = Assert<Equal<
    BoundedArray<2, number, true>,
    readonly [true, true, ...readonly true[]]>
>

// A union bound is every length it names, not the first one.
type _XU_Max = Assert<Equal<
    BoundedArray<1, 2 | 3, true>,
    readonly [true, true?] | readonly [true, true?, true?]>
>
type _XU_Min = Assert<Equal<
    BoundedArray<1 | 2, 3, true>,
    readonly [true, true?, true?] | readonly [true, true, true?]>
>

// A `Min` above `Max` describes no array at all.
type _X32 = Assert<Equal<BoundedArray<3, 2, true>, never>>

// An unknown bound bounds nothing.
type _X_3 = Assert<Equal<BoundedArray<number, 3, true>, readonly true[]>>

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]
