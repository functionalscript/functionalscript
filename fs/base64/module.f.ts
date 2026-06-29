/**
 * Standard Base64 encoding and decoding (RFC 4648).
 *
 * @module
 */
import { msb, type Vec, length, vec, empty, maxLength } from "../types/bit_vec/module.f.ts"
import { mask } from "../types/bigint/module.f.ts"
import type { Nullable } from "../types/nullable/module.f.ts"
import { baseN } from "../base_n/module.f.ts"

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const { concat } = msb

const { vecToString, stringToVec } = baseN(6n, alphabet)

export const encode = (input: Vec): Nullable<string> => {
    const len = length(input)
    // Base64 is a byte codec; reject non-octet-aligned inputs.
    if (len % 8n !== 0n) { return null }
    const rem = len % 24n
    const padBits = rem === 0n ? 0n : 6n - rem % 6n
    const v = padBits > 0n ? concat(input)(vec(padBits)(0n)) : input
    let result = vecToString(v)
    // Append `=` padding to make total length a multiple of 4.
    while (result.length % 4 !== 0) { result += '=' }
    return result
}

export const decode = (input: string): Nullable<Vec> => {
    // Count and strip trailing `=` padding (0, 1, or 2).
    let padChars = 0
    for (let i = input.length - 1; i >= 0 && input[i] === '='; i--) { padChars++ }
    if (padChars > 2) { return null }

    const body = input.slice(0, input.length - padChars)

    // Total chars must make a multiple of 4 with the padding.
    if ((body.length + padChars) % 4 !== 0) { return null }

    // Each base64 char carries 6 bits; the trailing `removeBits` of them are the
    // zero-padding introduced during encode (padChars=1 → 2 bits, 2 → 4 bits).
    const removeBits = BigInt(padChars * 2)
    // Decoded length in bits, derived from the input size so the single-`Vec`
    // ceiling is enforced *before* building anything: an over-`maxLength` result
    // is rejected as `null` rather than overflowing the runtime's `bigint` cap
    // (which throws on `bun`). This is the byte-codec mirror of `u8ListToVec`'s
    // boundary guard.
    const targetLen = BigInt(body.length) * 6n - removeBits
    if (targetLen > maxLength) { return null }
    if (targetLen <= 0n) { return empty }

    // Decode every 6-bit chunk except the trailing one with `stringToVec`, then
    // append only the data bits of the last chunk. Splitting off the last char
    // keeps the largest intermediate vector at exactly `targetLen` bits, so a
    // `maxLengthBytes` blob (whose full `body.length * 6` would be `targetLen +
    // removeBits`, just over the cap) still builds without overflow.
    const lastPos = body.length - 1
    const head = stringToVec(body.slice(0, lastPos))
    if (head === null) { return null }
    const lastIndex = alphabet.indexOf(body[lastPos])
    if (lastIndex < 0) { return null }
    const lastValue = BigInt(lastIndex)
    // Padding bits must be zero (RFC 4648 §3.5).
    if (removeBits > 0n && (lastValue & mask(removeBits)) !== 0n) { return null }
    return concat(head)(vec(6n - removeBits)(lastValue >> removeBits))
}
