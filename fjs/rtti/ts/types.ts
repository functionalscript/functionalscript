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
import type { Tag0, Tag1, Const, Or, Boolean as RttiBoolean, Bigint as RttiBigint, Number as RttiNumber, String as RttiString, Unknown as RttiUnknown, Option as RttiOption, Struct, Tuple, Type, ConstObject } from '../types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Phantom, phantomKey } from '../../types/phantom/types.ts'
import type { StringMap } from '../../types/object/types.ts'

declare const absentKey: unique symbol

/**
 * The type-level marker for rtti's `option` — **absence**, the member that
 * is not there. A branded, uninhabitable object type rather than `never`
 * (which vanishes in a union, taking the information with it) or
 * `undefined` (which would make `or(undefined, number)` optional too and
 * conflate the very pair `option` exists to separate).
 *
 * It appears only in {@link _TsRaw} results; the public {@link Ts} strips
 * it, and every container position lowers it for itself — a struct key or
 * trailing tuple position renders optional, an interior tuple position
 * renders `undefined` (what reading a hole gives), an array or record
 * element excludes it. One caveat is inherent: the top absorbs it —
 * `Absent` is assignable to `unknown`, and `Absent | unknown` *is*
 * `unknown` — so neither a subtype query over a rendered type nor a union
 * member can carry absence past a top-rendering present part. Whether a
 * member may be absent is therefore asked of the *schema*, by
 * {@link _AdmitsAbsence}, never of the rendered union — and a `Phantom`
 * annotation carries it in {@link AbsentOr}'s wrapper, never as a union
 * member.
 */
export type Absent = { readonly [absentKey]: typeof absentKey }

/**
 * A `Phantom` annotation's spelling for a schema whose **root admits
 * absence**: `AbsentOr<MyType>` wraps the present part instead of unioning
 * {@link Absent} into it, because a union member drowns in a top-rendering
 * present part — `Absent | unknown` is `unknown`, and `or(option, {})`
 * renders its present part as `unknown` (see {@link StructTs}) — while the
 * branded wrapper survives any present type. This is the same shape the
 * runtime keeps: the data form's absent bit rides *beside* the union, never
 * in it. {@link _AdmitsAbsence}, {@link _IsAbsentOnly}, {@link Ts} and
 * {@link _TsRaw} all read the wrapper first; {@link CheckRaw} pins its
 * presence against the schema. An absent-only root — `option` itself —
 * annotates as `AbsentOr<never>`.
 */
export type AbsentOr<T> = { readonly [absentKey]: T }

/**
 * Whether the schema type admits **absence** — the type-level counterpart of
 * `admitsAbsence` in `../common/module.f.mjs`, and the predicate
 * {@link StructTs} and {@link TupleTs} decide optionality with. Structural
 * over the schema: it recurses through `or` — which does no flattening, so
 * `or(or(option, number), string)` needs the recursion — and reads a
 * `Phantom` annotation for its {@link AbsentOr} wrapper. It is *not* a
 * subtype query against the rendered type: neither `Absent extends Ts<…>`
 * (false for every member — `Ts` strips the marker) nor
 * `Absent extends _TsRaw<…>` (true at `unknown`, whose top absorbs the
 * marker) can answer it — `{ a: unknown }`, which rejects `{}`, would render
 * indistinguishably from `{ a: or(option, unknown) }`, which accepts it.
 * Nor is it a union-membership query over the annotation:
 * `Extract<O, Absent>` read absence out of `Absent | number`, but
 * `Absent | unknown` has already collapsed to `unknown` — the marker
 * drowned with nothing to extract, and the member rendered required. The
 * wrapper is what survives a top-rendering present part.
 */
export type _AdmitsAbsence<T> =
    unknown extends T ? false :
    true extends _AdmitsAbsence1<T> ? true : false

type _AdmitsAbsence1<T> =
    T extends { readonly [phantomKey]?: infer O } ? (readonly [O] extends readonly [{ readonly [absentKey]: unknown }] ? true : false) :
    T extends () => infer I
        ? I extends readonly['option'] ? true
        : I extends readonly['or', ...infer A extends readonly Type[]] ? _AdmitsAbsence1<A[number]>
        : false
    : false

/**
 * Whether the schema type denotes the empty *value* set — nothing but
 * absence: `option`, unions of nothing but it, and the empty union. The one
 * consumer is {@link ArrayTs}'s empty-array case; structural for the same
 * reason {@link _AdmitsAbsence} is, and additionally because testing
 * `[Ts<T>] extends [never]` would force the element type of a recursive
 * array schema eagerly and never terminate.
 *
 * A `Phantom` annotation is read **before** the thunk walk, exactly as
 * {@link _AdmitsAbsence} and `Ts` read it: a phantom-wrapped schema is still
 * a thunk, so descending its `or` chain would re-expand the very recursion
 * the annotation exists to spare (TS2589). An absence-admitting root
 * annotates as {@link AbsentOr}`<Present>`, so "absent-only" is a wrapper
 * whose present part is `never` — `AbsentOr<never>` — and an unwrapped
 * annotation admits no absence at all. (`undefined` is stripped as the
 * optional-field artifact the `Phantom` contract already excludes from
 * annotations, not as a value member.)
 */
type _IsAbsentOnly<T> =
    unknown extends T ? false :
    false extends _IsAbsentOnly1<T> ? false : true

type _IsAbsentOnly1<T> =
    T extends { readonly [phantomKey]?: infer O }
        ? (readonly [O] extends readonly [{ readonly [absentKey]: infer P }] ? (readonly [Exclude<P, undefined>] extends readonly [never] ? true : false) : false) :
    T extends () => infer I
        ? I extends readonly['option'] ? true
        : I extends readonly['or', ...infer A extends readonly Type[]] ? _IsAbsentOnly1<A[number]>
        : false
    : false

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

/** Maps a `Tag0` to its TypeScript type — `option` to the raw {@link Absent} marker. */
export type Info0Ts<T extends Tag0> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'unknown' ? Unknown :
    T extends 'option' ? Absent :
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

/**
 * Maps an array schema `T` to `readonly Ts<T>[]` — the element excludes
 * {@link Absent}, the type-level counterpart of "a rest never sees it" —
 * except that an element set with no *present* value at all is the empty
 * array, `readonly []`. `readonly never[]` is not that set:
 * `new Array<never>(1)` is assignable to it and its `length` is `number`,
 * while `array(option)` (and `array(or())`) accept only `[]` at runtime.
 * The emptiness test is structural ({@link _IsAbsentOnly}) so a recursive
 * element schema stays lazy.
 */
export type ArrayTs<T extends Type> =
    _IsAbsentOnly<T> extends true ? readonly [] : ReadonlyArray<Ts<T>>

/**
 * Maps a record schema `T` to `{ readonly[K in string]?: Ts<T> }`. The value
 * excludes {@link Absent} through `Ts`; no empty-set counterpart of
 * {@link ArrayTs}'s is needed — `Record<string, never>` already admits `{}`
 * and nothing else, an object type carrying no length to disagree about.
 */
export type RecordTs<T extends Type> = { readonly[K in string]?: Ts<T> }

/**
 * Maps a tuple schema to a readonly tuple of resolved types, with the
 * **trailing** positions whose sets admit absence rendered optional:
 * `[number, bigint, or(option, boolean), or(option, string)]` becomes
 * `readonly[number, bigint, boolean?, string?]`.
 *
 * That is the same rule {@link StructTs} applies per key — a member is
 * required exactly when its set excludes **absence**, decided by
 * {@link _AdmitsAbsence} over the schema — so an array may stop at the last
 * required position, which is what `../parse/module.f.mjs` and
 * `../validate/module.f.mjs` accept. Under `exactOptionalPropertyTypes`
 * (which this repository sets) the optional rendering is *exact*:
 * `readonly [1, number?]` rejects `[1, undefined]`, exactly as the readers
 * reject a present `undefined` under `or(option, number)`. Only the trailing
 * run renders optional: TypeScript forbids a required element after an
 * optional one, so an *interior* position that admits absence renders
 * `T | undefined` instead — `undefined` being what reading a hole gives —
 * see {@link _tupleInteriorOption}.
 *
 * **Deriving this generically took three specific moves**, each defeating an
 * error that sank the obvious spellings — do not simplify it back:
 *
 * - `MappedTs` resolves `Ts<>` **once per position**, and the split then
 *   walks the schema with the structural {@link _AdmitsAbsence} while
 *   carrying the mapped tuple beside it. Evaluating `Ts<>` again during the
 *   walk raises TS2589 (excessively deep).
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

type AsOptional<O extends readonly unknown[]> =
    Extract<{ readonly[K in keyof O]+?: O[K] }, readonly unknown[]>

/**
 * `T` is naked in the first conditional on purpose: that distributes over a
 * union of tuple schemas, so each member is mapped and split whole, with its
 * own prefix beside its own suffix. Splitting the mapped union instead lets
 * the two halves distribute separately, and the spread then recombines every
 * prefix with every suffix — a union of `[number, or(option, string)]` and
 * `[string, or(option, boolean), or(option, number)]` would admit
 * `[number, boolean]`.
 *
 * Splitting a trailing run off also needs a *fixed* length. A schema array
 * of non-fixed length (what `.map()` produces) and a variadic tuple
 * (`[...(typeof number)[], or(option, string)]`) both have `length: number`
 * and no last position to peel, so they keep the mapping as it is —
 * splitting them would drop the element type and the prefix's shape
 * respectively, and widen what `Ts<T>` admits.
 */
export type TupleTs<T extends Tuple> =
    T extends Tuple
        ? MappedTs<T> extends infer M extends readonly unknown[]
            ? number extends M['length'] ? M : _SplitTs<T, M>
            : never
        : never

/**
 * Peels the trailing absence-admitting run off the schema `T` and the mapped
 * tuple `M` in parallel — the schema answers *whether* a position may be
 * absent, the mapping supplies its rendered type — then rebuilds: the
 * required part with interior absence lowered to `| undefined`
 * ({@link _InteriorTs}), the peeled run optional. The peel needs a
 * *required* last schema element, so a tuple whose last element is already
 * optional does not match it — and neither does the empty tuple, where the
 * two coincide. Both keep the mapping: an optional position is what this
 * transform produces, so one the caller wrote is already in the target form.
 */
type _SplitTs<T extends readonly Type[], M extends readonly unknown[], O extends readonly unknown[] = readonly []> =
    T extends readonly [...infer TI extends readonly Type[], infer TL extends Type]
        ? _AdmitsAbsence<TL> extends true
            ? M extends readonly [...infer MI extends readonly unknown[], infer ML]
                ? _SplitTs<TI, MI, readonly [ML, ...O]>
                : readonly [..._InteriorTs<T, M>, ...AsOptional<O>]
            : readonly [..._InteriorTs<T, M>, ...AsOptional<O>]
        : readonly [..._InteriorTs<T, M>, ...AsOptional<O>]

/**
 * The required part with each **interior** absence-admitting position
 * lowered per position: {@link Absent} was already excluded by the mapping's
 * `Ts`, and `undefined` — what reading a hole gives, and the only spelling
 * TypeScript allows before a required element — is put in its place. A
 * position whose schema excludes absence is carried as mapped.
 */
type _InteriorTs<T extends readonly Type[], M extends readonly unknown[]> =
    Extract<{
        readonly[K in keyof M]:
            K extends keyof T ? (_AdmitsAbsence<T[K]> extends true ? M[K] | undefined : M[K]) : M[K]
    }, readonly unknown[]>

type OptionalFields<T extends Struct> = {
    readonly[K in keyof T as _AdmitsAbsence<T[K]> extends true ? K : never]?: Ts<T[K]>
}
type RequiredFields<T extends Struct> = {
    readonly[K in keyof T as _AdmitsAbsence<T[K]> extends true ? never : K]: Ts<T[K]>
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
    readonly [R] extends readonly [Or<readonly []>]
        ? TupleTs<C>
        : TupleTs<C> extends infer M extends readonly unknown[]
            ? readonly [...M, ...ReadonlyArray<Ts<R> | undefined>]
            : never

/**
 * Maps a struct schema to a readonly object of resolved types, with a key
 * rendered optional exactly when its schema admits **absence**
 * ({@link _AdmitsAbsence}) — `or(option, t)` is `readonly k?: Ts<t>`, while
 * `or(t, undefined)` stays required with `undefined` in its type. Under
 * `exactOptionalPropertyTypes` the two are distinct in TypeScript, so the
 * rendering is exact where the old `undefined`-keyed one conflated them.
 */
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
 * **A schema whose root admits absence needs one more assert.** When the
 * wrapped schema's root is `or(option, …)` the annotation must carry the
 * flag in {@link AbsentOr}'s wrapper —
 * `Phantom<typeof myThunk, AbsentOr<MyType>>` — or the member it is used at
 * renders required. The wrapper, not a union: `Absent | MyType` drowns when
 * `MyType` renders as the top (`Absent | unknown` *is* `unknown`), and the
 * marker takes the optionality with it. The pair above cannot catch the
 * omission either way: both compare through the public `Ts`, which strips
 * absence from both sides. Pin the flag and the present part together with
 * {@link CheckRaw}:
 *
 * ```ts
 * type _CheckRaw = Assert<CheckRaw<AbsentOr<MyType>, typeof myThunk>>
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
    // it directly — one indexed-access, no structural walk, no TS2589 for recursive
    // schemas. An absence-admitting root annotates as `AbsentOr<Present>`, so the
    // wrapper is unwrapped here; either way the optional-field `undefined`
    // artifact is stripped.
    T extends { readonly [phantomKey]?: infer O }
        ? (readonly [O] extends readonly [{ readonly [absentKey]: infer P }] ? Exclude<P, undefined> : Exclude<O, undefined>) :
    T extends () => infer I ? (
        I extends readonly['const', infer C] ? ConstTs<C> :
        // Info0
        I extends readonly['boolean'] ? boolean :
        I extends readonly['number'] ? number :
        I extends readonly['string'] ? string :
        I extends readonly['bigint'] ? bigint :
        I extends readonly['unknown'] ? Unknown :
        // `option` contributes no *value*: at the entry position nothing can be
        // absent, so the public rendering is what the rest of the union accepts,
        // and `never` vanishes in it. The `Absent`-preserving shape is `_TsRaw`.
        I extends readonly['option'] ? never :
        // Info1
        I extends readonly['array', infer E extends Type] ? ArrayTs<E> :
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
 * The {@link Absent}-preserving counterpart of {@link Ts}, differing only at
 * the **root** of a schema — the one place absence has no container position
 * to lower it into: `_TsRaw<typeof or(option, number)>` is `Absent | number`
 * where the public `Ts` is `number`. It walks `or` chains and unwraps a
 * `Phantom` annotation's {@link AbsentOr} back into that union shape (minus
 * the optional-field `undefined` artifact), and delegates every other form
 * to `Ts` — container positions lower the marker for themselves, so below
 * the root the two agree. Note the union shape *collapses at the top*
 * (`Absent | unknown` is `unknown`), which is exactly why an annotation
 * spells absence as the wrapper and why {@link CheckRaw} pins the flag
 * separately rather than through this union.
 */
export type _TsRaw<T extends Type> =
    unknown extends T ? Unknown :
    T extends { readonly [phantomKey]?: infer O }
        ? (readonly [O] extends readonly [{ readonly [absentKey]: infer P }] ? Absent | Exclude<P, undefined> : Exclude<O, undefined>) :
    T extends () => infer I ? (
        I extends readonly['option'] ? Absent :
        I extends readonly['or', ...infer A extends readonly Type[]] ? _TsRaw<A[number]> :
        Ts<T>
    ) :
    Ts<T>

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

/**
 * The **raw** counterpart of {@link Check}: pins a `Phantom` annotation `A`
 * against the schema `B` in both halves — the **flag** ({@link AbsentOr}'s
 * wrapper is present on `A` exactly when `B`'s root admits absence,
 * structurally) and the **present part** (`A`'s, against `_TsRaw<B>` with
 * the marker stripped). This is the assert with teeth for a schema whose
 * root admits absence: {@link Check} and {@link Check3} compare through the
 * public {@link Ts}, which strips absence from *both* sides, so they pass
 * even when the annotation forgot the wrapper — and the wrapped member then
 * renders required. The flag half is deliberately not a comparison through
 * `_TsRaw`'s union, where `Absent | unknown` has already collapsed and a
 * missing marker passed: spell the annotation `AbsentOr<…>` and add
 * `Assert<CheckRaw<AbsentOr<…>, typeof rawThunk>>` beside the usual pair; a
 * schema whose root excludes absence needs nothing new — its annotation is
 * unwrapped, and this then agrees with {@link Check} on the raw thunk.
 */
export type CheckRaw<A, B extends Type> = And<
    Equal<readonly [A] extends readonly [{ readonly [absentKey]: unknown }] ? true : false, _AdmitsAbsence<B>>,
    Equal<
        readonly [A] extends readonly [{ readonly [absentKey]: infer P }] ? P : A,
        Exclude<_TsRaw<B>, Absent>
    >
>

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
/**
 * A key that may be **absent** — `or(option, string)` — renders optional
 * with the marker stripped, while `or(string, undefined)` is a *required*
 * key that may hold `undefined`: under `exactOptionalPropertyTypes` the two
 * renderings are distinct in TypeScript exactly as the two schemas are
 * distinct at runtime.
 */
type _structOption = Assert<Check<
    { readonly a: string } & { readonly b?: string },
    { readonly a: RttiString, readonly b: Or<readonly[RttiOption, RttiString]> }
>>
type _structPresentUndefined = Assert<Check<
    { readonly a: string, readonly b: string | undefined },
    { readonly a: RttiString, readonly b: Or<readonly[RttiString, undefined]> }
>>
type _structOptionAndUndefined = Assert<Check<
    { readonly a: string } & { readonly b?: string | undefined },
    { readonly a: RttiString, readonly b: Or<readonly[RttiOption, RttiString, undefined]> }
>>

/**
 * The pair no subtype query over the rendered type can tell apart — the top
 * absorbs {@link Absent} — and {@link _AdmitsAbsence} over the schema does:
 * a key declared `unknown` must be *present*, so the closed `{ a: unknown }`
 * rejects `{}`, while `or(option, unknown)` is the declared-member top.
 */
type _structUnknownRequired = Assert<Check<
    unknown & { readonly a: Unknown },
    { readonly a: RttiUnknown }
>>
type _structUnknownOptional = Assert<Check<
    { readonly a?: Unknown } & unknown,
    { readonly a: Or<readonly[RttiOption, RttiUnknown]> }
>>

/**
 * The tuple counterpart of {@link _structOption}: a trailing position whose
 * set admits absence renders **optional**, with the marker stripped, so an
 * array may stop at the last required one — the same rule, on the other
 * kind.
 */
type _tupleOption = Assert<Check<
    readonly[number, bigint, boolean?, string?],
    readonly[RttiNumber, RttiBigint, Or<readonly[RttiOption, RttiBoolean]>, Or<readonly[RttiOption, RttiString]>]
>>

/**
 * Only the *trailing* run. TypeScript forbids a required element after an
 * optional one, so a position that admits absence with a required one after
 * it renders `T | undefined` — `undefined` is what reading a hole gives, so
 * the type is honest, if wider than the set: this is what TypeScript can
 * spell, not a narrower rule at runtime.
 */
type _tupleInteriorOption = Assert<Check<
    readonly[string | undefined, number],
    readonly[Or<readonly[RttiOption, RttiString]>, RttiNumber]
>>

/**
 * A present-`undefined` interior position needs no lowering — `undefined` is
 * already a member of its set — and stays required.
 */
type _tupleInteriorUndefined = Assert<Check<
    readonly[string | undefined, number],
    readonly[Or<readonly[RttiString, undefined]>, RttiNumber]
>>

/**
 * The exactness claim of the two stages, pinned with values: a closed tuple
 * with a trailing `or(option, number)` renders `readonly [1, number?]`, and
 * under `exactOptionalPropertyTypes` that type and the schema agree on every
 * row — `[1]` and `[1, 2]` in, `[1, undefined]` and `[1, 2, 3]` out.
 */
type _tupleExact = Ts<readonly[1, Or<readonly[RttiOption, RttiNumber]>]>
type _tupleExactRendering = Assert<Equal<_tupleExact, readonly[1, number?]>>
type _tupleExactAdmitsShort = Assert<readonly[1] extends _tupleExact ? true : false>
type _tupleExactAdmitsFull = Assert<readonly[1, 2] extends _tupleExact ? true : false>
type _tupleExactRejectsPresentUndefined = Assert<readonly[1, undefined] extends _tupleExact ? false : true>
type _tupleExactRejectsLong = Assert<readonly[1, 2, 3] extends _tupleExact ? false : true>

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
    readonly[number, string?, ...readonly (boolean | undefined)[]],
    () => readonly['rest', readonly[RttiNumber, Or<readonly[RttiOption, RttiString]>], RttiBoolean]>>

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

/**
 * The top-level `option` and its degenerate unions. At the entry position no
 * value can be absent, so the public rendering is what the rest of the union
 * accepts — `option` alone is `never` — while {@link _TsRaw} keeps the
 * marker, which is what {@link CheckRaw} pins.
 */
type _optionAlone = Assert<Check<never, RttiOption>>
type _optionUnion = Assert<Check<number, Or<readonly[RttiOption, RttiNumber]>>>
type _optionUnionRaw = Assert<CheckRaw<AbsentOr<number>, Or<readonly[RttiOption, RttiNumber]>>>

/**
 * The type-level counterpart of "a rest never sees it": an array or record
 * element excludes the marker — and an element set with no present value at
 * all is the **empty array**, `readonly []`, not `readonly never[]`, whose
 * `length` is `number` and which `new Array<never>(1)` inhabits.
 */
type _arrayOption = Assert<Check<readonly number[], () => readonly['array', Or<readonly[RttiOption, RttiNumber]>]>>
type _arrayOptionOnly = Assert<Check<readonly[], () => readonly['array', RttiOption]>>
type _arrayNever = Assert<Check<readonly[], () => readonly['array', Or<readonly[]>]>>
type _recordOption = Assert<Check<
    { readonly[k in string]?: number },
    () => readonly['record', Or<readonly[RttiOption, RttiNumber]>]>>

/** `or` does no flattening, so absence is found through nested unions. */
type _nestedOptionKey = Assert<Check<
    { readonly a?: number | string } & unknown,
    { readonly a: Or<readonly[Or<readonly[RttiOption, RttiNumber]>, RttiString]> }
>>

/**
 * A `Phantom` annotation on a schema whose root admits absence carries the
 * flag in {@link AbsentOr}'s wrapper, which {@link _AdmitsAbsence} reads
 * from the annotation and the container position lowers — the wrapped
 * member renders optional. {@link CheckRaw} is the assert with teeth for
 * the annotation itself: the {@link Check} pair passes with or without the
 * wrapper, both halves stripping absence.
 */
type _PhantomOption = Phantom<Or<readonly[RttiOption, RttiNumber]>, AbsentOr<number>>
type _phantomRaw = Assert<CheckRaw<AbsentOr<number>, Or<readonly[RttiOption, RttiNumber]>>>
type _phantomPublic = Assert<Check<number, _PhantomOption>>
type _phantomOptionalMember = Assert<Check<
    { readonly a?: number } & unknown,
    { readonly a: _PhantomOption }
>>

/**
 * The wrapper's reason to exist: a present part that renders as the **top**
 * absorbs a union member — `Absent | Ts<{}>` is `unknown`, {@link StructTs}
 * rendering the empty struct as its `unknown` intersection identity — so a
 * union-carried marker drowned, the member rendered required, and the
 * union-shaped `CheckRaw` passed anyway, `_TsRaw` collapsing identically on
 * both sides. The wrapper survives the collapse, and the flag half of
 * {@link CheckRaw} fails the unwrapped spelling even at the top.
 */
type _PhantomTopOption = Phantom<Or<readonly[RttiOption, {}]>, AbsentOr<unknown>>
type _phantomTopRaw = Assert<CheckRaw<AbsentOr<unknown>, Or<readonly[RttiOption, {}]>>>
type _phantomTopMember = Assert<Check<
    { readonly a?: unknown } & unknown,
    { readonly a: _PhantomTopOption }
>>
type _phantomTopUnwrappedFails = Assert<Equal<
    CheckRaw<unknown, Or<readonly[RttiOption, {}]>>,
    false
>>

/**
 * The `Phantom` short-circuit holds at every structural predicate, not only
 * in `Ts`: a phantom-wrapped schema is still a thunk, so a predicate that
 * walked it — {@link _IsAbsentOnly} behind {@link ArrayTs} was the one that
 * did — re-expands a recursive union into itself and raises TS2589 where the
 * annotation exists precisely to prevent it. Pinned with a recursive
 * `X = or(option, number, X)` used as an array element, and with an
 * absence-only annotation, the pair that exercises both answers of the
 * phantom branch.
 */
type _PhantomRecThunk = () => readonly['or', RttiOption, RttiNumber, _PhantomRecThunk]
type _PhantomRec = Phantom<_PhantomRecThunk, AbsentOr<number>>
type _phantomRecursiveArray = Assert<Check<
    readonly number[],
    () => readonly['array', _PhantomRec]
>>
type _phantomRecursiveMember = Assert<Check<
    { readonly a?: number } & unknown,
    { readonly a: _PhantomRec }
>>
type _phantomAbsentOnlyArray = Assert<Check<
    readonly[],
    () => readonly['array', Phantom<RttiOption, AbsentOr<never>>]
>>
