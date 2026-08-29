/**
 * Types for UTF-16 code units and Unicode code points.
 *
 * @module
 */

/**
 * Represent an unsigned UTF16, used to store one word UTF-16 (code unit).
 */
export type U16 = number

/**
 * [0, 0x10_FFFF]: 16+5 = 21 bits
 *
 * 121_0000_0000: 16+16+9 = 41 bits
 */

/**
 * Represent an Unicode code point.
 * Has range: from 0x0000 to 0x10_FFFF (21 bits).
 */
export type CodePoint = number
