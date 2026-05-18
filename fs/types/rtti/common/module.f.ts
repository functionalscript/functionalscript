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
 * - The `Validate<T>`/`Result<T>` types — `parse` uses the same signatures.
 * - `match`: collapses the two-level `Type` ADT (`Const | Thunk`, plus a
 *   thunk tag) into a single flat discriminated `Kind` union; both
 *   consumers switch on the result once instead of duplicating the
 *   recognition logic.
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
    type Tuple,
    type Type,
} from '../module.f.ts'
import { error, ok, type Error, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray } from '../../array/module.f.ts'

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
 * The recognized variants of `Type`, in a flat discriminated union.
 *
 * `match` collapses the original two-level shape (`Const | Thunk`, plus a
 * thunk tag) into a single discriminator that callers can switch on once.
 * Both `validate` and `parse` build their dispatch tables on top of this.
 */
export type Kind =
    | { readonly kind: 'tuple', readonly tuple: Tuple }
    | { readonly kind: 'struct', readonly struct: Struct }
    | { readonly kind: 'array', readonly item: Type }
    | { readonly kind: 'record', readonly item: Type }
    | { readonly kind: 'or', readonly variants: readonly Type[] }
    | { readonly kind: 'constPrimitive', readonly value: Primitive }
    | { readonly kind: 'primitive0', readonly tag: Primitive0 }
    | { readonly kind: 'unknown' }

const matchConst = (c: Const): Kind =>
    typeof c === 'object' && c !== null
        ? (isArray(c) ? { kind: 'tuple', tuple: c } : { kind: 'struct', struct: c as Struct })
        : { kind: 'constPrimitive', value: c as Primitive }

/**
 * Recognizes a schema `Type` and returns its variant as a flat `Kind`.
 *
 * - `Thunk` schemas are evaluated once to read the `Info` descriptor, then
 *   tagged by their leading tag (`'const'`, `'array'`, `'record'`,
 *   `'unknown'`, `'or'`, or a `Tag0` primitive).
 * - `Const` schemas (primitives, tuples, structs) are routed directly to
 *   `tuple`, `struct`, or `constPrimitive`.
 */
export const match = (rtti: Type): Kind => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return matchConst(value[0] as Const)
            case 'array': return { kind: 'array', item: value[0] }
            case 'record': return { kind: 'record', item: value[0] }
            case 'unknown': return { kind: 'unknown' }
            case 'or': return { kind: 'or', variants: value }
        }
        return { kind: 'primitive0', tag: tag as Primitive0 }
    }
    return matchConst(rtti)
}
