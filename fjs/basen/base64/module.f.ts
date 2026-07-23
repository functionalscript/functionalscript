/**
 * Standard Base64 encoding and decoding (RFC 4648).
 *
 * @module
 */
import { msb, type Vec, length, vec, maxLength } from "../../types/bit_vec/module.f.ts"
import type { Nullable } from "../../types/nullable/module.f.ts"
import { baseN } from "../../base_n/module.f.ts"

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const { popFront } = msb

const { vecToString, stringToVec } = baseN(6n, alphabet)

export const encode = (input: Vec): Nullable<string> => {
    const len = length(input)
    // Base64 is a byte codec; reject non-octet-aligned inputs.
    if (len % 8n !== 0n) { return null }
    // `vecToString` (via `baseN`'s `chunkList`) already left-pads a trailing
    // partial 6-bit chunk with zeros, so `input` needs no explicit padding —
    // building one would risk pushing an intermediate `Vec` past `maxLength`
    // for input already at or near that limit, for no benefit.
    let result = vecToString(input)
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

    if (padChars === 0) { return stringToVec(body) }

    // `encode`'s zero-padding bits (added to reach a 6-bit boundary) live
    // entirely inside the *last* character's chunk — RFC 4648 padding never
    // spans more than one base64 character. Decode every character but the
    // last through `stringToVec` as usual, then decode and trim the last
    // character on its own, so no intermediate `Vec` built here is ever
    // wider than the final, post-trim result — even for input whose decoded
    // payload lands exactly at `maxLength`.
    const removeBits = BigInt(padChars * 2)
    const realBits = 6n - removeBits

    const head = stringToVec(body.slice(0, body.length - 1))
    if (head === null) { return null }

    const lastChunk = stringToVec(body.slice(body.length - 1))
    if (lastChunk === null) { return null }

    if (length(head) + realBits > maxLength) { return null }

    const [kept, pad] = popFront(realBits)(lastChunk)
    // Padding bits must be zero (RFC 4648 §3.5).
    if (pad !== vec(removeBits)(0n)) { return null }

    return msb.concat(head)(vec(realBits)(kept))
}
