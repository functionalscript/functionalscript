/**
 * JavaScript's URI-component encoder, shared by the percent library and
 * the common runtime. It uses only primitive operations and the UTF-16
 * code-unit intrinsic, so the runtime can load and call it without itself.
 *
 * @module
 *
 * @import { EncodeUriComponent } from './types.ts'
 */

import { charCodeAt } from '../../../js/intrinsic/module.f.js'

/** The uppercase digits used by every percent escape. */
const digits = /** @type {const} */ ('0123456789ABCDEF')

/** A UTF-8 byte as an uppercase percent escape. @type {(byte: number) => string} */
const escapeByte = byte => `%${digits[Number(byte >> 4)]}${digits[Number(byte & 0xf)]}`

/** A Unicode scalar as its escaped UTF-8 bytes. @type {(scalar: number) => string} */
const escapeScalar = scalar => {
    if (scalar < 0x80) { return escapeByte(scalar) }
    if (scalar < 0x800) { return escapeByte(0xc0 | scalar >> 6) + escapeByte(0x80 | scalar & 0x3f) }
    if (scalar < 0x1_0000) {
        return escapeByte(0xe0 | scalar >> 12) + escapeByte(0x80 | scalar >> 6 & 0x3f) + escapeByte(0x80 | scalar & 0x3f)
    }
    return escapeByte(0xf0 | scalar >> 18) + escapeByte(0x80 | scalar >> 12 & 0x3f) + escapeByte(0x80 | scalar >> 6 & 0x3f) + escapeByte(0x80 | scalar & 0x3f)
}

/**
 * The next Unicode scalar and its UTF-16 width. A high surrogate must
 * have a following low surrogate; neither half can appear alone.
 *
 * @type {(text: string, index: number) => readonly [number, number]}
 */
const scalarAt = (text, index) => {
    const first = charCodeAt(text, index)
    if (0xd800 <= first && first <= 0xdbff) {
        const second = charCodeAt(text, index + 1)
        if (!(0xdc00 <= second && second <= 0xdfff)) { throw 'encodeURIComponent: unpaired surrogate' }
        return [0x1_0000 + (first - 0xd800) * 0x400 + second - 0xdc00, 2]
    }
    if (0xdc00 <= first && first <= 0xdfff) { throw 'encodeURIComponent: unpaired surrogate' }
    return [first, 1]
}

/** The ASCII letters, digits and marks JavaScript leaves unescaped. @type {(code: number) => boolean} */
const unescaped = code =>
    0x41 <= code && code <= 0x5a || 0x61 <= code && code <= 0x7a || 0x30 <= code && code <= 0x39 ||
    code === 0x2d || code === 0x5f || code === 0x2e || code === 0x21 || code === 0x7e ||
    code === 0x2a || code === 0x27 || code === 0x28 || code === 0x29

/**
 * Convert once with `String`, preserve `A-Z a-z 0-9 -_.!~*'()`, and
 * percent-encode every other UTF-8 byte. Unpaired surrogates fail; the
 * panic payload is not JavaScript's URIError, since FJS observes failure
 * rather than a catchable exception object.
 *
 * @type {EncodeUriComponent}
 */
export const encodeUriComponent = value => {
    const text = String(value)
    let result = ''
    let index = 0
    while (index < text.length) {
        const [scalar, width] = scalarAt(text, index)
        result = result + (unescaped(scalar) ? text[Number(index)] : escapeScalar(scalar))
        index = index + width
    }
    return result
}
