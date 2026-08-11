/**
 * A module for representing and handling operations that can succeed or fail.
 *
 * @module
 *
 * @example
 *
 * ```ts
 * import { error, ok, unwrap, type Result } from './module.f.ts'
 *
 * const success: Result<number, string> = ok(42)
 * const failure: Result<number, string> = error('Something went wrong')
 *
 * if (unwrap(success) !== 42) { throw 'error' }
 * const [kind, v] = failure
 * if (kind !== 'error') { throw 'error' }
 * // `v` is inferred as `string` here
 * if (v !== 'Something went wrong') { throw 'error' }
 * ```
 */

/** @import { Ok, Error, Result } from './types.ts' */

/**
 * Creates a successful result.
 *
 * @template T
 * @param {T} value - The value to wrap.
 * @returns {Ok<T>} A successful result containing the value.
 */
export const ok = value  => ['ok', value]

/**
 * Creates a failed result.
 *
 * @template E
 * @param {E} e - The error to wrap.
 * @returns {Error<E>} A failed result containing the error.
 */
export const error = e => ['error', e]

/**
 * Unwraps a result, returning the value if successful or throwing the error if failed.
 *
 * @template T
 * @template E
 * @param {Result<T, E>} param0 - The result to unwrap.
 * @returns {T} The value if the result is successful. Otherwise, throws the error.
 */
export const unwrap = ([kind, v]) => {
    if (kind === 'error') { throw v }
    return v
}

/**
 * Swaps the `ok` and `error` cases of a result.
 *
 * @type {<T, E>([k, v]: Result<T, E>) => Result<E, T>}
 */
export const invert = ([k, v]) => k === 'ok' ? error(v) : ok(v)

/**
 * Maps the `ok` case of a result, passing an `error` through unchanged.
 *
 * @type {<T, R>(f: (value: T) => R) => <E>(r: Result<T, E>) => Result<R, E>}
 */
export const mapOk = f => r => r[0] === 'ok' ? ok(f(r[1])) : r
