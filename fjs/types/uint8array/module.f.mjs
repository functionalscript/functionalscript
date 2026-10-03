/**
 * Conversions between `Uint8Array` values and bit vectors.
 *
 * @deprecated FunctionalScript represents byte data as `bigint`-based bit
 * vectors (`Vec` from `fjs/types/bit_vec`). Use `utf8`/`utf8ToString` from
 * `fjs/text` for string encoding, and the `bit_vec` module directly for raw
 * byte manipulation. `Uint8Array` interop belongs at Node.js boundaries only
 * (e.g. `fromVec`/`toVec` when reading or writing files).
 *
 * @module
 *
 * @import { Vec } from '../bit_vec/types.ts'
 * @import { List } from '../list/types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { utf8, utf8ToString } from '../../text/module.f.mjs'
import { length, maxLengthBytes, msb, vec } from '../bit_vec/module.f.mjs'
import { compose } from '../function/module.f.mjs'
import { map, toArray } from '../list/module.f.mjs'

// Both conversions go through the bigint's hexadecimal spelling, two digits
// a byte, rather than through a list of bytes: one `BigInt` or one
// `toString` over the whole, where the list cost a bigint shift per byte —
// on 128 KiB, the chunk the HTTP pump writes, `fromVec` took 150 ms that
// way and takes 8 ms this way, which is what keeps the pump's proofs inside
// the five seconds Bun gives one.

/** @type {(byte: number) => string} */
const hexOfByte = byte => byte.toString(16).padStart(2, '0')

/** @type {(bytes: Uint8Array) => string} */
const hexOf = bytes => Array.from(bytes, hexOfByte).join('')

/**
 * Concatenates a list of `Uint8Array` values into one MSB-first bit vector.
 *
 * Throws if the result would exceed `maxLength`, saying so, where the
 * vector's own constructor would fail on a bare assertion.
 *
 * @type {(input: List<Uint8Array>) => Vec}
 */
export const listToVec = input => {
    const hex = toArray(map(hexOf)(input)).join('')
    const bytes = BigInt(hex.length >> 1)
    assert(bytes <= maxLengthBytes, 'the array is too big')
    return vec(bytes << 3n)(BigInt(`0x0${hex}`))
}

/**
 * Converts a Uint8Array into an MSB-first bit vector.
 *
 * @type {(input: Uint8Array) => Vec}
 */
export const toVec = input => listToVec([input])

/**
 * Converts an MSB-first bit vector into a Uint8Array. A trailing partial
 * byte is zero-padded in its low bits, as `u8ListMsb` pads it.
 *
 * @type {(input: Vec) => Uint8Array}
 */
export const fromVec = input => {
    const bits = length(input)
    const pad = (8n - bits % 8n) % 8n
    // the leading `1` keeps the digits of a vector that starts in zeros
    const hex = ((1n << (bits + pad)) | (msb.front(bits)(input) << pad)).toString(16)
    return Uint8Array.from({ length: (hex.length - 1) >> 1 }, (_, i) => Number(`0x${hex.substring(1 + (i << 1), 3 + (i << 1))}`))
}

/** @type {(input: Uint8Array) => string} */
export const decodeUtf8 = compose(toVec)(utf8ToString)

/** @type {(input: string) => Uint8Array} */
export const encodeUtf8 = compose(utf8)(fromVec)
