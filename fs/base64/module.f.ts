/**
 * Standard Base64 encoding and decoding (RFC 4648).
 *
 * @module
 */
import { msb, type Vec, length, vec, empty, maxLength } from "../types/bit_vec/module.f.ts"
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
    // The octet-alignment padding can push a `maxLength`-bit input past the cap;
    // reject it as `null` rather than building an over-`maxLength` `bigint`
    // (which throws on `bun`).
    if (len + padBits > maxLength) { return null }
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

    // The decoded length is known up front from the body length: each char is
    // 6 bits, minus the padding bits introduced during encode. Reject over-cap
    // input *before* building anything, so no intermediate `bigint` overflows.
    // padChars=1 → 2 padding bits removed, padChars=2 → 4 padding bits removed.
    const removeBits = padChars * 2
    const targetLen = BigInt(body.length) * 6n - BigInt(removeBits)
    if (targetLen <= 0n) { return empty }
    if (targetLen > maxLength) { return null }

    // Build only the trimmed `targetLen` bits: decode every 6-bit chunk except
    // the trailing one, then append just the data bits of the last char. A
    // `maxLengthBytes` blob's full `body.length * 6` is `targetLen + removeBits`
    // (a couple bits over the cap because of base64 octet padding), so keeping
    // the last char out caps the largest intermediate vector at `< targetLen`.
    const head = stringToVec(body.slice(0, body.length - 1))
    if (head === null) { return null }
    const lastIndex = alphabet.indexOf(body[body.length - 1])
    if (lastIndex < 0) { return null }
    // Padding bits must be zero (RFC 4648 §3.5). The discarded low `removeBits`
    // of the last char are checked in the `number` domain — `lastIndex` and
    // `removeBits` are both small numbers, so the mask stays numeric.
    if ((lastIndex & ((1 << removeBits) - 1)) !== 0) { return null }
    const dataBits = BigInt(6 - removeBits)
    return concat(head)(vec(dataBits)(BigInt(lastIndex >> removeBits)))
}
