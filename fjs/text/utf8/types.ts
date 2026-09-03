/**
 * Types for UTF-8 byte-level encoding and decoding.
 *
 * @module
 */

import type { BoundedArray } from '../../types/array/types.ts'

/** An unsigned 8-bit integer, represents a single byte. */
export type U8 = number

/** A singed 32-bit integer. */
export type I32 = number

/**
 * Represents an unsigned 8-bit type - U8 or the end-of-file indicator.
 * The U8 represents the byte itself, and null indicates that reading does not
 * return anything else.
 */
export type ByteOrEof = U8 | null

/**
 * Represents the state of a UTF-8 decoding operation that contains at least one
 * byte: one to three, since a UTF-8 sequence is at most four bytes and the
 * fourth completes it.
 */
export type Utf8NonEmptyState = BoundedArray<1, 3, number>

/**
 * Represents the state of a UTF-8 decoding operation, which can be either
 * `null` (no state) or a non-empty state containing one or more bytes.
 */
export type Utf8State = null | Utf8NonEmptyState
