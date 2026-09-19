/**
 * Percent-decoding of UTF-8 text.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { isValidCodePoint } from '../code_point/module.f.mjs'
import { fromCodePointList, toCodePointList } from '../utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/** @type {string} */
const hexDigits = '0123456789abcdef'

/** @type {(c: string) => number} */
const hexDigit = c => hexDigits.indexOf(c.toLowerCase())

/** @type {(s: string) => readonly number[]} */
const utf8Bytes = s => toArray(fromCodePointList(stringToCodePointList(s)))

/** @type {(bytes: readonly number[]) => Nullable<string>} */
const utf8String = bytes => {
    const codePoints = toArray(toCodePointList(bytes))
    for (const c of codePoints) {
        if (!isValidCodePoint(c)) { return null }
    }
    return codePointListToString(codePoints)
}

/** Whether a part split on `%` begins with two hexadecimal digits. @type {(part: string) => boolean} */
const isEscape = part =>
    part.length >= 2 && hexDigit(part.charAt(0)) >= 0 && hexDigit(part.charAt(1)) >= 0

/** The escape byte and following literal bytes; `isEscape` has validated the part. @type {(part: string) => readonly number[]} */
const escapeBytes = part =>
    [hexDigit(part.charAt(0)) * 16 + hexDigit(part.charAt(1)), ...utf8Bytes(part.slice(2))]

/**
 * Percent-decodes UTF-8 text. Returns `null` for malformed escapes or byte
 * sequences that are not valid UTF-8.
 *
 * Validate every escape before producing bytes, then decode the whole byte
 * stream: several escapes can encode one character. Keep these passes linear;
 * repeatedly copying the accumulated byte array per escape is quadratic.
 *
 * @type {(s: string) => Nullable<string>}
 */
export const percentDecode = s => {
    const [literal, ...escaped] = s.split('%')
    if (!escaped.every(isEscape)) { return null }
    return utf8String([...utf8Bytes(literal), ...escaped.flatMap(escapeBytes)])
}
