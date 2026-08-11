/**
 * Type-level API shared by RTTI consumers (`validate`, `parse`).
 *
 * @module
 */
import type { Primitive, Unknown } from '../ts/types.ts'
import type { Primitive0, Struct, Tag1, Tuple, Type } from '../types.ts'
import type { Result as CommonResult } from '../../result/types.ts'
import type { Ts } from '../ts/types.ts'
import type { StringMap } from '../../object/types.ts'

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
    readonly array: (item: Type) => R
    readonly record: (item: Type) => R
    readonly or: (variants: readonly Type[]) => R
    readonly constPrimitive: (p: Primitive) => R
    readonly primitive0: (tag: Primitive0) => R
    readonly unknown: () => R
}

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
