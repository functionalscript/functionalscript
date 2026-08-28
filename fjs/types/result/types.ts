/**
 * Types for representing operations that can succeed or fail.
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
