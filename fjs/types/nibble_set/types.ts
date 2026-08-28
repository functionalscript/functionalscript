/**
 * Types for compact 4-bit membership tracking.
 */

/** A set of nibbles as a 16-bit mask. JSON-serializable. */
export type NibbleSet = number

/** A 4-bit value, `0..15`. */
export type Nibble = number
