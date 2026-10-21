/**
 * Type-level API shared by RTTI consumers: the schema-form readers `validate`
 * and `parse`, and the data form.
 *
 * @module
 */

import type { Primitive, Unknown } from '../ts/types.ts'
import type { ConstObject, Primitive0, Struct, Tag1, Tuple, Type } from '../types.ts'
import type { Result as CommonResult } from '../../types/result/types.ts'
import type { Ts } from '../ts/types.ts'
import type { StringMap } from '../../types/object/types.ts'

/** A path to a sub-value within the validated structure. Each step is an object key or stringified array index. */
export type Path = readonly string[]

/** Detailed validation failure: the offending `path` plus a short `message`. */
export type ValidationError = {
    readonly path: Path
    readonly message: string
}

/** Validation/parse result: either the typed value or a `ValidationError`. */
export type Result<T extends Type> = CommonResult<Ts<T>, ValidationError>

/** A function that checks an unknown value against schema `T`. Shared by `validate` and `parse`. */
export type Validate<T extends Type> = (value: Unknown) => Result<T>

/**
 * One handler per `Type` variant. Both `validate` and `parse` provide a
 * `Visitor<R>` where `R` is the per-variant output (e.g. a `Validate` function).
 */
export type Visitor<R> = {
    readonly tuple: (rtti: Tuple) => R
    readonly struct: (rtti: Struct) => R
    /**
     * A container with a stated rest: the declared members of `rtti`, plus any
     * number of members belonging to `r`. The bare `tuple`/`struct` handlers
     * are the same thing with `r` of `never`, and are kept apart because the
     * common case pays no rest walk.
     */
    readonly rest: (rtti: ConstObject, r: Type) => R
    readonly array: (item: Type) => R
    readonly record: (item: Type) => R
    readonly or: (variants: readonly Type[]) => R
    readonly constPrimitive: (p: Primitive) => R
    readonly primitive0: (tag: Primitive0) => R
    readonly unknown: () => R
    /**
     * The nullary `option` schema — absence. A reader's handler *rejects*
     * normally: absence is decided by the container loop before dispatch
     * (see `admitsAbsence` in `./module.f.mjs`), so a value that reaches a
     * recursive reader is present by construction, and under `or(option, t)`
     * the `option` branch has to return an ordinary error for `t` to be
     * tried.
     */
    readonly option: () => R
}

/**
 * Reads what a container schema declares, as `[key, Type]` pairs — one per
 * container kind, since a `Tuple` is read by length and a `Struct` by
 * enumerable key. See `tupleSchemaEntries` in `./module.f.mjs` for why the two
 * readings are not interchangeable on a sparse array.
 */
export type SchemaEntries<S extends ConstObject> =
    (rtti: S) => ReadonlyArray<readonly [string, Type]>

/**
 * Whether a container `value` reaches no further than the `declared` members
 * of its schema. The array kind is the only one with an answer of its own:
 * `length` says how far an array reaches whether or not anything is there, so
 * a hole past the prefix is caught here and nowhere else. An object has no
 * such measure, and always fits.
 */
export type Fits<C extends Unknown> = (value: C, declared: number) => boolean

/** Type guard narrowing `Unknown` to a specific container type `C`. */
export type IsContainer<C extends Unknown> = (value: Unknown) => value is C

/** Maps a `Tag1` to its runtime container type. */
export type Container<K extends Tag1> = K extends 'array'
    ? ReadonlyArray<Unknown>
    : StringMap<Unknown>

/** `Result` with the payload type erased; avoids instantiating `Ts<Type>`. */
export type ResultE = CommonResult<Unknown, ValidationError>

/** A `Validate`-shaped function with the payload type erased. */
export type ValidateE = (value: Unknown) => ResultE

/**
 * What one schema-form reader brings to the container skeletons in
 * `./module.f.mjs`: the recursion into a member's schema, and what it
 * collects from the members it reads. `validate` collects nothing and `parse`
 * the parsed members; the skeletons own the order the members are read in.
 */
export type Reader<A> = {
    /** The reader of a member's schema: the recursive entry point. */
    readonly read: (rtti: Type) => ValidateE
    /** What is collected before any member is read. */
    readonly empty: A
    /** Collects a present member, as `read` answered it. */
    readonly cons: (acc: A, k: string, v: Unknown) => A
}

/**
 * What a container becomes once every member is checked: built from what the
 * reader collected, or the container itself.
 */
export type Finish<C extends Unknown, A> = (acc: A, value: C) => Unknown

/**
 * One {@link Finish} per container kind: what a reader builds of an `array`,
 * a `record`, a `Tuple` and a `Struct` once its members are read. A container
 * with a stated `rest` is finished as the bare kind it extends.
 */
export type Finishes<A> = {
    readonly array: Finish<ReadonlyArray<Unknown>, A>
    readonly record: Finish<StringMap<Unknown>, A>
    readonly tuple: Finish<ReadonlyArray<Unknown>, A>
    readonly struct: Finish<StringMap<Unknown>, A>
}
