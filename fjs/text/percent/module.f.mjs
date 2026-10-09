/**
 * Percent-decoding of UTF-8 text, and the percent-encoding of a URL path that
 * keeps the escapes it already has.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import {
    fullStop, hexDigitValue, hyphenMinus, isDigit, isLatinCapitalLetter, isLatinSmallLetter, lowLine,
    solidus, tilde,
} from '../ascii/module.f.mjs'
import { isValidCodePoint } from '../code_point/module.f.mjs'
import { fromCodePointList, toCodePointList } from '../utf8/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/nullable/module.f.mjs'

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

/**
 * The byte the two hexadecimal digits beginning a part split on `%` denote,
 * or `null` when they are not both digits. A missing character reads as
 * `NaN`, which denotes no digit.
 *
 * @type {(part: string) => Nullable<number>}
 */
const escapeByte = part => {
    const hi = hexDigitValue(part.charCodeAt(0))
    const lo = hexDigitValue(part.charCodeAt(1))
    return hi === null || lo === null ? null : hi * 16 + lo
}

/** Whether a part split on `%` begins with two hexadecimal digits. @type {(part: string) => boolean} */
const isEscape = part => escapeByte(part) !== null

/** The escape byte and following literal bytes; `isEscape` has validated the part. @type {(part: string) => readonly number[]} */
const escapeBytes = part => [unwrap(escapeByte(part)), ...utf8Bytes(part.slice(2))]

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

/** The bytes besides letters and digits that stand for themselves in a URL
 * path: RFC 3986's other unreserved characters, and the segment separator.
 *
 * @type {readonly number[]}
 */
const pathMarks = [hyphenMinus, fullStop, lowLine, tilde, solidus]

/** Whether `b` stands for itself in a URL path. @type {(b: number) => boolean} */
const isPathByte = b =>
    isDigit(b) || isLatinSmallLetter(b) || isLatinCapitalLetter(b) || pathMarks.includes(b)

/** `b` as it reads in a URL path: itself, or its escape. @type {(b: number) => string} */
const pathByte = b =>
    isPathByte(b) ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, '0')}`

/** Every UTF-8 byte of `s` as it reads in a URL path. @type {(s: string) => string} */
const encodeLiteral = s => utf8Bytes(s).map(pathByte).join('')

/**
 * Percent-encodes a URL path for display, keeping the escapes it already has:
 * a `%XX` passes through verbatim, letters, digits, `-`, `.`, `_`, `~` and `/`
 * pass through, and every other UTF-8 byte is written as an escape — a control
 * character among them, which is what makes the result safe to echo to a
 * terminal.
 *
 * It decodes to what `s` decodes to. Not a general-purpose URI encoder, which
 * escapes the `%` too and turns `%1B` into `%251B`. Returns `null` exactly where
 * {@link percentDecode} does: a lone `%` is not an escape to keep, and a lone
 * surrogate has no UTF-8 bytes to encode.
 *
 * @type {(s: string) => Nullable<string>}
 */
export const percentEncodePath = s => {
    if (percentDecode(s) === null) { return null }
    const [literal, ...escaped] = s.split('%')
    return [
        encodeLiteral(literal),
        ...escaped.map(part => `%${part.slice(0, 2)}${encodeLiteral(part.slice(2))}`),
    ].join('')
}
