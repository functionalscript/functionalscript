/**
 * TypeScript type transformers for RTTI schemas.
 *
 * Each `*Ts` type maps a schema (or schema fragment) to its corresponding TypeScript type.
 * The main entry point is `Ts<T>`.
 *
 * The runtime `toTs` function (`printer` in `./module.f.mjs`) mirrors `Ts<T>` at value
 * level, returning a TypeScript type expression string for a given RTTI schema.
 *
 * @module
 */

import type { And, Equal } from '../../ts/types.ts'
import type { Tag0, Tag1, Const, Or, String as RttiString, Struct, Tuple, Type, ConstObject } from '../types.ts'
import type { Assert } from '../../../asserts/types.ts'
import type { phantomKey } from '../../phantom/types.ts'
import type { StringMap } from '../../object/types.ts'

/**
 * The set of primitive literal types representable as rtti `Const` values.
 * Defined here rather than imported from `djs` to keep rtti free of djs dependencies
 * (djs depends on rtti, not the other way around — see [i665-rtti-defines-types]).
 */
export type Primitive = null | boolean | number | string | undefined | bigint

type _Assert0 = Assert<Equal<Const, ConstObject | Primitive>>

/**
 * The TypeScript type that rtti's `unknown` schema validates — any value that
 * an rtti schema can represent: a primitive, an array, or an object.
 *
 * This is the single source of truth for the rtti value domain: every rtti
 * module (`common`, `validate`, `parse`, …) imports `Unknown`/`Primitive`
 * from here, not from `djs`, keeping `rtti` free of a `djs` dependency (djs
 * depends on rtti, not the other way around).
 *
 * The relationship to djs is a subset one — `djs.Unknown ⊆ rtti.Unknown` — not
 * equality: the two happen to coincide today, but `rtti.Unknown` may widen to
 * admit values djs cannot represent (e.g. functions) without djs following.
 * Do not re-point rtti imports at `djs.Unknown` on the assumption they match.
 */
export type Unknown = Primitive | Array | Object

/** A read-only array of {@link Unknown} values. */
export type Array = readonly Unknown[]

/** A read-only record of {@link Unknown} values. */
export type Object = { readonly[k in string]?: Unknown }

/** Maps a `Tag0` to its TypeScript type. */
export type Info0Ts<T extends Tag0> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'unknown' ? Unknown :
    never

/** Maps a `Const` schema to its TypeScript type. */
export type ConstTs<T> =
    T extends readonly Type[] ? TupleTs<T> :
    T extends StringMap<Type> ? StructTs<T> :
    T

/** Maps a `Tag1` and inner type to its TypeScript type. */
export type Info1Ts<K extends Tag1, T extends Type> =
    K extends 'array' ? ArrayTs<T> :
    K extends 'record' ? RecordTs<T> :
    never

/** Maps an array schema `T` to `readonly Ts<T>[]`. */
export type ArrayTs<T extends Type> = ReadonlyArray<Ts<T>>

/** Maps a record schema `T` to `{ readonly[K in string]?: Ts<T> }`. */
export type RecordTs<T extends Type> = { readonly[K in string]?: Ts<T> }

/**
 * Maps a tuple schema to a readonly tuple of resolved types.
 *
 * **The commented-out line is the accurate mapping.** A tuple schema is *open*
 * — a longer array is a member of the set it describes (see "Structs and
 * tuples are open" in `../README.md`) — and the open form below says so. It is
 * commented out because TypeScript could not render it generically over an
 * arbitrary schema `T`, so this renders the closed approximation instead.
 *
 * `Struct`'s open-ness costs nothing to render: object types are structurally
 * open in TypeScript by default (a wider object is assignable to a narrower
 * one), which is exactly what `StructTs` already produces. `Tuple`'s open-ness
 * has no default counterpart — TypeScript tuples are exact-length — so
 * expressing "these positions, plus anything after" needs a rest element:
 * `readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]`.
 * That concrete shape is fine on its own; it breaks specifically because `T`
 * is generic here. TypeScript raises two errors trying it: TS2574 ("a rest
 * element type must be an array type"), because it cannot prove a mapped type
 * over a generic `keyof T` is array-shaped, and separately TS2589
 * (excessively deep instantiation) — confirmed by temporarily restoring the
 * line and running `tsc`.
 *
 * That is a limitation of this renderer, **not** a statement about the value
 * model. The runtime printer (`./module.f.mjs`), which prints one concrete
 * pattern rather than a mapping over a generic `T`, emits the rest element
 * and so renders the open set exactly. Do not cite the exact mapping here as
 * evidence that tuples are closed and add a length check to
 * `../parse/module.f.mjs`; that inference is what produced #1622. A schema that wants exact members says so explicitly — see
 * the planned `close` form in `../todo/close-type.md`, which also covers
 * `Ts<T>`'s gap here (`['close', S]` renders fine; `['close', S, R]` may not).
 */
export type TupleTs<T extends Tuple> =
    // readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]
    { readonly[K in keyof T]: Ts<T[K]> }

type OptionalFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? K : never]?: Ts<T[K]>
}
type RequiredFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? never : K]: Ts<T[K]>
}

/** Maps a struct schema to a readonly object of resolved types, with optional fields for schemas that include `undefined`. */
export type StructTs<T extends Struct> =
    (keyof OptionalFields<T> extends never ? unknown : OptionalFields<T>) &
    (keyof RequiredFields<T> extends never ? unknown : RequiredFields<T>)

/**
 * Converts a schema `Type` to its corresponding TypeScript type.
 *
 * - `Thunk` → evaluates the returned `Info` via `InfoTs`
 * - `Const` → resolves via `ConstTs` (primitives map to themselves; structs/tuples recurse)
 *
 * **Recursive schemas and TS2589:** when a schema is self-referential, `StructTs` would
 * expand infinitely and TypeScript raises TS2589. Break the cycle by annotating the
 * schema value with `Phantom<typeof myThunk, MyType>` from `fjs/types/phantom/types.ts`.
 * `Ts<>` detects the phantom key and returns `MyType` directly without recursing:
 *
 * ```ts
 * import { type Phantom } from '../../phantom/types.ts'
 *
 * type MyType = { readonly self?: MyType }
 * const myThunk = () => ['const', myConst] as const
 * export const my: Phantom<typeof myThunk, MyType> = myThunk
 * // Ts<typeof my>  →  MyType
 * ```
 *
 * `MyType` here is an unchecked annotation — nothing derives it, so a typo
 * (the wrong type, or one that has drifted from `myConst`) is trusted
 * silently. Pin it down with two asserts, one against the un-annotated
 * `myThunk` (forces the real structural walk) and one against the
 * phantom-wrapped `my` (catches the two drifting apart):
 *
 * ```ts
 * type _Check0 = Assert<Check<MyType, typeof myThunk>>
 * type _Check1 = Assert<Check<MyType, typeof my>>
 * ```
 *
 * {@link Check3} is the same pair written once:
 *
 * ```ts
 * type _Check = Assert<Check3<MyType, typeof myThunk, typeof my>>
 * ```
 *
 * See `fjs/edag/module.f.mjs` (`_exp`/`exp`) for this in practice. Note also
 * that the phantom branch below does `Exclude<O, undefined>`, so a `MyType`
 * that includes bare `undefined` at its top level will never satisfy
 * `_Check1`. That is a constraint on the wrapped type, not on how wide it
 * is: a union is fine when no member contributes a top-level `undefined` —
 * `fjs/edag` wraps `Exp`, the whole node union, because its `undefined` is
 * the tagged `['undefined']` rather than the bare value. Wrap one type per
 * recursive cycle, and if the natural one does carry a top-level
 * `undefined`, wrap a narrower node type inside the cycle instead.
 *
 * @example
 * ```ts
 * type A = Ts<typeof string>          // string
 * type B = Ts<4>                      // 4
 * type C = Ts<Array<typeof number>>   // readonly number[]
 * type D = Ts<{ x: typeof boolean }>  // { readonly x: boolean }
 * ```
 */
export type Ts<T extends Type> =
    // Fast-path: when T is `any` (unknown extends any), short-circuit to Unknown
    // to prevent distributive conditional types from expanding across all branches
    // and hitting TS2589 (type instantiation excessively deep).
    unknown extends T ? Unknown :
    // Phantom output: if the schema carries a phantomKey annotation (via WithOut), return
    // it directly — one indexed-access, no structural walk, no TS2589 for recursive schemas.
    T extends { readonly [phantomKey]?: infer O } ? Exclude<O, undefined> :
    T extends () => infer I ? (
        I extends readonly['const', infer C] ? ConstTs<C> :
        // Info0
        I extends readonly['boolean'] ? boolean :
        I extends readonly['number'] ? number :
        I extends readonly['string'] ? string :
        I extends readonly['bigint'] ? bigint :
        I extends readonly['unknown'] ? Unknown :
        // Info1
        I extends readonly['array', infer E extends Type] ? readonly Ts<E>[] :
        I extends readonly['record', infer E extends Type] ? { readonly[k in string]?: Ts<E> } :
        // Or
        I extends readonly['or', ...infer A extends readonly Type[]] ? Ts<A[number]> :
        //
        never
    ) :
    ConstTs<T>

/**
 * Pins a hand-written TypeScript type `A` against the type an rtti schema `B`
 * actually derives to — `Assert<Check<A, B>>` reads as "`A` is `Ts<B>`".
 * This is the assertion the {@link Ts} doc above uses for the two-Phantom-check
 * pattern, and the one every hand-written recursive type in this codebase (a
 * `Tree`, a `LockMap`, …) pins against its rtti schema with.
 */
export type Check<A, B extends Type> = Equal<A, Ts<B>>

/**
 * The two-assert `Phantom` pattern from the {@link Ts} doc, in one
 * assert: `T` is both `Ts<R0>` (the raw thunk, forcing the structural walk)
 * and `Ts<R1>` (the phantom-wrapped export). Checking only the wrapped
 * export is a tautology — `Ts<>` short-circuits to the annotation — so the
 * `R0` half is what gives this teeth.
 */
export type Check3<T, R0 extends Type, R1 extends Type> = And<Equal<T, Ts<R0>>, Equal<T, Ts<R1>>>

// Fast-path: Ts<any> resolves to Unknown without TS2589 overflow.
type _any = Assert<Check<Unknown, any>>

type _null = Assert<Check<null, null>>
type _undefined = Assert<Check<undefined, undefined>>

type _true = Assert<Check<true, true>>
type _32 = Assert<Check<32, 32>>
type _42n = Assert<Check<42n, 42n>>
type _hello = Assert<Check<'hello', 'hello'>>

type _tuple = Assert<Check<readonly[12, true], readonly[12, true]>>
type _struct = Assert<Check<
    { readonly a: 'hello', readonly b: readonly[]},
    { readonly a: 'hello', readonly b: readonly[]}
>>
type _structOption = Assert<Check<
    { readonly a: string } & { readonly b?: string | undefined },
    { readonly a: RttiString, readonly b: Or<readonly[RttiString, undefined]> }
>>

type _const = Assert<Check<12, () => readonly['const', 12]>>

type _boolean = Assert<Check<boolean, () => readonly['boolean']>>
type _number = Assert<Check<number, () => readonly['number']>>
type _string = Assert<Check<string, () => readonly['string']>>
type _bigint = Assert<Check<bigint, () => readonly['bigint']>>

type _unknown = Assert<Equal<Ts<() => readonly['unknown']>, Unknown>>

type _array = Assert<Check<
    readonly 12[],
    () => readonly['array', 12]>>

type _record = Assert<Check<
    StringMap<boolean>,
    () => readonly['record', () => readonly['boolean']]>>

type _tupleString = Assert<Check<
    readonly[string],
    readonly[() => readonly['string']]>>

type _orConst = Assert<Check<
    false | 42 | 'hello',
    () => readonly['or', false, 42, 'hello']>>

type _orStringNumber = Assert<Check<
    13 | string,
    () => readonly['or', 13, () => readonly['string']]>>

type _SelfArray = readonly _SelfArray[]
type _SelfArrayType = () => readonly['array', _SelfArrayType]

type _selfArray = Assert<Check<_SelfArray, _SelfArrayType>>
