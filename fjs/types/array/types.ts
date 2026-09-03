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

/**
 * Up to `N` elements, each optional. An unknown `N` removes the ceiling — it
 * does not admit an absent element in an array that has no fixed length, which
 * is what mapping `_Option` over `readonly T[]` would say.
 */
export type OptionArray<N extends number, T> =
    number extends N ? readonly T[] : _Option<FixedArray<N, T>>

type _O2 = Assert<Equal<OptionArray<2, true>, readonly [true?, true?]>>
type _O_ = Assert<Equal<OptionArray<number, true>, readonly true[]>>

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
type _XXMax1 = BoundedArray<1, 49, true>

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

export type OfLength<
    T extends readonly unknown[],
    L extends number,
> =
    T extends readonly unknown[]
        ? T['length'] extends L
            ? T
            : never
        : never

type _M = Assert<Equal<OfLength<BoundedArray<1, 49, true>, 2>, readonly [true, true]>>

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

/**
 * The walk up to `Min`, which is also what rules out a `Min` above `Max`:
 * reaching `Max` first means the two bounds crossed and no array satisfies
 * them, where `_Tail` alone would count upwards past a `Max` it can never
 * reach. Checking it here rather than against a `Max`-long tuple is what keeps
 * it free — `Min` steps here plus `Max - Min` in `_Tail` is the `Max` steps
 * the walk already cost.
 */
type _Walk<
    Min extends number,
    Max extends number,
    T,
    R extends readonly T[] = readonly [],
> =
    R['length'] extends Max
        ? R['length'] extends Min ? R : never
        : R['length'] extends Min
            ? readonly [...R, ..._Tail<Max, T, R>]
            : _Walk<Min, Max, T, readonly [...R, T]>

/**
 * {@link OptionalTailArray} for bounds that are each a single `number` type:
 * what that type distributes each of its two bounds over.
 */
type _Range<Min extends number, Max extends number, T> =
    // An open `Max` has to be answered before the walk, which would otherwise
    // read its very first `0 extends number` as having arrived. With no bound
    // at either end nothing is left to describe but the array; with only `Min`
    // known, `FixedArray<number, T>` could not open a tuple anyway, since a
    // rest element cannot follow another rest element.
    number extends Max
        ? number extends Min
            ? readonly T[]
            : readonly [...FixedArray<Min, T>, ...T[]]
        // An unknown `Min` is no lower bound — but it does not release the
        // upper one, so the walk starts from zero rather than the whole of
        // `Max` being dropped.
        : _Walk<number extends Min ? 0 : Min, Max, T>

/**
 * `Min` required elements followed by optional ones up to `Max`, as one tuple
 * rather than {@link BoundedArray}'s union of lengths; `Max` as `number` leaves
 * the tail open-ended.
 *
 * Both bounds are distributed before `_Tail` walks them: a bound is compared
 * rather than destructured, so a union carried into the walk would stop at the
 * first member matched and silently drop the rest.
 */
export type OptionalTailArray<
    Min extends number,
    Max extends number,
    T,
> =
    // Both are naked type parameters in a checked position, which is what makes
    // the conditional distribute; the `never` branches are unreachable, since
    // each is constrained to `number` already.
    Min extends number
        ? Max extends number ? _Range<Min, Max, T> : never
        : never

type _Y00 = Assert<Equal<OptionalTailArray<0, 0, true>, readonly[]>>
type _Y01 = Assert<Equal<OptionalTailArray<0, 1, true>, readonly[true?]>>
type _Y02 = Assert<Equal<OptionalTailArray<0, 2, true>, readonly[true?, true?]>>
type _Y11 = Assert<Equal<OptionalTailArray<1, 1, true>, readonly[true]>>
type _Y12 = Assert<Equal<OptionalTailArray<1, 2, true>, readonly[true, true?]>>
type _Y13 = Assert<Equal<OptionalTailArray<1, 3, true>, readonly[true, true?, true?]>>
type _Y22 = Assert<Equal<OptionalTailArray<2, 2, true>, readonly[true, true]>>
type _Y2_ = Assert<Equal<
    OptionalTailArray<2, number, true>,
    readonly [true, true, ...readonly true[]]>
>
type _YXMax = OptionalTailArray<0, 999, true>

// A union bound is every length it names, not the first one matched.
type _YU_Max = Assert<Equal<
    OptionalTailArray<1, 2 | 3, true>,
    readonly [true, true?] | readonly [true, true?, true?]>
>
type _YU_Min = Assert<Equal<
    OptionalTailArray<1 | 2, 3, true>,
    readonly [true, true?, true?] | readonly [true, true, true?]>
>

// A `Min` above `Max` describes no array at all.
type _Y32 = Assert<Equal<OptionalTailArray<3, 2, true>, never>>

// An unknown `Min` is no lower bound, and does not release the upper one.
type _Y_3 = Assert<Equal<
    OptionalTailArray<number, 3, true>,
    readonly [true?, true?, true?]>
>
type _Y__ = Assert<Equal<OptionalTailArray<number, number, true>, readonly true[]>>

export type Includes<I, T extends readonly I[]> = (v: I) => v is T[number]
