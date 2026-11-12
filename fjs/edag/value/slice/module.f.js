/**
 * Slice evaluated arrays and strings. An `undefined` end means the
 * receiver's length. Fractions truncate toward zero and negative bounds
 * count from the end, clamped to the receiver's length.
 *
 * Every array result is a fresh value retaining the selected element
 * identities. Strings are sliced by UTF-16 code unit. The bounds are
 * already numbers: the method dispatchers convert them, with `toNumber`,
 * before they call this.
 *
 * @module
 * @import { Array as ValueArray } from '../types.ts'
 */

/** Array.slice and String.slice over represented receivers. @type {(receiver: ValueArray | string, start: number, end: number | undefined) => ValueArray | string} */
export const slice = (receiver, start, end) => typeof receiver === 'string'
    ? receiver.slice(start, end)
    : ['[]', receiver[1].slice(start, end)]
