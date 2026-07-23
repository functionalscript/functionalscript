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

/**
 * Represents a successful result.
 */
export type Ok<T> = readonly ['ok', T]

/**
 * Represents a failed result.
 */
export type Error<E> = readonly ['error', E]

/**
 * Represents a result that can be either successful or failed.
 */
export type Result<T, E> = Ok<T> | Error<E>

/**
 * Creates a successful result.
 *
 * @param value - The value to wrap.
 * @returns A successful result containing the value.
 */
export const ok = <T>(value: T): Ok<T> => ['ok', value]

/**
 * Creates a failed result.
 *
 * @param e - The error to wrap.
 * @returns A failed result containing the error.
 */
export const error = <E>(e: E): Error<E> => ['error', e]

/**
 * Unwraps a result, returning the value if successful or throwing the error if failed.
 *
 * @param param0 - The result to unwrap.
 * @returns The value if the result is successful. Otherwise, throws the error.
 */
export const unwrap = <T, E>([kind, v]: Result<T, E>): T => {
    if (kind === 'error') { throw v }
    return v
}

/**
 * Swaps the `ok` and `error` cases of a result.
 */
export const invert = <T, E>([k, v]: Result<T, E>): Result<E, T> =>
    k === 'ok' ? error(v) : ok(v)

/**
 * Maps the `ok` case of a result, passing an `error` through unchanged.
 */
export const mapOk = <T, R>(f: (value: T) => R) => <E>(r: Result<T, E>): Result<R, E> =>
    r[0] === 'ok' ? ok(f(r[1])) : r
