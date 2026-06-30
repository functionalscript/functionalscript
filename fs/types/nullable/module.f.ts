/**
 * Utilities for nullable (`null`/`undefined`) value handling.
 *
 * @module
 */
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
 * Asserts a `Nullable<T>` is present, returning the `T` or throwing on `null`.
 *
 * Use this — never a bare `!` — only where the `null` branch is provably dead
 * because the value's size is fixed by the algorithm (independent of input
 * size) or comes from a source literal. A bare `!` only silences the
 * type-checker, so a (supposedly impossible) `null` would survive to surface as
 * an obscure error far from its cause; `unwrap` turns the invariant into a
 * checked assertion that throws at the call site. Anything whose size is
 * data-derived must propagate the `null` instead.
 */
export const unwrap = <T>(value: Nullable<T>): T => {
    if (value === null) { throw 'unexpected null' }
    return value
}
