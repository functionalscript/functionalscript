/**
 * Relative indexing of evaluated arrays and strings. Indexing truncates
 * fractions toward zero, counts negative indices from the end, and answers
 * tagged undefined out of range. Array elements keep their identities;
 * strings yield UTF-16 code units.
 *
 * The index is already a number: the method dispatchers convert it, with
 * `toNumber`, before they call this. Receivers satisfy the array/string
 * contract by construction.
 *
 * @module
 * @import { Array as ValueArray, EdagValue } from '../types.ts'
 */

import { tagUndefined } from '../semantics/module.f.js'

/** Array.at and String.at over represented receivers. @type {(receiver: ValueArray | string, index: number) => EdagValue} */
export const at = (receiver, index) =>
    tagUndefined((typeof receiver === 'string' ? receiver : receiver[1]).at(index))
