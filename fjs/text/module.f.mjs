/**
 * Indented text `Block` rendering and UTF-8 helpers: `flat` flattens a nested
 * block into prefixed lines, while `utf8`/`utf8ToString` convert between
 * strings and MSB-first UTF-8 bit vectors.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { Block, Item, Utf8 } from './types.ts'
 */

import { msb, tryU8ListToVec, u8List } from '../types/bit_vec/module.f.mjs'
import { flatMap } from '../types/list/module.f.mjs'
import { fromCodePointList, toCodePointList } from './utf8/module.f.mjs'
import { stringToCodePointList, codePointListToString } from './utf16/module.f.mjs'
import { mapUnwrap } from '../types/nullable/module.f.mjs'

/** @type {(indent: string) => (text: Block) => List<string>} */
export const flat = indent => {
    /** @param {string} prefix */
    const f = prefix => {
        /** @type {(item: Item) => List<string>} */
        const g = item =>
            typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return flatMap(g)
    }
    return f('')
}

const tryU8ListToVecMsb = tryU8ListToVec(msb)

/**
 * Converts a string to an UTF-8, represented as an MSB first bit vector,
 * returning `null` instead of throwing if the result would exceed
 * `maxLength`.
 *
 * @param {string} s The input string to be converted.
 * @returns {Nullable<Utf8>} The resulting UTF-8 bit vector, MSB first, or `null` on overflow.
 */
export const tryUtf8 = s =>
    tryU8ListToVecMsb(fromCodePointList(stringToCodePointList(s)))

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

/**
 * Converts a UTF-8 bit vector with MSB first encoding to a string.
 *
 * @param {Utf8} msbV The UTF-8 bit vector with MSB first encoding.
 * @returns {string} The resulting string.
 */
export const utf8ToString = msbV =>
    codePointListToString(toCodePointList(u8List(msb)(msbV)))
