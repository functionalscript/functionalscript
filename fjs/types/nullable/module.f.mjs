/**
 * Utilities for nullable (`null`/`undefined`) value handling.
 *
 * @module
 *
 * @import { Option } from '../option/types.ts'
 * @import { Nullable } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { fn } from '../function/module.f.mjs'

/**
 * Folds a `Nullable<T>` into a single value: `f` for a present value, `none`
 * for `null`.
 *
 * The two branches carry independent result types, and `R2` lives on its own
 * curry step on purpose. With `T`, `R1` and `R2` all on the outer generic they
 * are instantiated together at `match(f)` — before `none` exists — so `R2` has
 * nothing to infer from and collapses to `unknown`. Inferring it at the second
 * call instead is what lets {@link map} be derived below.
 *
 * @type {<T, R1>(f: (_: T) => R1) => <R2>(none: () => R2) => (_: Nullable<T>) => R1 | R2}
 */
export const match = f => none => value => value === null ? none() : f(value)

/** The absent branch `map` fixes `match`'s `none` to. */
const noneIsNull = () => null

/**
 * Projects the present value of a `Nullable<T>`, passing `null` through.
 *
 * `map` is `match` with the absent branch fixed to `null`, so the
 * `value === null` guard is written once, in `match`.
 *
 * @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>}
 */
export const map = f => match(f)(noneIsNull)

/**
 * @type {<T>(value: Nullable<T>) => Option<T>}
 */
export const toOption = value => value === null ? [] : [value]

/**
 * Normalizes a possibly-`undefined` value into the codebase's `null` convention.
 *
 * The boundary rule between JavaScript hosts (which return `undefined` from
 * property/index lookups) and FunctionalScript (which uses `null` for absence).
 *
 * @type {<T>(value: T | undefined) => Nullable<T>}
 */
export const fromUndefined = value => value === undefined ? null : value

/**
 * Extracts the value from a `Nullable`, asserting that it is not `null`.
 *
 * @type {<T>(value: Nullable<T>) => T}
 */
export const unwrap = value => {
    assert(value !== null)
    return value
}

/**
 * Lifts a function that signals failure with `null` into one that asserts
 * success instead, unwrapping the result.
 *
 * @type {<I, T>(f: (i: I) => Nullable<T>) => (_: I) => T}
 */
export const mapUnwrap = f =>
    fn(f).map(unwrap).result
