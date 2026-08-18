/**
 * A module for representing and handling operations that can succeed or fail.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { error, ok, okThen, unwrap } from './module.f.mjs'
 *
 * const success = ok(42)
 * const failure = error('Something went wrong')
 *
 * if (unwrap(success) !== 42) { throw 'error' }
 * const [kind, v] = failure
 * if (kind !== 'error') { throw 'error' }
 * // `v` is `'Something went wrong'` here
 *
 * // `okThen` chains; an `error` skips the rest of the chain unchanged.
 * const half = n => n % 2 === 0 ? ok(n / 2) : error('odd')
 * if (unwrap(okThen(half)(success)) !== 21) { throw 'error' }
 * ```
 *
 * @import { Ok, Error, Result } from './types.ts'
 */

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

/**
 * Chains a `Result`-returning step onto a `Result`, passing an `error` through
 * unchanged. The monadic bind to {@link mapOk}'s functor map, and the pure
 * sibling of the branch `fjs/effects`'s `step` writes for an effect that
 * also performs operations.
 *
 * The two error types are **unioned, not unified**. A validation chain
 * typically widens its error as it goes — a JSON parse failure (`string`)
 * followed by an rtti schema failure (`ValidationError`) — and the hand-written
 * form expressed that by rebuilding the incoming error with `error(v)` purely
 * to retag it into the wider type. `E | F` states the widening in the type
 * instead, so neither side has to be pre-widened and the passed-through
 * `error` stays the very tuple it arrived as.
 *
 * `F` binds on the second arrow, as in {@link mapOk}: `f` alone determines the
 * value types, so one `okThen(f)` applies to results carrying any error type.
 *
 * Reach for it when the step needs **only** the value it is handed. A chain
 * whose later steps also read an earlier one's value would have to nest a
 * closure per link to keep those values in scope, which `fjs/AGENTS.md` §3.4 rules
 * out for the same reason it rules out nested `step`; write those as a flat
 * sequence of guards.
 *
 * @type {<T, R, E>(f: (value: T) => Result<R, E>) => <F>(r: Result<T, F>) => Result<R, E | F>}
 */
export const okThen = f => r => r[0] === 'error' ? r : f(r[1])
