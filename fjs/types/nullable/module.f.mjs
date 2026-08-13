/**
 * Utilities for nullable (`null`/`undefined`) value handling.
 *
 * @module
 */

import { assert } from '../../asserts/module.f.mjs'
import { fn } from '../function/module.f.mjs'
/** @import { Option } from '../option/types.ts' */
/** @import { Nullable } from './types.ts' */

/**
 * @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>}
 */
export const map = f => value => value === null ? null : f(value)

/**
 * @type {<T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>}
 */
export const match = f => none => value => value === null ? none() : f(value)

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
