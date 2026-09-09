/**
 * Implementation-private types of the JSON reader: the rules under `string`
 * that its decoder reads, spelled from the grammar so that the decoder is
 * typed by the rule it decodes.
 *
 * @module
 */

import type { string } from '../module.f.mjs'

/**
 * One character of a string: the item of the repetition between the quotes,
 * a symbol as it stands or an escape.
 */
export type _Character = ReturnType<(typeof string)[1]>[3]

/**
 * What follows the backslash of an escape: the character of a simple escape,
 * or `u` and four hex digits.
 */
export type _Escape = _Character['escape'][1]

/** One hex digit of a `\u` escape, tagged by the range it is drawn from. */
export type _HexDigit = ReturnType<_Escape['u'][1]>[3]
