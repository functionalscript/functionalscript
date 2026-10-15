/**
 * UTF-8 helpers: `utf8`/`tryUtf8` encode a string as an MSB-first UTF-8 bit
 * vector. The decode direction is `utf8ToString`/`fromVec` in `./utf8`.
 *
 * @module
 *
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { Utf8 } from './types.ts'
 */

import { tryU8ListToVecMsb } from '../types/bit_vec/module.f.mjs'
import { stringToU8List } from './utf8/module.f.mjs'
import { mapUnwrap } from '../types/nullable/module.f.mjs'

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector,
 * returning `null` instead of throwing if the result would exceed
 * `maxLength`.
 *
 * @param {string} s The input string to be converted.
 * @returns {Nullable<Utf8>} The resulting UTF-8 bit vector, MSB first, or `null` on overflow.
 */
export const tryUtf8 = s =>
    tryU8ListToVecMsb(stringToU8List(s))

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector.
 *
 * @param s The input string to be converted.
 * @returns The resulting UTF-8 bit vector, MSB first.
 *
 * @type {(s: string) => Utf8}
 */
export const utf8 =
    mapUnwrap(tryUtf8)
