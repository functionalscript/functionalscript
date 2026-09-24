/**
 * Types for UTF-8 byte-level encoding and decoding.
 *
 * @module
 */

import type { BoundedArray } from '../../types/array/types.ts'

/** An unsigned 8-bit integer, represents a single byte. */
export type U8 = number

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
