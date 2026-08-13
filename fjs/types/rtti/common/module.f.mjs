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
 * - `eachEntry`: the container entry loop (array/record/tuple/struct), shared
 *   by both consumers' container builders. Callers choose what (if anything)
 *   to accumulate, so `validate`'s pure pass/fail check pays no allocation.
 * - `orVisit`: the shared `or` handler — try each variant's recursive walker,
 *   return the first match.
 *
 * Keeping the kernel here also removes `parse`'s incidental dependency on
 * `validate` and gives future schema-driven consumers (e.g. the data form
 * sketched in [i143](../../../../issues/README.md)) a stable shared base.
 *
 * @module
 */

/** @import { Primitive, Unknown } from '../ts/types.ts' */
/** @import { Const, Info0, Primitive0, Struct, Tag1, Tuple, Type } from '../types.ts' */
/** @import { Error, Result as CommonResult } from '../../result/types.ts' */
import { error, ok } from '../../result/module.f.mjs'
import { isArray as commonIsArray } from '../../array/module.f.mjs'
import { isObject as commonIsObject } from '../../object/module.f.mjs'
/** @import { StringMap } from '../../object/types.ts' */
/** @import { Validate, Visitor, IsContainer, Container, ResultE, ValidateE, ValidationError } from './types.ts' */

/** Builds an error result with empty path and the given message. */
/** @type {(message: string) => Error<ValidationError>} */
export const verror = message =>
    error({ path: [], message })

/** Prepends `key` to the error's path, used to build the path bottom-up. */
/** @type {(key: string, error: Error<ValidationError>) => Error<ValidationError>} */
export const prependPath = (key, [,r]) =>
    error({ path: [key, ...r.path], message: r.message })

/** Validates a `Tag0` primitive schema using `typeof`. */
export const primitive0Validate =
    /**
     * @template {Primitive0} K
     * @template {Info0<K>} T
     * @param {K} tag
     * @returns {Validate<T>}
     */
    tag =>
        value => typeof value === tag ? /** @type {any} */ (ok(value)) : verror('unexpected value')

/**
 * Validates a primitive `Const` schema using `Object.is` (SameValue).
 *
 * `Object.is` is used instead of `===` so that:
 * - `NaN` const schemas match `NaN` values (`===` would always fail because `NaN !== NaN`).
 * - `+0` and `-0` are treated as distinct const values.
 */
export const constPrimitiveValidate =
    /**
     * @template {Primitive} T
     * @param {T} rtti
     * @returns {Validate<T>}
     */
    rtti =>
        value => Object.is(rtti, value)
            ? /** @type {any} */ (ok(value))
            : verror('unexpected value')

/** @type {<R>(v: Visitor<R>) => (c: Const) => R} */
const visitConst = v => c =>
    typeof c === 'object' && c !== null
        ? (commonIsArray(c) ? v.tuple(c) : v.struct(/** @type {Struct} */ (c)))
        : v.constPrimitive(/** @type {Primitive} */ (c))

/** `IsContainer` guard for arrays, shared by `validate` and `parse`. */
/** @type {IsContainer<ReadonlyArray<Unknown>>} */
export const isArray =
    value => commonIsArray(value)

/** `IsContainer` guard for records/structs, shared by `validate` and `parse`. */
/** @type {IsContainer<StringMap<Unknown>>} */
export const isObject =
    value => commonIsObject(value)

/**
 * Runs `item` over each `[key, value]` entry, bailing out with the first
 * error, path-prefixed with that entry's key. On success, folds each item's
 * result into `acc` (starting from `init`) with `accumulate` and returns the
 * final accumulator.
 *
 * Shared by `validate` and `parse`'s container builders (array/record/tuple/
 * struct), which differ only in what `item` does with the value and what
 * they accumulate: `validate` has nothing to collect — its entire schema is
 * "did every entry succeed?" — so it passes `undefined`/`(acc) => acc` and
 * pays no allocation per entry; `parse` needs the rebuilt `[key, value]`
 * pairs, so it folds them into a `List` (see its call site) and converts to
 * an array once at the end.
 */
export const eachEntry =
    /**
     * @template V
     * @template R
     * @template A
     * @param {ReadonlyArray<readonly [string, V]>} entries
     * @param {(k: string, v: V) => CommonResult<R, ValidationError>} item
     * @param {A} init
     * @param {(acc: A, k: string, value: R) => A} accumulate
     * @returns {CommonResult<A, ValidationError>}
     */
    (entries, item, init, accumulate) => {
        let acc = init
        for (const [k, v] of entries) {
            const r = item(k, v)
            if (r[0] === 'error') {
                return prependPath(k, r)
            }
            acc = accumulate(acc, k, r[1])
        }
        return ok(acc)
    }

/**
 * First variant in `variants` that `recurse` accepts, else `verror('no match')`.
 *
 * Shared `or` handler for `validate` and `parse`: both try each variant
 * against the value and return the first `'ok'` verbatim, differing only in
 * which recursive function (`validate` or `parse`) walks each variant. `recurse`
 * is typed over the erased `ValidateE` alias — annotating it as `(t: Type) =>
 * Validate<Type>` would itself instantiate `Validate<Type>` and hit TS2589 —
 * so each caller passes its recursive function through one boundary cast.
 *
 * @type {(recurse: (t: Type) => ValidateE) => (variants: readonly Type[]) => (value: Unknown) => ResultE}
 */
export const orVisit =
    recurse =>
    variants => value => {
        for (const t of variants) {
            const r = recurse(t)(value)
            if (r[0] === 'ok') {
                return r
            }
        }
        return verror('no match')
    }

/**
 * Visits a schema `Type` by dispatching to the matching handler in `v`.
 *
 * - `Thunk` schemas are evaluated once to read the `Info` descriptor, then
 *   routed by tag (`'const'`, `'array'`, `'record'`, `'unknown'`, `'or'`,
 *   or a `Tag0` primitive).
 * - `Const` schemas (primitives, tuples, structs) are routed directly to
 *   `tuple`, `struct`, or `constPrimitive`.
 */
export const visit =
    /**
     * @template R
     * @param {Visitor<R>} v
     * @returns {(rtti: Type) => R}
     */
    v => rtti => {
        if (typeof rtti === 'function') {
            const [tag, ...value] = rtti()
            switch (tag) {
                case 'const': return visitConst(v)(/** @type {Const} */ (value[0]))
                case 'array': return v.array(value[0])
                case 'record': return v.record(value[0])
                case 'unknown': return v.unknown()
                case 'or': return v.or(value)
            }
            return v.primitive0(/** @type {Primitive0} */ (tag))
        }
        return visitConst(v)(rtti)
    }
