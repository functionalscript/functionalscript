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

import type { And, Equal } from '../../types/ts/types.ts'
import type { Tag0, Tag1, Const, Or, Boolean as RttiBoolean, Bigint as RttiBigint, Number as RttiNumber, String as RttiString, Unknown as RttiUnknown, Struct, Tuple, Type, ConstObject } from '../types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { phantomKey } from '../../types/phantom/types.ts'
import type { StringMap } from '../../types/object/types.ts'

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
 * Maps a tuple schema to a readonly tuple of resolved types, with the
 * **trailing** positions whose sets admit `undefined` rendered optional:
 * `[number, bigint, option(boolean), option(string)]` becomes
 * `readonly[number, bigint, (boolean|undefined)?, (string|undefined)?]`.
 *
 * That is the same rule {@link StructTs} applies per key — a member is
 * required exactly when its set excludes `undefined` — so an array may stop
 * at the last required position, which is what `../parse/module.f.mjs` and
 * `../validate/module.f.mjs` accept. Only the trailing run: TypeScript
 * forbids a required element after an optional one, so a position that admits
 * `undefined` with a required one after it stays required with `undefined` in
 * its type (see {@link _tupleInteriorOption}).
 *
 * **Deriving this generically took three specific moves**, each defeating an
 * error that sank the obvious spellings — do not simplify it back:
 *
 * - `MappedTs` resolves `Ts<>` **once per position**, and the split then walks
 *   the mapped tuple rather than the schema. Testing `undefined extends
 *   Ts<Last>` during the walk evaluates `Ts<>` twice per position and raises
 *   TS2589 (excessively deep).
 * - `Extract<…, readonly unknown[]>` is what makes a mapped type spreadable.
 *   Spreading it directly raises TS2574 ("a rest element type must be an array
 *   type") — TypeScript cannot prove a mapped type over a generic `keyof T` is
 *   array-shaped. An `& readonly unknown[]` intersection silences that too,
 *   but leaves the intersection in the rendered type, so `Equal<>` against a
 *   hand-written tuple fails; `Extract` resolves clean.
 * - `extends infer M extends …` forces each intermediate to resolve before it
 *   is used in rest position. Without it the concrete instantiation works and
 *   the generic one does not.
 *
 * A recursive form that prepends onto an all-optional tail (rather than
 * splitting) crashes the compiler outright — a Go stack overflow in tsgo
 * 7.0.2, not a diagnostic.
 *
 * **The exact length is the model, not an approximation of it.** A bare tuple
 * schema is *closed* — the positions it declares and no others (see "Structs
 * and tuples are closed" in `../README.md`) — which is what a TypeScript tuple
 * already means, so this rendering and the schema denote the same set and
 * `validate`'s success cast is sound. A schema admitting more says so, and
 * {@link RestTs} renders the tail it says it with.
 */
type MappedTs<T extends Tuple> = Extract<{ readonly[K in keyof T]: Ts<T[K]> }, readonly unknown[]>

type RequiredPart<M extends readonly unknown[]> =
    M extends readonly [...infer I extends readonly unknown[], infer L]
        ? undefined extends L ? RequiredPart<I> : M
        // `M`, not `readonly []`. The peel needs a *required* last element, so
        // a tuple whose last element is already optional does not match it —
        // and neither does the empty tuple, where the two coincide. Both keep
        // the mapping: an optional position is what this transform produces,
        // so one the caller wrote is already in the target form.
        //
        // Keeping the whole mapping does mean a position *before* the caller's
        // optional one is not optionalized even where TypeScript could spell
        // it: `[N, option(B), (S)?]` renders `readonly [number, boolean |
        // undefined, string?]`, not `(boolean | undefined)?`. That is what the
        // homomorphic mapping has always rendered for such a schema, so this
        // preserves the behaviour rather than introducing it.
        : M

type OmittablePart<M extends readonly unknown[], Acc extends readonly unknown[] = readonly []> =
    M extends readonly [...infer I extends readonly unknown[], infer L]
        ? undefined extends L ? OmittablePart<I, readonly [L, ...Acc]> : Acc
        : Acc

type AsOptional<O extends readonly unknown[]> =
    Extract<{ readonly[K in keyof O]+?: O[K] }, readonly unknown[]>

export type TupleTs<T extends Tuple> =
    // readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]
    MappedTs<T> extends infer M extends readonly unknown[] ? SplitTs<M> : never

/**
 * Splits one mapped tuple. `M` is naked in the first conditional on purpose:
 * that distributes over a union of tuples, so each member is split and rebuilt
 * whole. Splitting the union instead lets `RequiredPart` and `OmittablePart`
 * distribute separately, and the spread then recombines every prefix with
 * every suffix — a union of `[number, option(string)]` and
 * `[string, option(boolean), option(number)]` would admit `[number, boolean]`.
 *
 * Splitting a trailing run off also needs a *fixed* length. A schema array of
 * non-fixed length (what `.map()` produces) and a variadic tuple
 * (`[...(typeof number)[], option(string)]`) both have `length: number` and no
 * last position to peel, so they keep the mapping as it is — splitting them
 * would drop the element type and the prefix's shape respectively, and widen
 * what `Ts<T>` admits.
 */
type SplitTs<M extends readonly unknown[]> =
    M extends readonly unknown[]
        ? number extends M['length']
            ? M
            : RequiredPart<M> extends infer R extends readonly unknown[]
                ? OmittablePart<M> extends infer O extends readonly unknown[]
                    ? readonly [...R, ...AsOptional<O>]
                    : never
                : never
        : never

type OptionalFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? K : never]?: Ts<T[K]>
}
type RequiredFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? never : K]: Ts<T[K]>
}

/**
 * Maps a container with a stated rest to the resolved type of its declared
 * members, **plus the tail the rest states**.
 *
 * The struct kind needs no tail: an object type is width-open in TypeScript,
 * so `ConstTs<C>` already admits the undeclared keys — as wide as TypeScript
 * can render either way.
 *
 * The tuple kind does, and a rename of the old exact-only rendering would have
 * relocated the unsound cast rather than removing it: `Ts<typeof open([42])>`
 * would be the exact `readonly[42]` while `validate(open([42]))([42, 'x'])`
 * accepts and hands back two elements.
 *
 * **The tail admits `undefined`.** Both readers check an undeclared member as
 * a member, and a hole past the prefix is no member, so
 * `validate(rest([42], string))([42, , ])` is `ok` and index 1 reads
 * `undefined`. `...(Ts<R> | undefined)[]` is what "a rest never sees an absent
 * member" says on the type side. The common case pays nothing: `open(c)`'s
 * rest is `unknown`, which already admits `undefined`.
 *
 * **An empty rest renders no tail**, since `rest(c, or())` is the bare `c` —
 * one set, so one rendering, and `readonly[42, ...undefined[]]` would admit
 * the `[42, undefined]` both readers reject. What counts as empty is
 * `emptyRest`'s question in `../data/module.f.mjs`, and that is a `toData`
 * conversion plus `subset` both ways, which `types.ts` cannot invoke. Nor is
 * `Ts<R> extends never` a substitute — `Ts<readonly[Or<readonly[]>]>` is
 * `readonly[never]`, whose `length` is `1`. So this recognizes the one
 * directly spellable empty rest, `or()`, and **keeps the tail whenever it
 * cannot tell**. The conservatism has a direction: a kept tail is wider than
 * the schema but sound — every accepted value still has the rendered type,
 * which is the only direction a success cast needs — while a wrongly dropped
 * one is the unsound cast. Where that leaves this and the runtime printer
 * disagreeing (`rest([42], readonly[Or<readonly[]>])`, which the data form
 * recognizes as empty and this does not) the printer is the narrower of the
 * two; see {@link _restEmptyIndirect}.
 *
 * The other place the two differ is a rest with **no prefix**, which is the
 * uniform array: `rest([], string)` and `array(string)` are one set, so the
 * printer — which goes through the data form and sees one node — prints
 * `ArrayTs`'s `readonly(string)[]` for both, while this renders the tail and
 * so answers `readonly(string|undefined)[]` for the first. The tail is the
 * sound one of the two, a hole being no member on either spelling; `ArrayTs`
 * carries that gap already and closing it is its own change, not this one's.
 * See {@link _restNoPrefix}.
 */
export type RestTs<C extends ConstObject, R extends Type> =
    C extends Tuple ? TupleRestTs<C, R> : ConstTs<C>

/**
 * `[R] extends [...]` rather than a naked `R`: a naked one distributes, and a
 * union rest would then render a union of tuples rather than a tuple whose
 * tail is a union.
 */
type TupleRestTs<C extends Tuple, R extends Type> =
    [R] extends [Or<readonly []>]
        ? TupleTs<C>
        : TupleTs<C> extends infer M extends readonly unknown[]
            ? readonly [...M, ...ReadonlyArray<Ts<R> | undefined>]
            : never

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
 * import { type Phantom } from '../../types/phantom/types.ts'
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
        // Rest
        I extends readonly['rest', infer C extends ConstObject, infer R extends Type] ? RestTs<C, R> :
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

/**
 * The tuple counterpart of {@link _structOption}: a trailing position whose
 * set admits `undefined` renders **optional**, so an array may stop at the
 * last required one — the same rule, on the other kind.
 */
type _tupleOption = Assert<Check<
    readonly[number, bigint, (boolean | undefined)?, (string | undefined)?],
    readonly[RttiNumber, RttiBigint, Or<readonly[RttiBoolean, undefined]>, Or<readonly[RttiString, undefined]>]
>>

/**
 * Only the *trailing* run. TypeScript forbids a required element after an
 * optional one, so a position that admits `undefined` with a required one
 * after it keeps `undefined` in its type and stays required. The runtime rule
 * is unchanged — such a position may still be absent, since reading it yields
 * `undefined` either way — this is what TypeScript can spell, not a narrower
 * set.
 */
type _tupleInteriorOption = Assert<Check<
    readonly[string | undefined, number],
    readonly[Or<readonly[RttiString, undefined]>, RttiNumber]
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

/** A bare `Const` is closed, and renders exactly. */
type _bareTuple = Assert<Check<readonly[12, true], readonly[12, true]>>

type _bareStruct = Assert<Check<{ readonly a: string }, { readonly a: RttiString }>>

/** An empty rest is the bare form, and renders as it does. */
type _restEmpty = Assert<Check<
    readonly[12],
    () => readonly['rest', readonly[12], Or<readonly[]>]>>

/**
 * The tail a stated rest renders, with the `undefined` a hole past the prefix
 * reads as.
 */
type _restTail = Assert<Check<
    readonly[12, ...readonly (string | undefined)[]],
    () => readonly['rest', readonly[12], RttiString]>>

/** `open(c)`: `Unknown` already admits `undefined`, so the tail is unchanged. */
type _restOpen = Assert<Check<
    readonly[12, ...readonly Unknown[]],
    () => readonly['rest', readonly[12], RttiUnknown]>>

/** The tail composes with the trailing-optional split. */
type _restOptionTail = Assert<Check<
    readonly[number, (string | undefined)?, ...readonly (boolean | undefined)[]],
    () => readonly['rest', readonly[RttiNumber, Or<readonly[RttiString, undefined]>], RttiBoolean]>>

/**
 * A rest with no prefix is the uniform array, and renders the tail rather than
 * `ArrayTs` — the sound half of the divergence {@link RestTs} documents.
 */
type _restNoPrefix = Assert<Check<
    readonly (string | undefined)[],
    () => readonly['rest', readonly[], RttiString]>>

/** A struct's rest needs no rendering — an object type is width-open already. */
type _restStruct = Assert<Check<
    { readonly a: string },
    () => readonly['rest', { readonly a: RttiString }, RttiNumber]>>

/**
 * The conservative half of the empty-rest rule, and the one row that separates
 * this renderer from the runtime one: `readonly[or()]` is an empty rest — the
 * data form converts the whole pattern to the exact `readonly[12]` and the
 * printer drops the tail — while a syntactic test cannot see it, so the tail
 * stays. Wider than the schema, and sound: the schema admits no such value.
 */
type _restEmptyIndirect = Assert<Check<
    readonly[12, ...readonly (readonly[never] | undefined)[]],
    () => readonly['rest', readonly[12], readonly[Or<readonly[]>]]>>
