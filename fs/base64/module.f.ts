/**
 * Standard Base64 encoding and decoding (RFC 4648).
 *
 * @module
 */
import { msb, type Vec, length, vec, empty } from "../types/bit_vec/module.f.ts"
import type { Nullable } from "../types/nullable/module.f.ts"

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const { popFront, concat } = msb

const popFront6 = popFront(6n)

const vec6 = vec(6n)

export const encode = (input: Vec): Nullable<string> => {
    const len = length(input)
    // Base64 is a byte codec; reject non-octet-aligned inputs.
    if (len % 8n !== 0n) { return null }
    const rem = len % 24n
    const padBits = rem === 0n ? 0n : 6n - rem % 6n
    let v = padBits > 0n ? concat(input)(vec(padBits)(0n)) : input
    let result = ''
    while (length(v) > 0n) {
        const [r, rest] = popFront6(v)
        result += alphabet[Number(r)]
        v = rest
    }
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

    // Decode each character to 6 bits.
    let result: Vec = empty
    for (const c of body) {
        const index = alphabet.indexOf(c)
        if (index < 0) { return null }
        result = concat(result)(vec6(BigInt(index)))
    }

    // Remove the zero-padding bits introduced during encode.
    // padChars=1 → 2 padding bits removed, padChars=2 → 4 padding bits removed.
    const removeBits = BigInt(padChars * 2)
    const totalBits = length(result)
    const targetLen = totalBits - removeBits
    if (targetLen === 0n) { return empty }
    const [kept, padVec] = popFront(targetLen)(result)
    // Padding bits must be zero (RFC 4648 §3.5).
    if (removeBits > 0n && padVec !== vec(removeBits)(0n)) { return null }
    return vec(targetLen)(kept)
}
