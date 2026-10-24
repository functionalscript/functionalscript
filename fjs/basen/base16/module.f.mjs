/**
 * Base16 (RFC 4648): a list of bytes and its hex spelling, two digits a
 * byte, the high digit first.
 *
 * The writer spells the small letters, which is what Git and every other
 * writer in this repository spells. The readers take a continuous run of
 * pairs, with no prefix and no separator, and refuse an odd count of
 * digits or any code unit that is no digit; an empty run is no bytes.
 * {@link decode} reads either case, as RFC 4648 and Git read it, and
 * {@link decodeLower} the small letters only, for a spelling that admits
 * nothing else. A separator, a prefix or a length is the caller's grammar,
 * checked around the codec.
 *
 * The digits are `fjs/text/ascii`'s, so no value of a digit is derived
 * here. The input is a list of numbers and not a `Vec`: `../module.f.mjs`'s
 * `baseN` codes bits, and a byte list is what every reader of a hex
 * spelling holds.
 *
 * {@link encodeScalar} is the codec's other writer: one number, not a byte
 * list, spelled in a fixed width of digits, as a literal, an escape or a
 * key of a given size spells it.
 *
 * The writer's input is bytes by contract, integers `0..0xff`, as the `U8`
 * in its type says; it does not check them, as none of the spellings it
 * replaced did. The readers only ever answer such bytes.
 *
 * @module
 *
 * @import { U8 } from '../../text/utf8/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { hexDigitCodePoint, hexDigitValue, lowerHexDigitValue } from '../../text/ascii/module.f.js'
import { codePointListToString } from '../../text/utf16/module.f.mjs'

/** The two lowercase hex digit code points of a byte, the high one first. @type {(byte: U8) => readonly [number, number]} */
const digitsOf = byte => [hexDigitCodePoint(byte >> 4), hexDigitCodePoint(byte & 0xf)]

/**
 * The lowercase hex digit code points spelling `bytes`, two a byte.
 *
 * @type {(bytes: readonly U8[]) => readonly number[]}
 */
export const encodeCodePoints = bytes => bytes.flatMap(digitsOf)

/**
 * The lowercase hex spelling of `bytes`, two digits a byte.
 *
 * @type {(bytes: readonly U8[]) => string}
 */
export const encode = bytes => codePointListToString(encodeCodePoints(bytes))

/**
 * A non-negative integer in lowercase hex, zero-padded to `width` digits:
 * `encodeScalar(4)(0x61)` is `0061`. A value wider than `width` keeps all
 * its digits, so the width is a minimum. A spelling in capitals is the
 * caller's, over this one.
 *
 * @type {(width: number) => (value: number | bigint) => string}
 */
export const encodeScalar = width => value => value.toString(16).padStart(width, '0')

/**
 * The bytes a run of hex digit code points spells, each read by
 * `digitValue`, or `null` on an odd count or a code point it does not read.
 *
 * @type {(digitValue: (codePoint: number) => Nullable<number>) => (codePoints: readonly number[]) => Nullable<readonly U8[]>}
 */
const decodeWith = digitValue => codePoints => {
    const values = codePoints.flatMap(c => {
        const v = digitValue(c)
        return v === null ? [] : [v]
    })
    return values.length !== codePoints.length || values.length % 2 !== 0
        ? null
        : Array.from({ length: values.length / 2 }, (_, i) => values[2 * i] * 16 + values[2 * i + 1])
}

/**
 * The code units of `s`, which a hex reader reads as code points: no digit
 * is a surrogate, so a string's pairs are refused either way.
 *
 * @type {(s: string) => readonly number[]}
 */
const codeUnits = s => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i))

/**
 * The bytes a run of hex digit code points spells, `0-9`, `a-f` and `A-F`
 * alike, or `null` on an odd count or a code point that is no hex digit, a
 * non-integer included.
 *
 * @type {(codePoints: readonly number[]) => Nullable<readonly U8[]>}
 */
export const decodeCodePoints = decodeWith(hexDigitValue)

/**
 * The bytes a hex string spells, either case, or `null` as
 * {@link decodeCodePoints} refuses.
 *
 * @type {(hex: string) => Nullable<readonly U8[]>}
 */
export const decode = hex => decodeCodePoints(codeUnits(hex))

const decodeLowerCodePoints = decodeWith(lowerHexDigitValue)

/**
 * The bytes a lowercase hex string spells, or `null` on an odd count or a
 * code unit that is not one of `0-9`, `a-f`: {@link decode} without `A-F`.
 *
 * @type {(hex: string) => Nullable<readonly U8[]>}
 */
export const decodeLower = hex => decodeLowerCodePoints(codeUnits(hex))
