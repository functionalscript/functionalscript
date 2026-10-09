/**
 * Percent-decoding of UTF-8 text.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { hexDigitValue } from '../ascii/module.f.mjs'
import { stringToU8List, tryU8ListToString } from '../utf8/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { unwrap } from '../../types/nullable/module.f.mjs'

/** @type {(s: string) => readonly number[]} */
const utf8Bytes = s => toArray(stringToU8List(s))

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
    return tryU8ListToString([...utf8Bytes(literal), ...escaped.flatMap(escapeBytes)])
}
