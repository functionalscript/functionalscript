/**
 * Shared kernel for RTTI consumers (`validate`, `parse`).
 *
 * Both consumers traverse the same schema shape and produce the same
 * `Result<T, ValidationError>` outcome. Only the per-variant handling differs
 * — `validate` keeps the original value, `parse` constructs a fresh one.
 *
 * This module hosts the parts that do not differ:
 *
 * - The error shape (`ValidationError`, `Path`) and path bookkeeping
 *   (`verror`, `prependPath`).
 * - Primitive checks (`primitive0Validate`, `constPrimitiveValidate`).
 * - The `Validate<T>`/`Result<T>` signatures — `parse` uses the same shape.
 * - `visit`: a visitor over the `Type` ADT. Callers supply a `Visitor<R>`
 *   with one handler per variant; `visit(v)(rtti)` recognizes `rtti` and
 *   calls the matching handler. Both consumers compose their top-level
 *   function from a visitor.
 *
 * Keeping the kernel here also removes `parse`'s incidental dependency on
 * `validate` and gives future schema-driven consumers (e.g. the data form
 * sketched in [i143](../../../../issues/README.md)) a stable shared base.
 *
 * @module
 */
import type { Primitive, Unknown } from '../../../djs/module.f.ts'
import {
    type Const,
    type Info0,
    type Primitive0,
    type Struct,
    type Tag1,
    type Tuple,
    type Type,
} from '../module.f.ts'
import { error, ok, type Error, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject, type ReadonlyRecord } from '../../object/module.f.ts'

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

/** Builds an error result with empty path and the given message. */
export const verror = (message: string): Error<ValidationError> =>
    error({ path: [], message })

/** Prepends `key` to the error's path, used to build the path bottom-up. */
export const prependPath = (key: string, r: Error<ValidationError>): Error<ValidationError> =>
    error({ path: [key, ...r[1].path], message: r[1].message })

/** Validates a `Tag0` primitive schema using `typeof`. */
export const primitive0Validate = <K extends Primitive0, T extends Info0<K>>(tag: K): Validate<T> =>
    value => typeof value === tag ? ok(value) as any : verror('unexpected value') as any

/**
 * Validates a primitive `Const` schema using `Object.is` (SameValue).
 *
 * `Object.is` is used instead of `===` so that:
 * - `NaN` const schemas match `NaN` values (`===` would always fail because `NaN !== NaN`).
 * - `+0` and `-0` are treated as distinct const values.
 */
export const constPrimitiveValidate = <T extends Primitive>(rtti: T): Validate<T> =>
    value => Object.is(rtti, value)
        ? ok(value) as any
        : verror('unexpected value') as any

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

const visitConst = <R>(v: Visitor<R>) => (c: Const): R =>
    typeof c === 'object' && c !== null
        ? (commonIsArray(c) ? v.tuple(c) : v.struct(c as Struct))
        : v.constPrimitive(c as Primitive)

/** Type guard narrowing `Unknown` to a specific container type `C`. */
export type IsContainer<C extends Unknown> = (value: Unknown) => value is C

/** Extracts `[key, value]` entries from a container, with stringified keys for path reporting. */
export type GetEntries<C extends Unknown> = (value: C) => ReadonlyArray<readonly[string, Unknown]>

/** Maps a `Tag1` to its runtime container type. */
export type Container<K extends Tag1> = K extends 'array'
    ? ReadonlyArray<Unknown>
    : ReadonlyRecord<string, Unknown>

/** `IsContainer` guard for arrays, shared by `validate` and `parse`. */
export const isArray: IsContainer<ReadonlyArray<Unknown>> =
    value => commonIsArray(value)

/** `IsContainer` guard for records/structs, shared by `validate` and `parse`. */
export const isObject: IsContainer<ReadonlyRecord<string, Unknown>> =
    value => commonIsObject(value)

/**
 * Visits a schema `Type` by dispatching to the matching handler in `v`.
 *
 * - `Thunk` schemas are evaluated once to read the `Info` descriptor, then
 *   routed by tag (`'const'`, `'array'`, `'record'`, `'unknown'`, `'or'`,
 *   or a `Tag0` primitive).
 * - `Const` schemas (primitives, tuples, structs) are routed directly to
 *   `tuple`, `struct`, or `constPrimitive`.
 */
export const visit = <R>(v: Visitor<R>) => (rtti: Type): R => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return visitConst(v)(value[0] as Const)
            case 'array': return v.array(value[0])
            case 'record': return v.record(value[0])
            case 'unknown': return v.unknown()
            case 'or': return v.or(value)
        }
        return v.primitive0(tag as Primitive0)
    }
    return visitConst(v)(rtti)
}
