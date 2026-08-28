/**
 * Type-level API for the byte-set module.
 *
 * @module
 */

export type ByteSet = bigint

/** A member of a `ByteSet`: an unsigned integer below 256. */
export type _Byte = number
