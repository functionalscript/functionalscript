/**
 * Range and interval utilities for numeric boundaries.
 *
 * @module
 */

/** @typedef { readonly [number, number]} Range */

/** @type {(...range: Range) => (i: number) => boolean} */
export const contains = (b, e) => i => b <= i && i <= e

/** @type {(i: number) => Range} */
export const one = a => [a, a]
