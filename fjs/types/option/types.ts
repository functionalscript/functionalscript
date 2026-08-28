/**
 * Optional tuple-based value representation.
 */

/**
 * Represents an optional value as an empty tuple or a tuple with one value.
 */
export type Option<T> = readonly [T] | readonly []
