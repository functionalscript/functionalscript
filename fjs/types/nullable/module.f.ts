/**
 * Utilities for nullable (`null`/`undefined`) value handling.
 *
 * @module
 */
import { assert } from '../../asserts/module.f.ts'
import { fn } from '../function/module.f.ts'
import type { Option } from '../option/module.f.ts'

export type Nullable<T> = T | null

export const map: <T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>
    = f => value => value === null ? null : f(value)

export const match: <T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>
    = f => none => value => value === null ? none() : f(value)

export const toOption = <T>(value: Nullable<T>): Option<T> => value === null ? [] : [value]

/**
 * Normalizes a possibly-`undefined` value into the codebase's `null` convention.
 *
 * The boundary rule between JavaScript hosts (which return `undefined` from
 * property/index lookups) and FunctionalScript (which uses `null` for absence).
 */
export const fromUndefined = <T>(value: T | undefined): Nullable<T> =>
    value === undefined ? null : value

/**
 * Extracts the value from a `Nullable`, asserting that it is not `null`.
 */
export const unwrap = <T>(value: Nullable<T>): T => {
    assert(value !== null)
    return value
}

/**
 * Lifts a function that signals failure with `null` into one that asserts
 * success instead, unwrapping the result.
 */
export const mapUnwrap = <I, T>(f: (i: I) => Nullable<T>) =>
    fn(f).map(unwrap).result
